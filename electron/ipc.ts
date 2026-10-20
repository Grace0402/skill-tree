import fs from 'node:fs'
import path from 'node:path'
import { BrowserWindow, app, clipboard, dialog, ipcMain, nativeTheme, shell } from 'electron'
import type { OpenDialogOptions } from 'electron'
import type {
  AiStatus,
  AppInfo,
  Config,
  CreateNodeInput,
  DiaryInput,
  DiaryUpdateInput,
  Result,
  SuggestDifficultyResult,
  TreeSnapshot,
  UpdateNodeInput,
} from '../shared/types'
import { loadConfig } from './config'
import { suggestDifficulty } from './ai'
import {
  archiveNode,
  createNode,
  deleteDiary,
  getSnapshot,
  nodeDir,
  renameNode,
  restoreArchived,
  setLit,
  updateConfig,
  updateDiary,
  updateNode,
  writeDiary,
} from './store'

interface IpcOptions {
  getRoot: () => string
  setRoot: (root: string) => void
  getWindow: () => BrowserWindow | null
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** 所有写操作统一返回 Result，主进程异常不会以堆栈形式吓到用户 */
function handleResult<T>(
  channel: string,
  fn: (...args: unknown[]) => T | Promise<T>,
): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<Result<T>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (error) {
      return { ok: false, error: messageOf(error) }
    }
  })
}

export function registerIpc(options: IpcOptions): void {
  const root = (): string => options.getRoot()
  const win = (): BrowserWindow | null => options.getWindow()

  ipcMain.handle('tree:get', (): TreeSnapshot => getSnapshot(root()))

  ipcMain.handle(
    'app:info',
    (): AppInfo => ({
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      rootPath: root(),
    }),
  )

  handleResult('node:create', (input) => createNode(root(), input as CreateNodeInput))
  handleResult('node:update', (input) => updateNode(root(), input as UpdateNodeInput))
  handleResult('node:rename', (id, name) => renameNode(root(), String(id), String(name)))
  handleResult('node:set-lit', (id, lit) => setLit(root(), String(id), lit === true))
  handleResult('node:archive', (id) => archiveNode(root(), String(id)))
  handleResult('archive:restore', (id) => restoreArchived(root(), String(id)))

  handleResult('diary:write', (input) => writeDiary(root(), input as DiaryInput))
  handleResult('diary:update', (input) => updateDiary(root(), input as DiaryUpdateInput))
  handleResult('diary:delete', (id, name) => deleteDiary(root(), String(id), String(name)))

  handleResult('config:save', (patch) => {
    const snapshot = updateConfig(
      root(),
      (patch && typeof patch === 'object' ? patch : {}) as Partial<Config>,
    )
    const theme = snapshot.config.preferences?.theme
    nativeTheme.themeSource = theme === 'dark' || theme === 'light' ? theme : 'system'
    return snapshot
  })

  ipcMain.handle(
    'ai:status',
    (): AiStatus => {
      const config = loadConfig(root())
      return {
        configured: Boolean(config.apiKey && config.apiKey.trim()),
        model: config.model ?? '',
        baseUrl: config.baseUrl ?? '',
      }
    },
  )

  handleResult('ai:suggest', (description, name) =>
    suggestDifficulty(loadConfig(root()), String(name ?? ''), String(description ?? '')),
  )

  ipcMain.handle('data:choose', async (): Promise<Result<TreeSnapshot>> => {
    try {
      const current = root()
      const dialogOptions: OpenDialogOptions = {
        title: '选择技能树数据文件夹',
        defaultPath: current,
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: '用这个文件夹',
      }
      const parent = win()
      const result = parent
        ? await dialog.showOpenDialog(parent, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: true, data: getSnapshot(current) }
      }
      options.setRoot(result.filePaths[0])
      return { ok: true, data: getSnapshot(options.getRoot()) }
    } catch (error) {
      return { ok: false, error: messageOf(error) }
    }
  })

  handleResult('data:open', async () => {
    const error = await shell.openPath(root())
    if (error) throw new Error(`打不开文件夹：${error}`)
    return null
  })

  handleResult('node:reveal', (id) => {
    shell.showItemInFolder(nodeDir(root(), String(id)))
    return null
  })

  handleResult('node:copy-path', (id) => {
    clipboard.writeText(nodeDir(root(), String(id)))
    return null
  })

  ipcMain.on('win:minimize', () => win()?.minimize())
  ipcMain.on('win:toggle-maximize', () => {
    const w = win()
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on('win:close', () => win()?.close())
  ipcMain.handle('win:is-maximized', () => win()?.isMaximized() ?? false)
}
