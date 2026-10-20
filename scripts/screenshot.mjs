#!/usr/bin/env node
/**
 * 启动 Electron 并截图，用于视觉验收。
 * 用法：node scripts/screenshot.mjs <数据目录> <输出png> [dark|light] [节点id] [滚动像素]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const electron = require('electron')

const [, , dataDir, output, theme = 'dark', nodeId, scroll] = process.argv
if (!dataDir || !output) {
  console.error(
    '用法：node scripts/screenshot.mjs <数据目录> <输出png> [dark|light] [节点id] [滚动像素]',
  )
  process.exit(1)
}
if (!fs.existsSync(electron)) {
  console.error(`找不到 Electron：${electron}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })

const env = {
  ...process.env,
  SKILL_TREE_DATA_DIR: path.resolve(dataDir),
  SKILL_TREE_SHOT: path.resolve(output),
  SKILL_TREE_SHOT_DELAY: '2600',
  SKILL_TREE_THEME: theme,
}
// 当前终端可能继承了 ELECTRON_RUN_AS_NODE，会让 electron 以 Node 模式运行
delete env.ELECTRON_RUN_AS_NODE
if (nodeId) env.SKILL_TREE_SHOT_NODE = nodeId
if (scroll) env.SKILL_TREE_SHOT_SCROLL = String(scroll)

const child = spawn(
  electron,
  [
    '.',
    '--no-sandbox',
    `--user-data-dir=${path.join(ROOT, '.test-data', 'electron-profile', theme)}`,
  ],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  },
)

const timer = setTimeout(() => {
  console.error('截图超时，结束进程')
  child.kill()
  process.exit(2)
}, 60_000)

child.on('exit', (code) => {
  clearTimeout(timer)
  process.exit(code ?? 0)
})
