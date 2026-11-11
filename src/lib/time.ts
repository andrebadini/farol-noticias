import { currentLanguage, t, type Lang } from './i18n'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const formatters = {
  pt: {
    time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }),
    date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }),
    long: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }),
  },
  en: {
    time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short' }),
    date: new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short' }),
    long: new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }),
  },
}

function fmt() {
  return formatters[currentLanguage()]
}

export function relativeTime(iso: string, now = Date.now()): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const diff = Math.max(0, now - at)
  if (diff < 50_000) return t('agora')
  if (diff < HOUR) return t('há {n} min', { n: Math.max(1, Math.floor(diff / MINUTE)) })
  if (diff < 12 * HOUR) return t('há {n} h', { n: Math.floor(diff / HOUR) })
  if (diff < 36 * HOUR) return t('ontem')
  if (diff < 7 * DAY) return t('há {n} d', { n: Math.floor(diff / DAY) })
  return fmt().date.format(at)
}

export function clock(iso: string): string {
  const at = Date.parse(iso)
  return Number.isFinite(at) ? fmt().time.format(at) : ''
}

/**
 * Horário da notícia no fuso do aparelho, com a UTC explícita ao lado.
 * O G2 e o WebView usam o fuso do celular; o offset é calculado para a data
 * da matéria (e não para "agora"), então o horário de verão também acerta.
 */
export interface NewsClock {
  clock: string
  zone: string
  day: string
  utc: string
  full: string
}

const zoneFormatters: Partial<Record<Lang, Intl.DateTimeFormat | null>> = {}

function zoneFormatter(): Intl.DateTimeFormat | null {
  const lang = currentLanguage()
  if (lang in zoneFormatters) return zoneFormatters[lang] ?? null
  try {
    zoneFormatters[lang] = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'shortOffset',
    })
  } catch {
    zoneFormatters[lang] = null
  }
  return zoneFormatters[lang] ?? null
}

function offsetLabel(at: number): string {
  const offset = -new Date(at).getTimezoneOffset()
  const abs = Math.abs(offset)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  return `UTC${offset < 0 ? '−' : '+'}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`
}

function normalizeZone(raw: string, at: number): string {
  const value = raw.trim().replace(/\u2212/g, '-')
  if (!value) return offsetLabel(at)
  if (/^(GMT|UTC|Z)$/i.test(value)) return 'UTC'
  const match = /^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(value)
  if (match) {
    const sign = match[1] === '-' ? '−' : '+'
    const minutes = match[3] ? `:${match[3]}` : ''
    return `UTC${sign}${Number(match[2])}${minutes}`
  }
  return value
}

export function newsClock(iso: string): NewsClock | null {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return null
  let time = ''
  let zone = ''
  try {
    const parts = zoneFormatter()?.formatToParts(at) ?? []
    for (const part of parts) {
      if (part.type === 'hour') time += part.value
      else if (part.type === 'minute') time += `:${part.value}`
      else if (part.type === 'timeZoneName') zone = normalizeZone(part.value, at)
    }
  } catch {
    /* Intl sem timeZoneName: cai no relógio simples e no offset manual */
  }
  if (!time) time = clock(iso)
  if (!zone) zone = offsetLabel(at)
  const utc = new Date(at).toISOString().slice(11, 16)
  return {
    clock: time,
    zone,
    day: dayLabel(iso),
    utc,
    full: `${longDate(iso)} (${zone}) · ${utc} UTC`,
  }
}

export function longDate(iso: string): string {
  const at = Date.parse(iso)
  return Number.isFinite(at) ? fmt().long.format(at).replace(',', ' ·') : ''
}

export function dayLabel(iso: string): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const now = new Date()
  const date = new Date(at)
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return t('hoje')
  const yesterday = new Date(now.getTime() - DAY)
  if (date.toDateString() === yesterday.toDateString()) return t('ontem')
  return `${fmt().weekday.format(date).replace('.', '')} ${fmt().date.format(date)}`
}

export function generatedLabel(iso: string): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at) || at < 1_000_000) return t('aguardando primeira atualização')
  const diff = Math.max(0, Date.now() - at)
  if (diff < MINUTE) return t('atualizado agora')
  return t('atualizado há {n} min', { n: Math.floor(diff / MINUTE) })
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
  if (n >= 1000) return t('{n} mil', { n: (n / 1000).toFixed(1).replace('.0', '') })
  return String(n)
}
