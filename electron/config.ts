import fs from 'node:fs'
import path from 'node:path'
import type { Config, Preferences, ThemeMode, TreeParams } from '../shared/types'

export const CONFIG_FILE = 'config.json'
export const ARCHIVE_DIR = '_archived'
export const ARCHIVE_MANIFEST = '.archive.json'

/** 已定稿的节奏参数（第 5.2 / 10 章） */
export const DEFAULT_PARAMS: TreeParams = {
  alpha: 0.6,
  kMin: 0.00025,
  kMax: 0.001,
}

export const DEFAULT_BASE_URL = 'https://api.deepseek.com'
export const DEFAULT_MODEL = 'deepseek-chat'

export const DEFAULT_CONFIG: Required<Pick<Config, 'apiKey' | 'baseUrl' | 'model' | 'alpha' | 'kMin' | 'kMax' | 'preferences'>> = {
  apiKey: '',
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
  alpha: DEFAULT_PARAMS.alpha,
  kMin: DEFAULT_PARAMS.kMin,
  kMax: DEFAULT_PARAMS.kMax,
  preferences: { theme: 'system' as ThemeMode },
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 只接受 0–1 的难度；非法值回落到 0.5 */
export function normalizeDifficulty(value: unknown): number {
  if (!isFiniteNumber(value)) return 0.5
  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000))
}

/** 校验并修正节奏参数，避免用户把 alpha 改成 1 或 k 改成 0 让亮度失真 */
export function resolveParams(config: Partial<Config> | null | undefined): TreeParams {
  const c = config ?? {}
  let alpha = isFiniteNumber(c.alpha) ? c.alpha : DEFAULT_PARAMS.alpha
  if (alpha <= 0.05 || alpha >= 0.95) alpha = DEFAULT_PARAMS.alpha

  let kMin = isFiniteNumber(c.kMin) && c.kMin > 0 ? c.kMin : DEFAULT_PARAMS.kMin
  let kMax = isFiniteNumber(c.kMax) && c.kMax > 0 ? c.kMax : DEFAULT_PARAMS.kMax
  kMin = Math.min(Math.max(kMin, 0.000001), 0.2)
  kMax = Math.min(Math.max(kMax, 0.000001), 0.2)
  if (kMin > kMax) [kMin, kMax] = [kMax, kMin]

  return {
    alpha: Math.round(alpha * 10000) / 10000,
    kMin: Math.round(kMin * 100000000) / 100000000,
    kMax: Math.round(kMax * 100000000) / 100000000,
  }
}

function normalizePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const prefs: Preferences = {}
  if (raw.theme === 'dark' || raw.theme === 'light' || raw.theme === 'system') {
    prefs.theme = raw.theme
  }
  if (isFiniteNumber(raw.splitRatio)) {
    prefs.splitRatio = Math.min(0.5, Math.max(0.16, raw.splitRatio))
  }
  if (typeof raw.lastSelectedId === 'string') {
    prefs.lastSelectedId = raw.lastSelectedId
  }
  // 保留用户/未来版本写入的其他偏好
  for (const [key, val] of Object.entries(raw)) {
    if (!(key in prefs)) prefs[key] = val
  }
  return prefs
}

/** 读取并补全 config.json（不认识的字段原样保留） */
export function loadConfig(rootPath: string): Config {
  const file = path.join(rootPath, CONFIG_FILE)
  let raw: Record<string, unknown> = {}
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      raw = parsed as Record<string, unknown>
    }
  } catch {
    // 文件不存在 / 被占 / JSON 写坏：都回落到默认值，不阻塞扫树
  }

  const params = resolveParams(raw as Partial<Config>)
  const baseUrl =
    typeof raw.baseUrl === 'string' && raw.baseUrl.trim()
      ? raw.baseUrl.trim()
      : DEFAULT_BASE_URL
  const model =
    typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : DEFAULT_MODEL

  return {
    ...raw,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
    baseUrl,
    model,
    alpha: params.alpha,
    kMin: params.kMin,
    kMax: params.kMax,
    preferences: normalizePreferences(raw.preferences),
  }
}

export function writeConfigFile(rootPath: string, config: Config): void {
  writeFileAtomic(path.join(rootPath, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`)
}

/**
 * 合并式保存：只覆盖传入的字段，保留用户手改的未知字段。
 * 节奏参数经 resolveParams 校正后再写入，保证文件里的值一定可用。
 */
export function saveConfig(rootPath: string, patch: Partial<Config>): Config {
  const current = loadConfig(rootPath)
  const next: Config = { ...current, ...patch }

  if (patch.preferences) {
    next.preferences = normalizePreferences({
      ...(current.preferences ?? {}),
      ...patch.preferences,
    })
  }
  if (patch.alpha !== undefined || patch.kMin !== undefined || patch.kMax !== undefined) {
    const params = resolveParams({ ...current, ...patch })
    next.alpha = params.alpha
    next.kMin = params.kMin
    next.kMax = params.kMax
  }
  if (typeof next.apiKey === 'string') next.apiKey = next.apiKey.trim()
  if (typeof next.baseUrl === 'string') {
    next.baseUrl = next.baseUrl.trim() || DEFAULT_BASE_URL
  }
  if (typeof next.model === 'string') {
    next.model = next.model.trim() || DEFAULT_MODEL
  }

  writeConfigFile(rootPath, next)
  return loadConfig(rootPath)
}

export function ensureConfigFile(rootPath: string): void {
  const file = path.join(rootPath, CONFIG_FILE)
  if (!fs.existsSync(file)) {
    writeConfigFile(rootPath, { ...DEFAULT_CONFIG })
  }
}

/** 先写临时文件再改名，避免半个 JSON 被 Obsidian/编辑器读到 */
export function writeFileAtomic(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, content, 'utf8')
  try {
    fs.renameSync(tmp, file)
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true })
    } catch {
      /* ignore */
    }
    throw err
  }
}
