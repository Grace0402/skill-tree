#!/usr/bin/env node
/**
 * 核心逻辑验收脚本：
 * - 记号递归 + α 逐层衰减
 * - 亮度渐近线公式（30 天 ≈ 3%）
 * - 深度投入 = 2 个记号
 * - 文件夹即树、日记冲突、归档/恢复、重命名、外部改名
 * 用法：npm test
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const core = require(path.join(ROOT, 'dist-electron/electron/core.js'))
const store = require(path.join(ROOT, 'dist-electron/electron/store.js'))

const ALPHA = 0.6
const K_MIN = 0.00025
const K_MAX = 0.001

const testRoot = path.join(ROOT, '.test-data', `core-${process.pid}`)

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function near(a, b, epsilon = 1e-9) {
  return Math.abs(a - b) <= epsilon
}

function freshDir(name) {
  const dir = path.join(testRoot, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function writeNode(dir, meta = {}) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '.node.json'), JSON.stringify(meta, null, 2))
  return dir
}

function writeDiary(dir, name, { deep = false, content = '今天练了一会儿。', date = name.slice(0, 10) } = {}) {
  fs.mkdirSync(dir, { recursive: true })
  const front = ['---', `date: ${date}`]
  if (deep) front.push('deep: true')
  front.push('---', '', content)
  fs.writeFileSync(path.join(dir, name), `${front.join('\n')}\n`)
}

function findNode(snapshot, id) {
  let found = null
  const walk = (node) => {
    if (node.id === id) found = node
    node.children.forEach(walk)
  }
  snapshot.nodes.forEach(walk)
  return found
}

function brightnessOf(marks, k) {
  return 100 * (1 - Math.exp(-k * marks))
}

/* ------------------------------------------------------------------ */
console.log('\n【1】空树开局')
{
  const dir = freshDir('empty')
  const snapshot = core.scanTree(dir)
  check('没有任何节点', snapshot.nodes.length === 0)
  check('中心圆亮度为 0', snapshot.center.brightness === 0)
  check('中心圆记号数为 0', snapshot.center.marks === 0)
  check('归档区为空', snapshot.archived.length === 0)
  check('没有预置文件夹', fs.readdirSync(dir).filter((n) => !n.startsWith('.')).length === 0)
}

/* ------------------------------------------------------------------ */
console.log('\n【2】30 天记录 → 最容易的节点约 3%')
{
  const dir = freshDir('thirty-days')
  const nodeDir = writeNode(path.join(dir, '背单词'), { description: '每天记一点', difficulty: 0 })
  for (let i = 1; i <= 30; i += 1) {
    const day = String(i).padStart(2, '0')
    writeDiary(nodeDir, `2026-09-${day}.md`, { date: `2026-09-${day}`, content: `第 ${i} 天` })
  }
  const snapshot = core.scanTree(dir)
  const node = snapshot.nodes[0]
  check('30 个文件 = 30 个记号', node.marks === 30, `实际 ${node.marks}`)
  check(
    '亮度 ≈ 2.955%（kMax）',
    near(node.brightness, brightnessOf(30, K_MAX), 1e-9),
    `实际 ${node.brightness}`,
  )
  check('亮度落在 2.9%–3.0%', node.brightness > 2.9 && node.brightness < 3.0)
  check('中心圆只收到 α 衰减后的一份', near(snapshot.center.marks, ALPHA * 30, 1e-9))
  check('中心圆永远小于 100', snapshot.center.brightness < 100)
  check(
    '中心圆亮度低于技能节点',
    snapshot.center.brightness < node.brightness,
    `${snapshot.center.brightness} vs ${node.brightness}`,
  )
}

/* ------------------------------------------------------------------ */
console.log('\n【3】逐层传递 + 深度投入')
{
  const dir = freshDir('cascade')
  const root = writeNode(path.join(dir, '沟通表达'), { difficulty: 0.7 })
  const mid = writeNode(path.join(root, '口才'), { difficulty: 0.7 })
  const leaf = writeNode(path.join(mid, '脱稿演讲'), { difficulty: 0.7 })
  writeDiary(leaf, '2026-10-01.md', { deep: true, content: '脱稿讲了 10 分钟。' })
  writeDiary(leaf, '2026-10-02.md', { content: '又练了一次。' })

  const snapshot = core.scanTree(dir)
  const leafNode = findNode(snapshot, '沟通表达/口才/脱稿演讲')
  const midNode = findNode(snapshot, '沟通表达/口才')
  const topNode = findNode(snapshot, '沟通表达')

  check('深度投入记 2 个记号，普通记 1 个', leafNode.ownMarks === 3, `实际 ${leafNode.ownMarks}`)
  check('父节点收到 α × 3', near(midNode.marks, ALPHA * 3, 1e-9), `实际 ${midNode.marks}`)
  check('祖父收到 α² × 3', near(topNode.marks, ALPHA ** 2 * 3, 1e-9), `实际 ${topNode.marks}`)
  check('中心收到 α³ × 3', near(snapshot.center.marks, ALPHA ** 3 * 3, 1e-9))
  check('父节点亮度低于叶子', midNode.brightness < leafNode.brightness)
  check('祖父亮度低于父节点', topNode.brightness < midNode.brightness)
  check('中心亮度低于顶层节点', snapshot.center.brightness < topNode.brightness)
  check('中心永远 < 100', snapshot.center.brightness < 100)
}

/* ------------------------------------------------------------------ */
console.log('\n【4】亮度不会到 100')
{
  const dir = freshDir('asymptote')
  const nodeDir = writeNode(path.join(dir, '永远学不完'), { difficulty: 0 })
  for (let i = 0; i < 500; i += 1) {
    writeDiary(nodeDir, `2026-01-01-${i}.md`, { date: '2026-01-01' })
  }
  const node = core.scanTree(dir).nodes[0]
  check('500 个记号后仍 < 100', node.brightness < 100, `实际 ${node.brightness}`)
  check('500 个记号已经明显变亮', node.brightness > 30)
  check('公式与扫描结果一致', near(node.brightness, brightnessOf(500, K_MAX), 1e-9))
}

/* ------------------------------------------------------------------ */
console.log('\n【5】frontmatter 解析（含 Obsidian 手写格式）')
{
  const parsed = core.parseDiary(
    '---\r\ndate: 2026-10-17\r\ndeep: true # 深度投入\r\n---\r\n\r\n今天脱稿练了很久。\r\n',
    '2026-10-17.md',
    new Date('2026-10-17T10:00:00Z'),
  )
  check('读取 date', parsed.date === '2026-10-17')
  check('读取 deep', parsed.deep === true)
  check('正文去掉了 frontmatter', parsed.content.trim() === '今天脱稿练了很久。')
  check('deep 记 2 个记号', core.marksForDiary(parsed.deep) === 2)

  const plain = core.parseDiary('没有 frontmatter 的正文', '2026-10-18.md', new Date())
  check('没有 frontmatter 也能读', plain.content === '没有 frontmatter 的正文')
  check('日期回落到文件名', plain.date === '2026-10-18')
  check('默认普通 = 1 个记号', core.marksForDiary(plain.deep) === 1)
}

/* ------------------------------------------------------------------ */
console.log('\n【6】Windows 编辑器写入的 BOM 不会让配置失效')
{
  const dir = freshDir('bom')
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    `\uFEFF${JSON.stringify({ alpha: 0.5, preferences: { theme: 'light' } }, null, 2)}`,
  )
  const nodeDir = writeNode(path.join(dir, '带 BOM 的节点'), { description: '手写元数据' })
  fs.writeFileSync(
    path.join(nodeDir, '.node.json'),
    `\uFEFF${JSON.stringify({ description: '带 BOM 也能读', difficulty: 0.4 }, null, 2)}`,
  )
  const snapshot = core.scanTree(dir)
  check('读取带 BOM 的 config.json', snapshot.config.preferences.theme === 'light')
  check('节奏参数生效', snapshot.params.alpha === 0.5)
  check('读取带 BOM 的 .node.json', snapshot.nodes[0].description === '带 BOM 也能读')
}

/* ------------------------------------------------------------------ */
console.log('\n【7】文件夹操作：新建 / 写日记 / 同日冲突 / 改名')
{
  const dir = freshDir('operations')
  let snapshot = store.createNode(dir, {
    parentId: '',
    name: '测试枝',
    description: '能稳定地完成一件事',
    difficulty: 0.42,
  })
  const node = snapshot.nodes[0]
  check('新建了文件夹', fs.existsSync(node.path))
  const meta = JSON.parse(fs.readFileSync(path.join(node.path, '.node.json'), 'utf8'))
  check('写入了 description', meta.description === '能稳定地完成一件事')
  check('写入了 difficulty', near(meta.difficulty, 0.42))
  check('没有把亮度写进 .node.json', !('brightness' in meta) && !('marks' in meta))
  check('没有把记号数写进 .node.json', !('markCount' in meta))

  snapshot = store.writeDiary(dir, { id: node.id, content: '第一次记录', deep: false })
  const firstDiary = fs.readdirSync(node.path).find((f) => f.endsWith('.md'))
  check('生成了 YYYY-MM-DD.md', /^\d{4}-\d{2}-\d{2}\.md$/.test(firstDiary), firstDiary)
  check('一个文件 = 1 个记号', findNode(snapshot, node.id).ownMarks === 1)

  snapshot = store.writeDiary(dir, { id: node.id, content: '同一天再记一次', deep: false })
  const files = fs.readdirSync(node.path).filter((f) => f.endsWith('.md')).sort()
  check('同日冲突自动加后缀', files.some((f) => /^\d{4}-\d{2}-\d{2}-2\.md$/.test(f)), files.join(','))
  check('两篇记录 = 2 个记号', findNode(snapshot, node.id).ownMarks === 2)

  snapshot = store.writeDiary(dir, { id: node.id, content: '这一天很投入', deep: true })
  check('深度投入让记号 +2', findNode(snapshot, node.id).ownMarks === 4)

  const renamed = store.renameNode(dir, node.id, '改名后的枝')
  check('重命名返回新 id', renamed.newId === '改名后的枝')
  check('旧文件夹已消失', !fs.existsSync(node.path))
  check('新文件夹已出现', fs.existsSync(path.join(dir, '改名后的枝')))
  check('日记跟着文件夹走', fs.readdirSync(path.join(dir, '改名后的枝')).filter((f) => f.endsWith('.md')).length === 3)
  check('改名后亮度不变', near(findNode(renamed.snapshot, '改名后的枝').marks, 4))

  const invalid = (() => {
    try {
      store.createNode(dir, { parentId: '', name: 'bad/name', description: '', difficulty: 0.5 })
      return null
    } catch (error) {
      return error.message
    }
  })()
  check('拒绝非法名称', Boolean(invalid && invalid.includes('不能包含')), String(invalid))

  const reserved = (() => {
    try {
      store.createNode(dir, { parentId: '', name: '_archived', description: '', difficulty: 0.5 })
      return null
    } catch (error) {
      return error.message
    }
  })()
  check('拒绝归档区专用名', Boolean(reserved), String(reserved))
}

/* ------------------------------------------------------------------ */
console.log('\n【8】归档 = 剪枝，不删历史；可恢复')
{
  const dir = freshDir('archive')
  store.createNode(dir, { parentId: '', name: '会被剪下的枝', description: '', difficulty: 0.5 })
  store.createNode(dir, { parentId: '会被剪下的枝', name: '子技能', description: '', difficulty: 0.5 })
  let snapshot = store.writeDiary(dir, {
    id: '会被剪下的枝/子技能',
    content: '这段历史不能被删掉。',
    deep: false,
  })
  const before = findNode(snapshot, '会被剪下的枝/子技能')
  check('归档前有 1 篇日记', before.ownDiaryCount === 1)

  snapshot = store.archiveNode(dir, '会被剪下的枝')
  check('树上不再显示', snapshot.nodes.length === 0)
  check('归档区出现一项', snapshot.archived.length === 1)
  check('归档项记得原来的位置', snapshot.archived[0].originalPath === '会被剪下的枝')
  check('文件夹进入 _archived', fs.existsSync(path.join(dir, '_archived', '会被剪下的枝')))
  check('原文件夹消失', !fs.existsSync(path.join(dir, '会被剪下的枝')))
  check(
    '日记仍然存在',
    fs.existsSync(path.join(dir, '_archived', '会被剪下的枝', '子技能', `${new Date().toISOString().slice(0, 10)}.md`)) ||
      fs.readdirSync(path.join(dir, '_archived', '会被剪下的枝', '子技能')).some((f) => f.endsWith('.md')),
  )

  snapshot = store.restoreArchived(dir, snapshot.archived[0].id)
  check('恢复到原位置', fs.existsSync(path.join(dir, '会被剪下的枝', '子技能')))
  check('树上重新出现', Boolean(findNode(snapshot, '会被剪下的枝/子技能')))
  check('归档区清空', snapshot.archived.length === 0)
  check(
    '历史还在',
    findNode(snapshot, '会被剪下的枝/子技能').ownDiaryCount === 1,
  )
}

/* ------------------------------------------------------------------ */
console.log('\n【9】外部改名 / 外部加日记 会被重新扫描到')
{
  const dir = freshDir('external')
  const nodeDir = writeNode(path.join(dir, '旧名字'), { difficulty: 0.3 })
  writeDiary(nodeDir, '2026-10-10.md')
  let snapshot = core.scanTree(dir)
  check('先看到旧名字', snapshot.nodes[0].name === '旧名字')

  fs.renameSync(nodeDir, path.join(dir, '新名字'))
  snapshot = core.scanTree(dir)
  check('重命名文件夹后树上更新', snapshot.nodes[0].name === '新名字')
  check('亮度重算正确', snapshot.nodes[0].marks === 1)

  writeDiary(path.join(dir, '新名字'), '2026-10-11.md', { deep: true })
  snapshot = core.scanTree(dir)
  check('外部新增日记被统计', snapshot.nodes[0].ownMarks === 3)
}

/* ------------------------------------------------------------------ */
console.log('\n【10】路径安全')
{
  const dir = freshDir('security')
  const outside = (() => {
    try {
      core.resolveInside(dir, '../../Windows')
      return null
    } catch (error) {
      return error.message
    }
  })()
  check('拒绝越界路径', outside === '节点路径越界', String(outside))

  const absolute = (() => {
    try {
      core.resolveInside(dir, 'C:/Windows')
      return null
    } catch (error) {
      return error.message
    }
  })()
  check('拒绝绝对路径', Boolean(absolute), String(absolute))
}

/* ------------------------------------------------------------------ */
console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} 项通过，${failed} 项失败\n`)
fs.rmSync(testRoot, { recursive: true, force: true })
process.exit(failed === 0 ? 0 : 1)
