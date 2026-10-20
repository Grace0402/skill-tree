import { computed, reactive } from 'vue'
import type {
  AiStatus,
  AppInfo,
  Config,
  CreateNodeInput,
  Preferences,
  Result,
  ThemeMode,
  TreeNode,
  TreeSnapshot,
} from '../../shared/types'
import { api } from '../ipc'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  text: string
  kind: ToastKind
}

interface State {
  snapshot: TreeSnapshot | null
  loading: boolean
  fatalError: string | null
  selectedId: string
  expanded: string[]
  themeMode: ThemeMode
  systemDark: boolean
  inspectorOpen: boolean
  newNodeOpen: boolean
  newNodeParentId: string
  settingsOpen: boolean
  toasts: Toast[]
  saving: boolean
  aiBusy: boolean
  appInfo: AppInfo | null
  aiStatus: AiStatus | null
  maximized: boolean
}

const THEME_KEY = 'skill-tree:theme'
const EXPANDED_KEY = 'skill-tree:expanded'
const SELECTED_KEY = 'skill-tree:selected'

function readStoredTheme(): ThemeMode {
  const value = localStorage.getItem(THEME_KEY)
  return value === 'dark' || value === 'light' || value === 'system' ? value : 'system'
}

function readStoredExpanded(): string[] | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? 'null')
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    /* ignore */
  }
  return null
}

export const state = reactive<State>({
  snapshot: null,
  loading: true,
  fatalError: null,
  selectedId: '',
  expanded: [],
  themeMode: readStoredTheme(),
  systemDark: false,
  inspectorOpen: false,
  newNodeOpen: false,
  newNodeParentId: '',
  settingsOpen: false,
  toasts: [],
  saving: false,
  aiBusy: false,
  appInfo: null,
  aiStatus: null,
  maximized: false,
})

/* ------------------------------------------------------------------ */
/* 派生数据                                                            */
/* ------------------------------------------------------------------ */

interface FlatEntry {
  node: TreeNode
  parentId: string
}

export const flatEntries = computed<FlatEntry[]>(() => {
  const out: FlatEntry[] = []
  const walk = (node: TreeNode, parentId: string): void => {
    out.push({ node, parentId })
    for (const child of node.children) walk(child, node.id)
  }
  for (const node of state.snapshot?.nodes ?? []) walk(node, '')
  return out
})

export const nodeMap = computed<Map<string, TreeNode>>(() => {
  const map = new Map<string, TreeNode>()
  for (const entry of flatEntries.value) map.set(entry.node.id, entry.node)
  return map
})

export const parentMap = computed<Map<string, string>>(() => {
  const map = new Map<string, string>()
  for (const entry of flatEntries.value) map.set(entry.node.id, entry.parentId)
  return map
})

export const selectedNode = computed<TreeNode | null>(() => {
  if (!state.selectedId) return null
  return nodeMap.value.get(state.selectedId) ?? null
})

export const isCenterSelected = computed(() => state.selectedId === '')

export const focusPath = computed<Set<string>>(() => {
  const set = new Set<string>()
  if (!state.selectedId) return set
  let current: string | undefined = state.selectedId
  let guard = 0
  while (current && guard < 100) {
    set.add(current)
    current = parentMap.value.get(current)
    guard += 1
  }
  return set
})

export const effectiveTheme = computed<'dark' | 'light'>(() =>
  state.themeMode === 'system' ? (state.systemDark ? 'dark' : 'light') : state.themeMode,
)

export const apiKeyConfigured = computed(() => Boolean(state.snapshot?.config.apiKey?.trim()))

export const params = computed(() => state.snapshot?.params ?? { alpha: 0.6, kMin: 0.00025, kMax: 0.001 })

export const totalNodes = computed(() => state.snapshot?.center.nodeCount ?? 0)

export const hasApi = computed(() => state.snapshot !== null)

/* ------------------------------------------------------------------ */
/* 主题                                                                */
/* ------------------------------------------------------------------ */

let mediaQuery: MediaQueryList | null = null

function applyDomTheme(): void {
  document.documentElement.dataset.theme = effectiveTheme.value
  document.documentElement.style.colorScheme = effectiveTheme.value
}

function initSystemTheme(): void {
  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    state.systemDark = mediaQuery.matches
    mediaQuery.addEventListener('change', (event) => {
      state.systemDark = event.matches
      applyDomTheme()
    })
  }
  applyDomTheme()
}

export function setTheme(mode: ThemeMode): void {
  state.themeMode = mode
  localStorage.setItem(THEME_KEY, mode)
  applyDomTheme()
  persistPreferences({ theme: mode })
}

/* ------------------------------------------------------------------ */
/* 提示                                                                */
/* ------------------------------------------------------------------ */

let toastSeq = 0

function toast(text: string, kind: ToastKind = 'info'): void {
  const id = ++toastSeq
  state.toasts.push({ id, text, kind })
  window.setTimeout(() => dismissToast(id), kind === 'error' ? 4200 : 2800)
}

function dismissToast(id: number): void {
  const index = state.toasts.findIndex((item) => item.id === id)
  if (index >= 0) state.toasts.splice(index, 1)
}

/* ------------------------------------------------------------------ */
/* 偏好持久化（去抖，避免拖分隔条时疯狂写盘）                          */
/* ------------------------------------------------------------------ */

let prefTimer: number | undefined
let pendingPreferences: Partial<Preferences> = {}

function persistPreferences(patch: Partial<Preferences>): void {
  pendingPreferences = { ...pendingPreferences, ...patch }
  if (prefTimer) window.clearTimeout(prefTimer)
  prefTimer = window.setTimeout(async () => {
    const preferences = pendingPreferences
    pendingPreferences = {}
    const result = await api.saveConfig({ preferences })
    if (!result.ok) {
      toast(result.error, 'error')
      return
    }
    applySnapshot(result.data)
  }, 500)
}

/* ------------------------------------------------------------------ */
/* 快照                                                                */
/* ------------------------------------------------------------------ */

function collectIds(snapshot: TreeSnapshot): Set<string> {
  const ids = new Set<string>()
  const walk = (node: TreeNode): void => {
    ids.add(node.id)
    node.children.forEach(walk)
  }
  snapshot.nodes.forEach(walk)
  return ids
}

function expandAncestors(id: string, snapshot: TreeSnapshot | null): void {
  if (!snapshot || !id) return
  const map = new Map<string, string>()
  const walk = (node: TreeNode, parentId: string): void => {
    map.set(node.id, parentId)
    node.children.forEach((child) => walk(child, node.id))
  }
  snapshot.nodes.forEach((node) => walk(node, ''))
  let current = id
  let guard = 0
  while (current && guard < 100) {
    guard += 1
    const parent = map.get(current)
    if (parent === undefined) break
    if (parent && !state.expanded.includes(parent)) state.expanded.push(parent)
    current = parent
  }
  // 选中的节点本身也展开，方便看到它的子枝
  if (!state.expanded.includes(id)) state.expanded.push(id)
}

function persistExpanded(): void {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify(state.expanded))
}

function applySnapshot(snapshot: TreeSnapshot, initial = false): void {
  const previous = state.snapshot
  state.snapshot = snapshot
  state.loading = false
  state.fatalError = null

  const configTheme = snapshot.config.preferences?.theme
  if (configTheme && configTheme !== state.themeMode) {
    state.themeMode = configTheme
    localStorage.setItem(THEME_KEY, configTheme)
    applyDomTheme()
  }

  const ids = collectIds(snapshot)
  const savedExpanded = readStoredExpanded()
  if (initial) {
    const valid = (savedExpanded ?? []).filter((id) => ids.has(id))
    if (valid.length > 0) {
      state.expanded = valid
    } else {
      // 没有可用的展开记录（首次打开 / 换了数据目录）：先展开一层
      state.expanded = []
      for (const node of snapshot.nodes) {
        if (node.children.length > 0) state.expanded.push(node.id)
      }
    }
  } else {
    state.expanded = state.expanded.filter((id) => ids.has(id))
  }

  if (initial) {
    // 首次进入始终落在整体视角：先看见整棵树，再点进去看某一枝
    state.selectedId = ''
    localStorage.setItem(SELECTED_KEY, '')
  } else if (state.selectedId && !ids.has(state.selectedId)) {
    // 选中的节点被移走 / 归档了：回到它的父节点或中心
    const fallbackParent = previous ? findParentIn(previous, state.selectedId) : ''
    state.selectedId = fallbackParent && ids.has(fallbackParent) ? fallbackParent : ''
    state.inspectorOpen = false
    localStorage.setItem(SELECTED_KEY, state.selectedId)
  }

  if (state.selectedId) expandAncestors(state.selectedId, snapshot)
  if (!state.selectedId) state.inspectorOpen = false
  persistExpanded()
}

function findParentIn(snapshot: TreeSnapshot, id: string): string {
  let found = ''
  const walk = (node: TreeNode, parentId: string): void => {
    if (found) return
    if (node.id === id) {
      found = parentId
      return
    }
    node.children.forEach((child) => walk(child, node.id))
  }
  snapshot.nodes.forEach((node) => walk(node, ''))
  return found
}

/* ------------------------------------------------------------------ */
/* 操作                                                                */
/* ------------------------------------------------------------------ */

async function applyResult<T>(
  promise: Promise<Result<T>>,
  successMessage?: string,
): Promise<T | null> {
  state.saving = true
  try {
    const result = await promise
    if (!result.ok) {
      toast(result.error, 'error')
      return null
    }
    if (successMessage) toast(successMessage, 'success')
    return result.data
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error')
    return null
  } finally {
    state.saving = false
  }
}

function selectNode(id: string, options: { openInspector?: boolean } = {}): void {
  state.selectedId = id
  localStorage.setItem(SELECTED_KEY, id)
  if (id) {
    expandAncestors(id, state.snapshot)
    persistExpanded()
    state.inspectorOpen = options.openInspector === true
  } else {
    state.inspectorOpen = false
  }
}

function toggleExpand(id: string): void {
  const index = state.expanded.indexOf(id)
  if (index >= 0) state.expanded.splice(index, 1)
  else state.expanded.push(id)
  persistExpanded()
}

function expandAll(): void {
  state.expanded = flatEntries.value
    .filter((entry) => entry.node.children.length > 0)
    .map((entry) => entry.node.id)
  persistExpanded()
}

function collapseAll(): void {
  state.expanded = []
  persistExpanded()
}

function openInspector(): void {
  if (!state.selectedId) return
  state.inspectorOpen = true
}

function closeInspector(): void {
  state.inspectorOpen = false
}

function openNewNode(parentId?: string): void {
  const target = parentId ?? state.selectedId
  state.newNodeParentId = target
  state.newNodeOpen = true
}

function closeNewNode(): void {
  state.newNodeOpen = false
}

function openSettings(): void {
  state.settingsOpen = true
}

function closeSettings(): void {
  state.settingsOpen = false
}

async function createNode(input: Omit<CreateNodeInput, 'parentId'>): Promise<boolean> {
  const parentId = state.newNodeParentId
  const snapshot = await applyResult(api.createNode({ ...input, parentId }))
  if (!snapshot) return false
  applySnapshot(snapshot)
  const newId = parentId ? `${parentId}/${input.name.trim()}` : input.name.trim()
  state.newNodeOpen = false
  if (nodeMap.value.has(newId)) selectNode(newId, { openInspector: true })
  toast('新枝长出来了', 'success')
  return true
}

async function updateNodeMeta(
  id: string,
  patch: { description?: string; difficulty?: number },
): Promise<boolean> {
  const snapshot = await applyResult(api.updateNode({ id, ...patch }))
  if (!snapshot) return false
  applySnapshot(snapshot)
  return true
}

async function renameNode(id: string, name: string): Promise<boolean> {
  const result = await applyResult(api.renameNode(id, name), '已重命名')
  if (!result) return false
  const { snapshot, oldId, newId } = result
  applySnapshot(snapshot)
  state.expanded = state.expanded.map((item) =>
    item === oldId ? newId : item.startsWith(`${oldId}/`) ? newId + item.slice(oldId.length) : item,
  )
  persistExpanded()
  state.selectedId = newId
  localStorage.setItem(SELECTED_KEY, newId)
  return true
}

async function setLit(id: string, lit: boolean): Promise<boolean> {
  const snapshot = await applyResult(
    api.setLit(id, lit),
    lit ? '点亮这一刻 ✦' : '已取消点亮',
  )
  if (!snapshot) return false
  applySnapshot(snapshot)
  return true
}

async function archiveNode(id: string): Promise<boolean> {
  const parentId = parentMap.value.get(id) ?? ''
  const snapshot = await applyResult(api.archiveNode(id), '已剪下这一枝，放进归档区')
  if (!snapshot) return false
  applySnapshot(snapshot)
  state.selectedId = parentId && nodeMap.value.has(parentId) ? parentId : ''
  state.inspectorOpen = false
  return true
}

async function restoreArchived(archivedId: string): Promise<boolean> {
  const snapshot = await applyResult(api.restoreArchived(archivedId), '已接回树上')
  if (!snapshot) return false
  applySnapshot(snapshot)
  return true
}

async function writeDiary(content: string, deep: boolean): Promise<boolean> {
  if (!state.selectedId) return false
  const snapshot = await applyResult(
    api.writeDiary({ id: state.selectedId, content, deep }),
    deep ? '记下一笔 · +2 记号（深度投入）' : '记下一笔 · +1 记号',
  )
  if (!snapshot) return false
  applySnapshot(snapshot)
  return true
}

async function updateDiary(name: string, content: string, deep: boolean): Promise<boolean> {
  if (!state.selectedId) return false
  const snapshot = await applyResult(
    api.updateDiary({ id: state.selectedId, name, content, deep }),
    '记录已更新',
  )
  if (!snapshot) return false
  applySnapshot(snapshot)
  return true
}

async function deleteDiaryEntry(name: string): Promise<boolean> {
  if (!state.selectedId) return false
  const snapshot = await applyResult(api.deleteDiary(state.selectedId, name), '已删除这篇记录')
  if (!snapshot) return false
  applySnapshot(snapshot)
  return true
}

async function saveConfig(patch: Partial<Config>): Promise<boolean> {
  const snapshot = await applyResult(api.saveConfig(patch), '设置已保存')
  if (!snapshot) return false
  applySnapshot(snapshot)
  return true
}

async function chooseDataDir(): Promise<boolean> {
  const result = await applyResult(api.chooseDataDir())
  if (!result) return false
  state.expanded = []
  state.selectedId = ''
  applySnapshot(result, true)
  toast(`已切换到「${result.rootName}」`, 'success')
  return true
}

async function suggestDifficulty(
  name: string,
  description: string,
): Promise<{ difficulty: number; reason: string } | null> {
  state.aiBusy = true
  try {
    const result = await api.suggestDifficulty(description, name)
    if (!result.ok) {
      toast(result.error, 'error')
      return null
    }
    return result.data
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error')
    return null
  } finally {
    state.aiBusy = false
  }
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

let started = false

async function init(): Promise<void> {
  if (started) return
  started = true
  initSystemTheme()

  try {
    const snapshot = await api.getSnapshot()
    applySnapshot(snapshot, true)
    state.appInfo = await api.appInfo()
    state.aiStatus = await api.aiStatus()
    state.maximized = await api.isWindowMaximized()

    // 支持 #node=... 深链（截图验收 / 从外部打开某个节点）
    const hash = window.location.hash
    if (hash.startsWith('#node=')) {
      try {
        const id = decodeURIComponent(hash.slice(6))
        if (id === '') {
          state.selectedId = ''
        } else if (nodeMap.value.has(id)) {
          selectNode(id, { openInspector: true })
        }
      } catch {
        /* 忽略不合法的深链 */
      }
    }
  } catch (error) {
    state.fatalError =
      error instanceof Error ? error.message : '读取技能树失败了，请检查数据目录'
    state.loading = false
    return
  }

  api.onTreeChanged((snapshot) => applySnapshot(snapshot))
  api.onWindowMaximized((maximized) => {
    state.maximized = maximized
  })
}

export const treeStore = {
  state,
  init,
  selectNode,
  toggleExpand,
  expandAll,
  collapseAll,
  openInspector,
  closeInspector,
  openNewNode,
  closeNewNode,
  openSettings,
  closeSettings,
  createNode,
  updateNodeMeta,
  renameNode,
  setLit,
  archiveNode,
  restoreArchived,
  writeDiary,
  updateDiary,
  deleteDiaryEntry,
  saveConfig,
  chooseDataDir,
  suggestDifficulty,
  setTheme,
  toast,
  dismissToast,
  persistPreferences,
  applySnapshot,
}
