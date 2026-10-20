import fs from 'node:fs'
import path from 'node:path'
import {
  BrowserWindow,
  Menu,
  app,
  nativeTheme,
  screen,
  shell,
} from 'electron'
import { loadConfig, writeFileAtomic } from './config'
import { registerIpc } from './ipc'
import { ensureDataRoot, getSnapshot } from './store'

interface AppState {
  dataDir?: string
  window?: { width: number; height: number }
  maximized?: boolean
}

const APP_ID = 'com.growth.skilltree'
const isScreenshotMode = Boolean(process.env.SKILL_TREE_SHOT)

/**
 * 某些受限 Windows 会话不允许在 %APPDATA% 下创建 Chromium 配置目录，
 * Electron 会在 main 执行到一半时直接崩溃（没有窗口、没有进程）。
 * 这里在 ready 之前把 userData 固定到一个确定可写的位置：
 *   1. 显式 --user-data-dir / SKILL_TREE_USER_DATA（开发、截图用）
 *   2. exe 同级的 .skilltree-userdata（便携版 / 按用户安装均可写）
 *   3. 我的文档/个人技能树/.app-data
 *   4. 用户主目录
 *   5. 系统临时目录（最后兜底）
 */
function isWritableDir(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const probe = path.join(dir, `.write-test-${process.pid}`)
    fs.writeFileSync(probe, 'ok')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

function resolveUserDataDir(): string {
  const explicit =
    process.env.SKILL_TREE_USER_DATA ||
    app.commandLine.getSwitchValue('user-data-dir') ||
    ''
  const candidates: string[] = []
  if (explicit) candidates.push(path.resolve(explicit))
  if (!app.isPackaged) candidates.push(path.join(process.cwd(), '.dev-userdata'))
  candidates.push(path.join(path.dirname(app.getPath('exe')), '.skilltree-userdata'))
  try {
    candidates.push(path.join(app.getPath('documents'), '个人技能树', '.app-data'))
  } catch {
    /* ignore */
  }
  try {
    candidates.push(path.join(app.getPath('home'), '.skilltree-userdata'))
  } catch {
    /* ignore */
  }
  try {
    candidates.push(path.join(app.getPath('temp'), 'skilltree-userdata'))
  } catch {
    /* ignore */
  }

  for (const dir of candidates) {
    if (dir && isWritableDir(dir)) return dir
  }
  return candidates[0] ?? path.join(process.cwd(), '.skilltree-userdata')
}

try {
  app.setPath('userData', resolveUserDataDir())
} catch (error) {
  console.error('无法设置 userData 目录', error)
}

// 必须在 ready 之前决定是否禁用硬件加速，否则截图模式下不生效
if (isScreenshotMode) app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let rootPath = ''
let watcher: fs.FSWatcher | null = null
let watchTimer: NodeJS.Timeout | null = null
let pollTimer: NodeJS.Timeout | null = null

function stateFile(): string {
  return path.join(app.getPath('userData'), 'app-state.json')
}

function loadAppState(): AppState {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
    if (parsed && typeof parsed === 'object') return parsed as AppState
  } catch {
    /* 首次启动 */
  }
  return {}
}

function saveAppState(patch: Partial<AppState>): void {
  const next = { ...loadAppState(), ...patch }
  try {
    writeFileAtomic(stateFile(), `${JSON.stringify(next, null, 2)}\n`)
  } catch (error) {
    console.error('无法保存应用状态', error)
  }
}

function defaultRoot(): string {
  const candidates: string[] = []
  try {
    candidates.push(path.join(app.getPath('documents'), '个人技能树'))
  } catch {
    /* ignore */
  }
  try {
    candidates.push(path.join(app.getPath('home'), '个人技能树'))
  } catch {
    /* ignore */
  }
  // 受限会话里 Documents / AppData 可能不可写，退到程序目录（便携版/按用户安装均可写）
  candidates.push(path.join(path.dirname(app.getPath('exe')), '我的技能树'))
  candidates.push(path.join(app.getPath('userData'), '我的技能树'))

  for (const dir of candidates) {
    if (isWritableDir(dir)) return dir
  }
  return candidates[candidates.length - 1]
}

function initialRoot(): string {
  if (process.env.SKILL_TREE_DATA_DIR) {
    return path.resolve(process.env.SKILL_TREE_DATA_DIR)
  }
  const saved = loadAppState().dataDir
  return saved && typeof saved === 'string' ? saved : defaultRoot()
}

function broadcastSnapshot(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    mainWindow.webContents.send('tree:changed', getSnapshot(rootPath))
  } catch (error) {
    console.error('刷新快照失败', error)
  }
}

function scheduleBroadcast(delay = 260): void {
  if (watchTimer) clearTimeout(watchTimer)
  watchTimer = setTimeout(() => {
    watchTimer = null
    broadcastSnapshot()
  }, delay)
}

function stopWatching(): void {
  watcher?.close()
  watcher = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  if (watchTimer) clearTimeout(watchTimer)
  watchTimer = null
}

function startWatching(): void {
  stopWatching()
  try {
    watcher = fs.watch(rootPath, { recursive: true }, (_event, filename) => {
      // 忽略临时文件（原子写入留下的 .tmp），其余变更都重算
      if (filename && String(filename).endsWith('.tmp')) return
      scheduleBroadcast()
    })
    watcher.on('error', () => {
      stopWatching()
      pollTimer = setInterval(broadcastSnapshot, 3000)
    })
  } catch (error) {
    console.error('文件监听不可用，改用轮询', error)
    pollTimer = setInterval(broadcastSnapshot, 3000)
  }
}

function useRoot(next: string): void {
  rootPath = path.resolve(next)
  ensureDataRoot(rootPath)
  saveAppState({ dataDir: rootPath })
  syncNativeTheme()
  startWatching()
  broadcastSnapshot()
}

/** 让系统原生弹窗 / 托盘也跟随应用主题 */
function syncNativeTheme(): void {
  try {
    const pref = loadConfig(rootPath).preferences?.theme ?? 'system'
    nativeTheme.themeSource = pref === 'dark' || pref === 'light' ? pref : 'system'
  } catch {
    nativeTheme.themeSource = 'system'
  }
}

function prefersDark(): boolean {
  try {
    const pref = loadConfig(rootPath).preferences?.theme
    if (pref === 'dark') return true
    if (pref === 'light') return false
  } catch {
    /* 按系统走 */
  }
  return nativeTheme.shouldUseDarkColors
}

function loadRenderer(win: BrowserWindow): void {
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
    return
  }
  const file = path.join(__dirname, '..', '..', 'dist', 'index.html')
  const shotNode = process.env.SKILL_TREE_SHOT_NODE
  if (shotNode) {
    void win.loadFile(file, { hash: `node=${encodeURIComponent(shotNode)}` })
  } else {
    void win.loadFile(file)
  }
}

function sendKeyCombo(win: BrowserWindow, combo: string): void {
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const rawKey = parts.pop()
  if (!rawKey) return
  const key =
    rawKey === 'enter'
      ? 'Return'
      : rawKey === 'tab'
        ? 'Tab'
        : rawKey === 'esc'
          ? 'Escape'
          : rawKey
  const modifiers: Array<'shift' | 'control' | 'alt' | 'meta'> = []
  if (parts.includes('ctrl') || parts.includes('control')) modifiers.push('control')
  if (parts.includes('shift')) modifiers.push('shift')
  if (parts.includes('alt')) modifiers.push('alt')
  if (parts.includes('meta')) modifiers.push('meta')
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers })
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers })
}

function sendText(win: BrowserWindow, text: string): void {
  for (const char of text) {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: char })
    win.webContents.sendInputEvent({ type: 'char', keyCode: char })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: char })
  }
}

function attachScreenshotHook(win: BrowserWindow): void {
  const shotPath = process.env.SKILL_TREE_SHOT
  if (!shotPath) return
  const delay = Number(process.env.SKILL_TREE_SHOT_DELAY ?? 2200)
  win.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        try {
          win.focus()
          app.focus({ steal: true })
          // 截图前先复位视图，避免鼠标滚轮等环境事件影响构图
          sendKeyCombo(win, 'ctrl+0')
          await new Promise((resolve) => setTimeout(resolve, 160))

          const combos = (process.env.SKILL_TREE_SHOT_KEYS ?? '')
            .split('|')
            .map((item) => item.trim())
            .filter(Boolean)
          for (const combo of combos) {
            sendKeyCombo(win, combo)
            await new Promise((resolve) => setTimeout(resolve, 700))
          }

          const typeText = process.env.SKILL_TREE_SHOT_TYPE
          if (typeText) {
            await new Promise((resolve) => setTimeout(resolve, 350))
            sendText(win, typeText)
            await new Promise((resolve) => setTimeout(resolve, 300))
          }
          if (process.env.SKILL_TREE_SHOT_ENTER) {
            sendKeyCombo(win, 'enter')
            await new Promise((resolve) => setTimeout(resolve, 1400))
          }

          const clickPoint = process.env.SKILL_TREE_SHOT_CLICK_POINT
          if (clickPoint) {
            const [x, y] = clickPoint.split(',').map((part) => Number(part.trim()))
            if (Number.isFinite(x) && Number.isFinite(y)) {
              win.webContents.sendInputEvent({
                type: 'mouseDown',
                x,
                y,
                button: 'left',
                clickCount: 1,
              })
              win.webContents.sendInputEvent({
                type: 'mouseUp',
                x,
                y,
                button: 'left',
                clickCount: 1,
              })
              await new Promise((resolve) => setTimeout(resolve, 800))
            }
          }

          const scroll = Number(process.env.SKILL_TREE_SHOT_SCROLL ?? 0)
          if (scroll) {
            const bounds = win.getBounds()
            win.webContents.sendInputEvent({
              type: 'mouseWheel',
              x: Math.max(40, bounds.width - 70),
              y: Math.max(40, Math.round(bounds.height * 0.42)),
              deltaX: 0,
              deltaY: scroll,
              wheelTicksX: 0,
              wheelTicksY: scroll / 120,
              hasPreciseScrollingDeltas: true,
              canScroll: true,
            })
            await new Promise((resolve) => setTimeout(resolve, 800))
          }

          const image = await win.webContents.capturePage()
          fs.mkdirSync(path.dirname(shotPath), { recursive: true })
          fs.writeFileSync(shotPath, image.toPNG())
          console.log(`screenshot saved: ${shotPath}`)
        } catch (error) {
          console.error('截图失败', error)
        } finally {
          app.quit()
        }
      })()
    }, delay)
  })
}

function createWindow(): BrowserWindow {
  const saved = loadAppState()
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(saved.window?.width ?? 1360, workArea.width)
  const height = Math.min(saved.window?.height ?? 860, workArea.height)

  const win = new BrowserWindow({
    width,
    height,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    show: false,
    title: '个人技能树',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    backgroundColor: prefersDark() ? '#07090f' : '#f7f3e9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
    if (saved.maximized) win.maximize()
  })

  win.on('maximize', () => win.webContents.send('win:maximized', true))
  win.on('unmaximize', () => win.webContents.send('win:maximized', false))

  win.on('close', () => {
    if (!win.isDestroyed()) {
      const bounds = win.getNormalBounds()
      saveAppState({
        window: { width: bounds.width, height: bounds.height },
        maximized: win.isMaximized(),
      })
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL
    if (devUrl && url.startsWith(devUrl)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (/^https?:/i.test(url)) void shell.openExternal(url)
  })

  attachScreenshotHook(win)
  loadRenderer(win)
  return win
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID)
    Menu.setApplicationMenu(null)

    rootPath = initialRoot()
    try {
      ensureDataRoot(rootPath)
    } catch (error) {
      // 保存的目录可能被系统策略改成不可写：自动换一个可写位置，至少让应用能打开
      console.error('数据目录不可写，改用备用位置', error)
      rootPath = defaultRoot()
      ensureDataRoot(rootPath)
    }
    saveAppState({ dataDir: rootPath })
    syncNativeTheme()

    registerIpc({
      getRoot: () => rootPath,
      setRoot: useRoot,
      getWindow: () => mainWindow,
    })

    mainWindow = createWindow()
    startWatching()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    stopWatching()
  })
}

process.on('uncaughtException', (error) => {
  console.error('未捕获异常', error)
})
