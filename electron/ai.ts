import type { Config, SuggestDifficultyResult } from '../shared/types'
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from './config'

function endpointOf(baseUrl: string): string {
  let base = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`
  if (/\/chat\/completions$/i.test(base)) return base
  return `${base}/chat/completions`
}

const SYSTEM_PROMPT = [
  '你是一个技能难度评估器。',
  '你只评估「这项技能本身的难度」，不评价用户当前水平，不夸奖、不鼓励、不建议学习路径。',
  '难度是 0~1 的连续值：0 = 极容易（几小时到几天就能学会），1 = 极难（需要多年刻意练习）。',
  '只输出一个 JSON 对象，不要输出任何其他文字，格式：',
  '{"difficulty": 0.0~1.0 的数字, "reason": "不超过20字的一句话理由"}',
].join('\n')

function buildUserPrompt(name: string, description: string): string {
  return [
    `用户想学的技能：${name || '（未命名）'}`,
    '用户描述：',
    description,
  ].join('\n')
}

function parseModelJson(content: string): { difficulty: number; reason: string } {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI 返回的内容不是 JSON，请重试或手动拖动难度')
  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(start, end + 1))
  } catch {
    throw new Error('AI 返回的内容无法解析，请重试或手动拖动难度')
  }
  const obj = parsed as { difficulty?: unknown; reason?: unknown }
  const raw = typeof obj.difficulty === 'string' ? Number(obj.difficulty) : obj.difficulty
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new Error('AI 没有给出有效难度，请重试或手动拖动难度')
  }
  const difficulty = Math.min(1, Math.max(0, Math.round(raw * 100) / 100))
  const reason =
    typeof obj.reason === 'string' && obj.reason.trim()
      ? obj.reason.trim().slice(0, 40)
      : 'AI 建议难度'
  return { difficulty, reason }
}

/**
 * 仅用于「新建节点时建议难度」。
 * 日记内容永远不会被发送到这里；没有 apiKey 时前端不会调用。
 */
export async function suggestDifficulty(
  config: Config,
  name: string,
  description: string,
): Promise<SuggestDifficultyResult> {
  const apiKey = (config.apiKey ?? '').trim()
  if (!apiKey) throw new Error('还没有配置 API Key，请到设置里填写，或直接手动调难度')
  if (!description.trim()) throw new Error('先写一句你想达到的样子，AI 才有依据')

  const model = (config.model || DEFAULT_MODEL).trim()
  let response: Response
  try {
    response = await fetch(endpointOf(config.baseUrl || DEFAULT_BASE_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 200,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(name, description.trim()) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    })
  } catch (err) {
    const name_ = (err as Error).name
    if (name_ === 'TimeoutError' || name_ === 'AbortError') {
      throw new Error('AI 请求超时了，请检查网络后重试')
    }
    throw new Error('连不上 AI 服务，请检查网络或接口地址')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('API Key 无效或没有权限，请到设置里检查')
    }
    if (response.status === 404) {
      throw new Error('接口地址不对，baseUrl 一般填 https://api.deepseek.com')
    }
    if (response.status === 429) {
      throw new Error('AI 服务忙或额度不足，请稍后再试')
    }
    throw new Error(`AI 服务返回 ${response.status}，请稍后再试`)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('AI 服务的响应无法读取')
  }
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 没有返回内容，请重试')
  }
  return parseModelJson(content)
}
