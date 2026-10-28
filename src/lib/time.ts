const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const longFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })

export function relativeTime(iso: string, now = Date.now()): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const diff = Math.max(0, now - at)
  if (diff < 50_000) return 'agora'
  if (diff < HOUR) return `há ${Math.max(1, Math.floor(diff / MINUTE))} min`
  if (diff < 12 * HOUR) return `há ${Math.floor(diff / HOUR)} h`
  if (diff < 36 * HOUR) return 'ontem'
  if (diff < 7 * DAY) return `há ${Math.floor(diff / DAY)} d`
  return dateFmt.format(at)
}

export function clock(iso: string): string {
  const at = Date.parse(iso)
  return Number.isFinite(at) ? timeFmt.format(at) : ''
}

export function longDate(iso: string): string {
  const at = Date.parse(iso)
  return Number.isFinite(at) ? longFmt.format(at).replace(',', ' ·') : ''
}

export function dayLabel(iso: string): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const now = new Date()
  const date = new Date(at)
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return 'hoje'
  const yesterday = new Date(now.getTime() - DAY)
  if (date.toDateString() === yesterday.toDateString()) return 'ontem'
  return `${weekdayFmt.format(date).replace('.', '')} ${dateFmt.format(date)}`
}

export function generatedLabel(iso: string): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at) || at < 1_000_000) return 'aguardando primeira atualização'
  const diff = Math.max(0, Date.now() - at)
  if (diff < MINUTE) return 'atualizado agora'
  return `atualizado há ${Math.floor(diff / MINUTE)} min`
}

export function hourOf(iso: string): number {
  const at = Date.parse(iso)
  return Number.isFinite(at) ? new Date(at).getHours() : 0
}

export function isToday(iso: string): boolean {
  const at = Date.parse(iso)
  return Number.isFinite(at) && new Date(at).toDateString() === new Date().toDateString()
}

export function shortCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')} mil`
  return String(n)
}
