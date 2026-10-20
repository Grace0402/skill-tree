/** 展示用格式化：只负责"怎么读"，不参与亮度计算 */

export function formatBrightness(value: number): string {
  if (!Number.isFinite(value)) return '0.0'
  if (value > 0 && value < 0.1) return value.toFixed(2)
  return value.toFixed(1)
}

export function formatMarks(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** 2026-10-17 -> 10.17；跨年时带上年份 */
export function formatDiaryDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  const now = new Date()
  const sameYear = Number(match[1]) === now.getFullYear()
  return sameYear ? `${match[2]}.${match[3]}` : `${match[1]}.${match[2]}.${match[3]}`
}

export function formatFullDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date
  return `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日`
}

export function formatMoment(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDayMoment(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

export function excerpt(text: string, max = 46): string {
  const line =
    text
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? ''
  const chars = [...line]
  if (chars.length <= max) return line
  return `${chars.slice(0, max).join('')}…`
}

export function relativeFromToday(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - parsed.getTime()) / 86_400_000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff > 1 && diff < 7) return `${diff} 天前`
  return ''
}
