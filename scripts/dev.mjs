#!/usr/bin/env node
/**
 * 开发模式：启动 Vite（渲染进程热更新）→ 启动 Electron（主进程）。
 * 修改 electron/*.ts 后需要重新运行本命令。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const electronBinary = require('electron')

const server = await createServer({
  configFile: path.join(ROOT, 'vite.config.ts'),
})
await server.listen()
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5173/'
console.log(`[dev] 渲染进程：${url}`)

const profile = path.join(ROOT, '.dev-profile')
fs.mkdirSync(profile, { recursive: true })

const env = { ...process.env, VITE_DEV_SERVER_URL: url }
delete env.ELECTRON_RUN_AS_NODE

const args = ['.', `--user-data-dir=${profile}`]
if (process.env.SKILL_TREE_NO_SANDBOX === '1') args.push('--no-sandbox')

const child = spawn(electronBinary, args, {
  cwd: ROOT,
  stdio: 'inherit',
  env,
})

let closing = false

async function shutdown(code) {
  if (closing) return
  closing = true
  try {
    await server.close()
  } catch {
    /* ignore */
  }
  process.exit(code)
}

child.on('exit', (code) => {
  void shutdown(code ?? 0)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill()
    void shutdown(0)
  })
}
