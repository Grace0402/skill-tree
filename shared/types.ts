/**
 * 主进程与渲染进程共享的类型定义。
 * 这里只有类型，没有运行时代码——两端都用 `import type` 引入。
 */

export type ThemeMode = 'dark' | 'light' | 'system'

export type EffectiveTheme = 'dark' | 'light'

export interface Preferences {
  /** 主题：深色 / 浅色 / 跟随系统 */
  theme?: ThemeMode
  /** 左侧文件区宽度占窗口宽度的比例（0.16 ~ 0.5） */
  splitRatio?: number
  /** 上次聚焦的节点 id（'' = 中心圆） */
  lastSelectedId?: string
  [key: string]: unknown
}

/** config.json —— 产品级设置，与「树的数据」分离 */
export interface Config {
  /** 仅用于「新建节点时建议难度」，日记内容永不发送 */
  apiKey?: string
  baseUrl?: string
  model?: string
  /** 向上传递衰减系数 α（0 < α < 1） */
  alpha?: number
  /** 难度 1（最难）的变亮速度 */
  kMin?: number
  /** 难度 0（最易）的变亮速度 */
  kMax?: number
  preferences?: Preferences
  [key: string]: unknown
}

export interface TreeParams {
  alpha: number
  kMin: number
  kMax: number
}

/** 一篇日记 = 节点文件夹下的一个 .md 文件 = 一个记号（deep 时两个） */
export interface DiaryEntry {
  /** 相对数据根目录的路径，posix 分隔符 */
  file: string
  /** 文件名，如 2026-10-17.md */
  name: string
  /** YYYY-MM-DD */
  date: string
  deep: boolean
  /** 这篇记录贡献的记号数：1 或 2 */
  marks: number
  /** 去掉 frontmatter 后的正文 */
  content: string
  /** 文件原始内容 */
  raw: string
  /** ISO 时间，取文件 mtime */
  mtime: string
}

export interface TreeNode {
  /** 相对数据根目录的路径，posix 分隔符；中心圆为 '' */
  id: string
  name: string
  /** 绝对路径 */
  path: string
  depth: number
  description: string
  difficulty: number
  litAt: string | null
  /** 本节点自己文件夹下的记号数（deep 记 2） */
  ownMarks: number
  /** 本节点累计记号数 = own + α × Σ(children.marks) */
  marks: number
  /** 0–100，永远 < 100 */
  brightness: number
  /** 本节点自己的日记，按日期倒序 */
  diaries: DiaryEntry[]
  ownDiaryCount: number
  children: TreeNode[]
  /** 后代节点数量（不含自己） */
  descendantCount: number
}

export interface ArchivedNode {
  /** 相对 _archived/ 的文件夹路径（posix） */
  id: string
  name: string
  /** 归档前相对数据根目录的路径（posix）；未知则为 '' */
  originalPath: string
  archivedAt: string
  nodeCount: number
  diaryCount: number
}

export interface CenterStats {
  marks: number
  brightness: number
  nodeCount: number
  diaryCount: number
  litCount: number
  maxDepth: number
  lastEntryAt: string | null
}

export interface TreeSnapshot {
  rootPath: string
  rootName: string
  center: CenterStats
  nodes: TreeNode[]
  archived: ArchivedNode[]
  config: Config
  params: TreeParams
  scannedAt: string
}

/** 所有会改动磁盘的操作都返回快照，前端一次替换即可 */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export interface CreateNodeInput {
  /** 父节点 id；'' = 中心圆（根） */
  parentId: string
  name: string
  description: string
  difficulty: number
}

export interface UpdateNodeInput {
  id: string
  description?: string
  difficulty?: number
}

export interface DiaryInput {
  id: string
  content: string
  deep: boolean
}

export interface DiaryUpdateInput extends DiaryInput {
  /** 日记文件名 */
  name: string
}

export interface RenameNodeResult {
  snapshot: TreeSnapshot
  oldId: string
  newId: string
}

export interface SuggestDifficultyResult {
  difficulty: number
  reason: string
}

export interface AiStatus {
  configured: boolean
  model: string
  baseUrl: string
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  rootPath: string
}

/** preload 通过 contextBridge 暴露给渲染进程的接口 */
export interface SkillTreeApi {
  getSnapshot(): Promise<TreeSnapshot>
  appInfo(): Promise<AppInfo>

  createNode(input: CreateNodeInput): Promise<Result<TreeSnapshot>>
  updateNode(input: UpdateNodeInput): Promise<Result<TreeSnapshot>>
  renameNode(id: string, name: string): Promise<Result<RenameNodeResult>>
  setLit(id: string, lit: boolean): Promise<Result<TreeSnapshot>>
  archiveNode(id: string): Promise<Result<TreeSnapshot>>
  restoreArchived(archivedId: string): Promise<Result<TreeSnapshot>>
  writeDiary(input: DiaryInput): Promise<Result<TreeSnapshot>>
  updateDiary(input: DiaryUpdateInput): Promise<Result<TreeSnapshot>>
  deleteDiary(id: string, name: string): Promise<Result<TreeSnapshot>>

  saveConfig(patch: Partial<Config>): Promise<Result<TreeSnapshot>>
  suggestDifficulty(description: string, name: string): Promise<Result<SuggestDifficultyResult>>
  aiStatus(): Promise<AiStatus>

  chooseDataDir(): Promise<Result<TreeSnapshot>>
  openDataDir(): Promise<Result<null>>
  revealNode(id: string): Promise<Result<null>>
  copyNodePath(id: string): Promise<Result<null>>

  minimizeWindow(): void
  toggleMaximizeWindow(): void
  closeWindow(): void
  isWindowMaximized(): Promise<boolean>

  onTreeChanged(cb: (snapshot: TreeSnapshot) => void): () => void
  onWindowMaximized(cb: (maximized: boolean) => void): () => void
}
