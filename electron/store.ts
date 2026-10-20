import fs from 'node:fs'
import path from 'node:path'
import type {
  Config,
  CreateNodeInput,
  DiaryInput,
  DiaryUpdateInput,
  RenameNodeResult,
  TreeSnapshot,
  UpdateNodeInput,
} from '../shared/types'
import {
  ARCHIVE_DIR,
  ensureConfigFile,
  normalizeDifficulty,
  saveConfig,
} from './config'
import {
  NODE_META_FILE,
  assertNodeDir,
  joinId,
  localDateStamp,
  normalizeNodeName,
  parseDiary,
  readArchiveManifest,
  readNodeMeta,
  resolveInside,
  scanTree,
  serializeDiary,
  uniqueDiaryName,
  writeArchiveManifest,
  writeNodeMeta,
} from './core'

/** 数据根目录不存在时创建，并保证有一份 config.json 可读可改 */
export function ensureDataRoot(rootPath: string): void {
  fs.mkdirSync(rootPath, { recursive: true })
  ensureConfigFile(rootPath)
}

/** 只允许操作树里的普通节点；归档区 / 隐藏目录 / 越界路径一律拒绝 */
export function assertTreeId(id: string): void {
  if (typeof id !== 'string') throw new Error('节点路径无效')
  for (const segment of id.split('/')) {
    if (!segment) continue
    if (segment === ARCHIVE_DIR) throw new Error('归档区不在树上，不能这样操作')
    if (segment.startsWith('.')) throw new Error('隐藏目录不在树上，不能这样操作')
  }
}

export function nodeDir(rootPath: string, id: string): string {
  assertTreeId(id)
  return resolveInside(rootPath, id)
}

function assertNotCenter(id: string): void {
  if (!id) throw new Error('中心圆是你自己，它没有独立的状态文件')
}

function assertDiaryName(name: string): void {
  if (
    typeof name !== 'string' ||
    !/\.md$/i.test(name) ||
    name.includes('/') ||
    name.includes('\\') ||
    name.startsWith('.')
  ) {
    throw new Error('日记文件名无效')
  }
}

function moveDir(src: string, dest: string): void {
  try {
    fs.renameSync(src, dest)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EXDEV' || code === 'EPERM' || code === 'EACCES') {
      fs.cpSync(src, dest, { recursive: true })
      fs.rmSync(src, { recursive: true, force: true })
      return
    }
    throw err
  }
}

/* ------------------------------------------------------------------ */
/* 节点                                                                */
/* ------------------------------------------------------------------ */

export function createNode(rootPath: string, input: CreateNodeInput): TreeSnapshot {
  if (!input || typeof input !== 'object') throw new Error('参数无效')
  const parentId = typeof input.parentId === 'string' ? input.parentId : ''
  const parentDir = nodeDir(rootPath, parentId)
  assertNodeDir(parentDir)

  const name = normalizeNodeName(input.name)
  const target = path.join(parentDir, name)
  if (fs.existsSync(target)) throw new Error(`「${name}」已经存在了`)

  const description =
    typeof input.description === 'string' ? input.description.trim().slice(0, 4000) : ''
  const difficulty = normalizeDifficulty(input.difficulty)

  fs.mkdirSync(target)
  try {
    writeNodeMeta(target, {
      raw: {},
      description,
      difficulty,
      litAt: null,
    })
  } catch (err) {
    try {
      fs.rmSync(target, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    throw err
  }
  return scanTree(rootPath)
}

export function updateNode(rootPath: string, input: UpdateNodeInput): TreeSnapshot {
  if (!input || typeof input.id !== 'string') throw new Error('参数无效')
  assertNotCenter(input.id)
  const dir = nodeDir(rootPath, input.id)
  assertNodeDir(dir)

  const meta = readNodeMeta(dir)
  if (typeof input.description === 'string') {
    meta.description = input.description.trim().slice(0, 4000)
  }
  if (input.difficulty !== undefined) {
    meta.difficulty = normalizeDifficulty(input.difficulty)
  }
  writeNodeMeta(dir, meta)
  return scanTree(rootPath)
}

export function renameNode(rootPath: string, id: string, nextName: string): RenameNodeResult {
  assertNotCenter(id)
  const dir = nodeDir(rootPath, id)
  assertNodeDir(dir)

  const name = normalizeNodeName(nextName)
  const parentId = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : ''
  const parentDir = path.dirname(dir)
  const target = path.join(parentDir, name)

  if (target === dir) return { snapshot: scanTree(rootPath), oldId: id, newId: id }
  if (fs.existsSync(target)) throw new Error(`「${name}」已经存在了`)

  fs.renameSync(dir, target)
  const newId = joinId(parentId, name)
  return { snapshot: scanTree(rootPath), oldId: id, newId }
}

export function setLit(rootPath: string, id: string, lit: boolean): TreeSnapshot {
  assertNotCenter(id)
  const dir = nodeDir(rootPath, id)
  assertNodeDir(dir)
  const meta = readNodeMeta(dir)
  meta.litAt = lit ? new Date().toISOString() : null
  writeNodeMeta(dir, meta)
  return scanTree(rootPath)
}

/* ------------------------------------------------------------------ */
/* 日记                                                                */
/* ------------------------------------------------------------------ */

function assertDiaryContent(content: string): string {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('写点什么再记下吧')
  }
  if (content.length > 100_000) throw new Error('这一篇太长了，请分成几篇记录')
  return content.trim()
}

export function writeDiary(rootPath: string, input: DiaryInput): TreeSnapshot {
  if (!input || typeof input.id !== 'string') throw new Error('参数无效')
  assertNotCenter(input.id)
  const dir = nodeDir(rootPath, input.id)
  assertNodeDir(dir)

  const content = assertDiaryContent(input.content)
  const deep = input.deep === true
  const date = localDateStamp()
  const name = uniqueDiaryName(dir, date)
  const raw = serializeDiary(date, deep, content)

  try {
    fs.writeFileSync(path.join(dir, name), raw, { encoding: 'utf8', flag: 'wx' })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EEXIST') {
      const fallback = uniqueDiaryName(dir, date)
      fs.writeFileSync(path.join(dir, fallback), raw, { encoding: 'utf8', flag: 'wx' })
    } else {
      throw err
    }
  }
  return scanTree(rootPath)
}

export function updateDiary(rootPath: string, input: DiaryUpdateInput): TreeSnapshot {
  if (!input || typeof input.id !== 'string') throw new Error('参数无效')
  assertNotCenter(input.id)
  assertDiaryName(input.name)
  const dir = nodeDir(rootPath, input.id)
  assertNodeDir(dir)

  const file = path.join(dir, input.name)
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    throw new Error('这篇记录已经不在了')
  }
  const stat = fs.statSync(file)
  const parsed = parseDiary(raw, input.name, stat.mtime)
  const content = assertDiaryContent(input.content)
  fs.writeFileSync(file, serializeDiary(parsed.date, input.deep === true, content), 'utf8')
  return scanTree(rootPath)
}

export function deleteDiary(rootPath: string, id: string, name: string): TreeSnapshot {
  assertNotCenter(id)
  assertDiaryName(name)
  const dir = nodeDir(rootPath, id)
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) throw new Error('这篇记录已经不在了')
  fs.unlinkSync(file)
  return scanTree(rootPath)
}

/* ------------------------------------------------------------------ */
/* 归档 = 剪枝，不删除历史                                             */
/* ------------------------------------------------------------------ */

export function archiveNode(rootPath: string, id: string): TreeSnapshot {
  assertNotCenter(id)
  const dir = nodeDir(rootPath, id)
  assertNodeDir(dir)

  const archiveDir = path.join(rootPath, ARCHIVE_DIR)
  fs.mkdirSync(archiveDir, { recursive: true })

  const baseName = path.basename(dir)
  let folder = baseName
  for (let i = 2; fs.existsSync(path.join(archiveDir, folder)); i += 1) {
    folder = `${baseName}-${i}`
  }
  const dest = path.join(archiveDir, folder)

  const records = readArchiveManifest(rootPath)
  moveDir(dir, dest)
  records.push({ folder, originalPath: id, archivedAt: new Date().toISOString() })

  try {
    writeArchiveManifest(rootPath, records)
  } catch (err) {
    // 清单写不进去就把文件夹搬回去，别让树上凭空少一枝
    try {
      moveDir(dest, dir)
    } catch {
      /* ignore */
    }
    throw err
  }
  return scanTree(rootPath)
}

export function restoreArchived(rootPath: string, archivedId: string): TreeSnapshot {
  if (
    typeof archivedId !== 'string' ||
    !archivedId ||
    archivedId.includes('/') ||
    archivedId.includes('\\') ||
    archivedId.startsWith('.')
  ) {
    throw new Error('归档项无效')
  }

  const src = path.join(rootPath, ARCHIVE_DIR, archivedId)
  assertNodeDir(src)

  const records = readArchiveManifest(rootPath)
  const index = records.findIndex((record) => record.folder === archivedId)
  const originalPath = index >= 0 ? records[index].originalPath : archivedId

  let dest = originalPath ? resolveInside(rootPath, originalPath) : path.join(rootPath, archivedId)
  if (!fs.existsSync(path.dirname(dest))) {
    // 原来的父节点可能也被归档了：退回根目录，至少让这枝回到树上
    dest = path.join(rootPath, path.basename(dest))
  }
  if (fs.existsSync(dest)) {
    throw new Error('原位置已经有同名文件夹，请先整理它')
  }

  moveDir(src, dest)
  if (index >= 0) {
    records.splice(index, 1)
    writeArchiveManifest(rootPath, records)
  }
  return scanTree(rootPath)
}

/* ------------------------------------------------------------------ */
/* 配置                                                                */
/* ------------------------------------------------------------------ */

export function updateConfig(rootPath: string, patch: Partial<Config>): TreeSnapshot {
  saveConfig(rootPath, patch)
  return scanTree(rootPath)
}

export function getSnapshot(rootPath: string): TreeSnapshot {
  ensureDataRoot(rootPath)
  return scanTree(rootPath)
}

export { NODE_META_FILE }
