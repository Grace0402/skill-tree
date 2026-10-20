import fs from 'node:fs'
import path from 'node:path'
import type {
  ArchivedNode,
  CenterStats,
  Config,
  DiaryEntry,
  TreeNode,
  TreeParams,
  TreeSnapshot,
} from '../shared/types'
import {
  ARCHIVE_DIR,
  ARCHIVE_MANIFEST,
  loadConfig,
  resolveParams,
  writeFileAtomic,
} from './config'

export const NODE_META_FILE = '.node.json'
const SKIP_DIRS = new Set([ARCHIVE_DIR, '.git', '.obsidian', 'node_modules'])
const HIDDEN_PREFIX = '.'

/* ------------------------------------------------------------------ */
/* 路径与命名                                                          */
/* ------------------------------------------------------------------ */

export function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

export function joinId(parentId: string, name: string): string {
  return parentId ? `${parentId}/${name}` : name
}

/** 把渲染进程传来的相对 id 解析为绝对路径，并确保不越出数据根目录 */
export function resolveInside(rootPath: string, relId: string): string {
  if (typeof relId !== 'string') throw new Error('节点路径无效')
  if (relId.includes('\0')) throw new Error('节点路径无效')
  if (/^[a-zA-Z]:/.test(relId) || relId.startsWith('\\\\')) {
    throw new Error('节点路径无效')
  }
  const rootResolved = path.resolve(rootPath)
  const rel = relId
    .split('/')
    .filter((part) => part.length > 0 && part !== '.')
    .join(path.sep)
  const abs = path.resolve(rootResolved, rel)
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) {
    throw new Error('节点路径越界')
  }
  return abs
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const INVALID_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/

/** 校验并返回清理后的节点名（文件夹名） */
export function normalizeNodeName(input: string): string {
  if (typeof input !== 'string') throw new Error('名称无效')
  const name = input.replace(/\s+/g, ' ').trim()
  if (!name) throw new Error('名称不能为空')
  if ([...name].length > 60) throw new Error('名称最多 60 个字')
  if (INVALID_NAME_CHARS.test(name)) {
    throw new Error('名称不能包含 \\ / : * ? " < > | 等字符')
  }
  if (name.endsWith('.')) throw new Error('名称不能以句点结尾')
  if (HIDDEN_PREFIX === name[0]) throw new Error('名称不能以 . 开头')
  if (WINDOWS_RESERVED.test(name.split('.')[0] ?? '')) {
    throw new Error('这个名称是系统保留字，请换一个')
  }
  if (name.toLowerCase() === ARCHIVE_DIR.toLowerCase()) {
    throw new Error('「_archived」是归档区专用名称')
  }
  return name
}

export function assertNodeDir(dir: string): void {
  let stat: fs.Stats
  try {
    stat = fs.statSync(dir)
  } catch {
    throw new Error('节点文件夹不存在，可能已被移动或删除')
  }
  if (!stat.isDirectory()) throw new Error('节点路径不是文件夹')
}

/* ------------------------------------------------------------------ */
/* 日期与日记                                                          */
/* ------------------------------------------------------------------ */

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 本地时区的 YYYY-MM-DD（日记文件名用本地日期，符合"今天"的直觉） */
export function localDateStamp(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export interface ParsedDiary {
  date: string
  deep: boolean
  content: string
  meta: Record<string, string>
}

function parseScalar(value: string): string {
  let v = value.trim()
  // 去掉行尾注释（frontmatter 里只可能有简单的 key: value）
  v = v.replace(/\s+#.*$/, '')
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  return v.trim()
}

/** 手写一个最小 frontmatter 解析器：不引入任何依赖，Obsidian 写的也能读 */
export function parseDiary(raw: string, fileName: string, mtime: Date): ParsedDiary {
  const text = raw.replace(/^\uFEFF/, '')
  const meta: Record<string, string> = {}
  let body = text

  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  if (match) {
    body = text.slice(match[0].length)
    for (const line of match[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
      if (kv) meta[kv[1].toLowerCase()] = parseScalar(kv[2])
    }
  }

  const fileDate = /^(\d{4}-\d{2}-\d{2})/.exec(fileName)?.[1]
  const metaDate = meta.date && /^\d{4}-\d{2}-\d{2}$/.test(meta.date) ? meta.date : undefined
  const date = metaDate ?? fileDate ?? localDateStamp(mtime)

  const deepRaw = (meta.deep ?? '').toLowerCase()
  const deep = ['true', 'yes', '1', 'on'].includes(deepRaw)

  return { date, deep, content: body.replace(/^\r?\n/, ''), meta }
}

/** 一次记录 = 一个记号；deep = true 时两个记号（不折算、不量化） */
export function marksForDiary(deep: boolean): number {
  return deep ? 2 : 1
}

export function serializeDiary(date: string, deep: boolean, content: string): string {
  const head = ['---', `date: ${date}`]
  if (deep) head.push('deep: true')
  head.push('---', '')
  return `${head.join('\n')}\n${content.replace(/\s+$/, '')}\n`
}

function listMarkdownFiles(dir: string): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith(HIDDEN_PREFIX) && /\.md$/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => b.localeCompare(a, 'zh-Hans-CN', { numeric: true }))
}

export function readDiaryEntries(dir: string, nodeId: string): DiaryEntry[] {
  const files = listMarkdownFiles(dir)
  const entries: DiaryEntry[] = []
  for (const name of files) {
    const abs = path.join(dir, name)
    let raw = ''
    let stat: fs.Stats
    try {
      raw = fs.readFileSync(abs, 'utf8')
      stat = fs.statSync(abs)
    } catch {
      continue
    }
    const parsed = parseDiary(raw, name, stat.mtime)
    entries.push({
      file: nodeId ? `${nodeId}/${name}` : name,
      name,
      date: parsed.date,
      deep: parsed.deep,
      marks: marksForDiary(parsed.deep),
      content: parsed.content,
      raw,
      mtime: stat.mtime.toISOString(),
    })
  }
  entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.name.localeCompare(a.name, 'zh-Hans-CN', { numeric: true })
  })
  return entries
}

export function uniqueDiaryName(dir: string, date: string): string {
  const first = `${date}.md`
  if (!fs.existsSync(path.join(dir, first))) return first
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${date}-${i}.md`
    if (!fs.existsSync(path.join(dir, candidate))) return candidate
  }
  throw new Error('同一天的记录太多，请先整理一下文件夹')
}

/* ------------------------------------------------------------------ */
/* 节点元数据                                                          */
/* ------------------------------------------------------------------ */

export interface RawNodeMeta {
  raw: Record<string, unknown>
  description: string
  difficulty: number
  litAt: string | null
}

export function readNodeMeta(dir: string): RawNodeMeta {
  const file = path.join(dir, NODE_META_FILE)
  let raw: Record<string, unknown> = {}
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      raw = parsed as Record<string, unknown>
    }
  } catch {
    // 没有 .node.json（用户手建文件夹）或写坏了：用默认值，节点仍能显示
  }

  const description = typeof raw.description === 'string' ? raw.description : ''
  const d = typeof raw.difficulty === 'number' ? raw.difficulty : 0.5
  const difficulty = Math.min(1, Math.max(0, Number.isFinite(d) ? d : 0.5))
  const litAt =
    typeof raw.litAt === 'string' && raw.litAt.trim() ? raw.litAt.trim() : null

  return { raw, description, difficulty, litAt }
}

/** 只写用户输入（description / difficulty / litAt），绝不写亮度或记号数 */
export function writeNodeMeta(dir: string, meta: RawNodeMeta): void {
  const out: Record<string, unknown> = {
    ...meta.raw,
    description: meta.description,
    difficulty: meta.difficulty,
  }
  if (meta.litAt) out.litAt = meta.litAt
  else delete out.litAt
  writeFileAtomic(path.join(dir, NODE_META_FILE), `${JSON.stringify(out, null, 2)}\n`)
}

/* ------------------------------------------------------------------ */
/* 亮度：渐近线 + 逐层衰减                                             */
/* ------------------------------------------------------------------ */

export function computeK(difficulty: number, params: TreeParams): number {
  const d = Math.min(1, Math.max(0, difficulty))
  return params.kMin + (params.kMax - params.kMin) * (1 - d)
}

/** 亮度 = 100 × (1 − e^(−k × 记号数))，恒 < 100 */
export function brightnessOf(marks: number, k: number): number {
  if (!Number.isFinite(marks) || marks <= 0) return 0
  return 100 * (1 - Math.exp(-k * marks))
}

export function nodeBrightness(node: TreeNode, params: TreeParams): number {
  return brightnessOf(node.marks, computeK(node.difficulty, params))
}

/* ------------------------------------------------------------------ */
/* 扫描整棵树                                                          */
/* ------------------------------------------------------------------ */

function shouldSkipDir(name: string): boolean {
  return name.startsWith(HIDDEN_PREFIX) || SKIP_DIRS.has(name)
}

function childDirectories(dir: string): fs.Dirent[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && !shouldSkipDir(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }))
}

function buildNode(
  dir: string,
  name: string,
  id: string,
  depth: number,
  params: TreeParams,
): TreeNode {
  const meta = readNodeMeta(dir)
  const diaries = readDiaryEntries(dir, id)
  const ownMarks = diaries.reduce((sum, entry) => sum + entry.marks, 0)

  const children: TreeNode[] = []
  for (const entry of childDirectories(dir)) {
    const childId = joinId(id, entry.name)
    children.push(buildNode(path.join(dir, entry.name), entry.name, childId, depth + 1, params))
  }

  const childrenMarks = children.reduce((sum, child) => sum + child.marks, 0)
  const marks = ownMarks + params.alpha * childrenMarks
  const brightness = brightnessOf(marks, computeK(meta.difficulty, params))
  const descendantCount = children.reduce(
    (sum, child) => sum + 1 + child.descendantCount,
    0,
  )

  return {
    id,
    name,
    path: dir,
    depth,
    description: meta.description,
    difficulty: meta.difficulty,
    litAt: meta.litAt,
    ownMarks,
    marks,
    brightness,
    diaries,
    ownDiaryCount: diaries.length,
    children,
    descendantCount,
  }
}

interface ArchiveRecord {
  folder: string
  originalPath: string
  archivedAt: string
}

export function readArchiveManifest(rootPath: string): ArchiveRecord[] {
  const file = path.join(rootPath, ARCHIVE_DIR, ARCHIVE_MANIFEST)
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is ArchiveRecord => {
          return (
            !!item &&
            typeof item === 'object' &&
            typeof (item as ArchiveRecord).folder === 'string'
          )
        })
        .map((item) => ({
          folder: item.folder,
          originalPath: typeof item.originalPath === 'string' ? item.originalPath : '',
          archivedAt:
            typeof item.archivedAt === 'string' ? item.archivedAt : new Date().toISOString(),
        }))
    }
  } catch {
    /* 没有归档清单 */
  }
  return []
}

export function writeArchiveManifest(rootPath: string, records: ArchiveRecord[]): void {
  const dir = path.join(rootPath, ARCHIVE_DIR)
  writeFileAtomic(path.join(dir, ARCHIVE_MANIFEST), `${JSON.stringify(records, null, 2)}\n`)
}

interface ArchiveCounts {
  nodeCount: number
  diaryCount: number
}

function countTree(dir: string): ArchiveCounts {
  let nodeCount = 1
  let diaryCount = listMarkdownFiles(dir).length
  for (const entry of childDirectories(dir)) {
    const child = countTree(path.join(dir, entry.name))
    nodeCount += child.nodeCount
    diaryCount += child.diaryCount
  }
  return { nodeCount, diaryCount }
}

export function listArchived(rootPath: string): ArchivedNode[] {
  const archiveDir = path.join(rootPath, ARCHIVE_DIR)
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(archiveDir, { withFileTypes: true })
  } catch {
    return []
  }

  const manifest = readArchiveManifest(rootPath)
  const byFolder = new Map(manifest.map((record) => [record.folder, record]))
  const result: ArchivedNode[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || shouldSkipDir(entry.name)) continue
    const dir = path.join(archiveDir, entry.name)
    const record = byFolder.get(entry.name)
    let archivedAt = record?.archivedAt
    if (!archivedAt) {
      try {
        archivedAt = fs.statSync(dir).mtime.toISOString()
      } catch {
        archivedAt = new Date().toISOString()
      }
    }
    const counts = countTree(dir)
    result.push({
      id: entry.name,
      name: entry.name,
      originalPath: record?.originalPath ?? '',
      archivedAt,
      nodeCount: counts.nodeCount,
      diaryCount: counts.diaryCount,
    })
  }

  result.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
  return result
}

export function scanTree(rootPath: string): TreeSnapshot {
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true })
  }
  const config: Config = loadConfig(rootPath)
  const params = resolveParams(config)

  const nodes: TreeNode[] = childDirectories(rootPath).map((entry) =>
    buildNode(path.join(rootPath, entry.name), entry.name, entry.name, 1, params),
  )

  const nodeCount = nodes.reduce((sum, node) => sum + 1 + node.descendantCount, 0)
  const allDiaries: DiaryEntry[] = []
  let litCount = 0
  let maxDepth = 0
  const walk = (node: TreeNode): void => {
    allDiaries.push(...node.diaries)
    if (node.litAt) litCount += 1
    maxDepth = Math.max(maxDepth, node.depth)
    node.children.forEach(walk)
  }
  nodes.forEach(walk)

  const topMarks = nodes.reduce((sum, node) => sum + node.marks, 0)
  const centerMarks = params.alpha * topMarks
  const center: CenterStats = {
    marks: centerMarks,
    brightness: brightnessOf(centerMarks, params.kMin),
    nodeCount,
    diaryCount: allDiaries.length,
    litCount,
    maxDepth,
    lastEntryAt:
      allDiaries.length > 0
        ? allDiaries.reduce((latest, entry) => (entry.mtime > latest ? entry.mtime : latest), '')
        : null,
  }

  return {
    rootPath,
    rootName: path.basename(rootPath) || rootPath,
    center,
    nodes,
    archived: listArchived(rootPath),
    config,
    params,
    scannedAt: new Date().toISOString(),
  }
}
