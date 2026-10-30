import type { Bookmark, LatestPayload, Settings, SavedIndexEntry } from '../types'
import { getBridge } from './bridge'

const CHUNK = 30_000
const CACHE_PREFIX = 'farol:v3:'
const LATEST_KEY = `${CACHE_PREFIX}latest`
const SETTINGS_KEY = `${CACHE_PREFIX}settings`
const BM_INDEX_KEY = `${CACHE_PREFIX}bm:index`
const BM_ARTICLE_KEY = `${CACHE_PREFIX}bm:a:`
const ARTICLE_CACHE_KEY = `${CACHE_PREFIX}art:`
const ARTICLE_INDEX_KEY = `${CACHE_PREFIX}art:index`

let chain: Promise<unknown> = Promise.resolve()

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn)
  chain = next.catch(() => undefined)
  return next
}

async function rawGet(key: string): Promise<string> {
  return serial(async () => {
    const bridge = await getBridge()
    if (bridge) {
      try {
        return (await bridge.getLocalStorage(key)) ?? ''
      } catch {
        return ''
      }
    }
    try {
      return window.localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
}

async function rawSet(key: string, value: string): Promise<void> {
  await serial(async () => {
    const bridge = await getBridge()
    if (bridge) {
      try {
        await bridge.setLocalStorage(key, value)
      } catch {
        /* storage cheio ou BLE instável — não bloqueia a UI */
      }
      return
    }
    try {
      if (value) window.localStorage.setItem(key, value)
      else window.localStorage.removeItem(key)
    } catch {
      /* modo privado */
    }
  })
}

export async function kvGet(key: string): Promise<string> {
  return rawGet(key)
}

export async function kvSet(key: string, value: string): Promise<void> {
  await rawSet(key, value)
}

export async function kvRemove(key: string): Promise<void> {
  await rawSet(key, '')
}

/* ------------------------------------------------------------- grandes ---- */

async function largeSet(key: string, value: string): Promise<void> {
  const chunks = Math.max(1, Math.ceil(value.length / CHUNK))
  await kvSet(`${key}:n`, String(chunks))
  for (let i = 0; i < chunks; i++) {
    await kvSet(`${key}:${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
  }
}

async function largeGet(key: string): Promise<string | null> {
  const nRaw = await kvGet(`${key}:n`)
  const n = Number.parseInt(nRaw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const part = await kvGet(`${key}:${i}`)
    if (!part) return null
    parts.push(part)
  }
  return parts.join('')
}

async function largeRemove(key: string): Promise<void> {
  const nRaw = await kvGet(`${key}:n`)
  const n = Number.parseInt(nRaw, 10)
  if (Number.isFinite(n) && n > 0) {
    for (let i = 0; i < n; i++) await kvRemove(`${key}:${i}`)
  }
  await kvRemove(`${key}:n`)
}

/* --------------------------------------------------------------- latest ---- */

export async function saveLatestCache(payload: LatestPayload): Promise<void> {
  try {
    await largeSet(LATEST_KEY, JSON.stringify(payload))
  } catch {
    /* cache é otimização, não requisito */
  }
}

export async function loadLatestCache(): Promise<LatestPayload | null> {
  try {
    const raw = await largeGet(LATEST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LatestPayload
    if (!parsed?.articles?.length) return null
    return parsed
  } catch {
    return null
  }
}

/* ------------------------------------------------------------- settings ---- */

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  theme: 'system',
  refreshMinutes: 15,
  fontScale: 1,
  enabledSources: null,
  showTips: true,
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await kvGet(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      language:
        parsed.language === 'pt' || parsed.language === 'en' || parsed.language === 'auto'
          ? parsed.language
          : DEFAULT_SETTINGS.language,
      enabledSources: Array.isArray(parsed.enabledSources) ? parsed.enabledSources : null,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await kvSet(SETTINGS_KEY, JSON.stringify(settings))
}

/* ------------------------------------------------------------ bookmarks ---- */

export async function loadBookmarkIndex(): Promise<SavedIndexEntry[]> {
  try {
    const raw = await kvGet(BM_INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedIndexEntry[]) : []
  } catch {
    return []
  }
}

export async function saveBookmark(meta: SavedIndexEntry, content: string): Promise<void> {
  const bookmark: Bookmark = { ...meta, savedAt: Date.now(), content }
  await largeSet(`${BM_ARTICLE_KEY}${meta.id}`, JSON.stringify(bookmark))
  const index = (await loadBookmarkIndex()).filter((entry) => entry.id !== meta.id)
  index.unshift({ ...meta, savedAt: bookmark.savedAt })
  await kvSet(BM_INDEX_KEY, JSON.stringify(index.slice(0, 300)))
}

export async function removeBookmark(id: string): Promise<void> {
  const index = (await loadBookmarkIndex()).filter((entry) => entry.id !== id)
  await kvSet(BM_INDEX_KEY, JSON.stringify(index))
  await largeRemove(`${BM_ARTICLE_KEY}${id}`)
}

export async function loadBookmark(id: string): Promise<Bookmark | null> {
  try {
    const raw = await largeGet(`${BM_ARTICLE_KEY}${id}`)
    if (!raw) return null
    return JSON.parse(raw) as Bookmark
  } catch {
    return null
  }
}

/* --------------------------------------------------------- article cache ---- */

let articleIndex: string[] | null = null

export async function cacheArticle(article: { id: string } & Record<string, unknown>): Promise<void> {
  try {
    await largeSet(`${ARTICLE_CACHE_KEY}${article.id}`, JSON.stringify(article))
    if (!articleIndex) {
      const raw = await kvGet(ARTICLE_INDEX_KEY)
      articleIndex = raw ? (JSON.parse(raw) as string[]) : []
    }
    articleIndex = [article.id, ...articleIndex.filter((id) => id !== article.id)]
    const stale = articleIndex.slice(24)
    articleIndex = articleIndex.slice(0, 24)
    for (const id of stale) await largeRemove(`${ARTICLE_CACHE_KEY}${id}`)
    await kvSet(ARTICLE_INDEX_KEY, JSON.stringify(articleIndex))
  } catch {
    /* cache best-effort */
  }
}

export async function readCachedArticle<T>(id: string): Promise<T | null> {
  try {
    const raw = await largeGet(`${ARTICLE_CACHE_KEY}${id}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function clearFarolCache(): Promise<void> {
  await largeRemove(LATEST_KEY)
  articleIndex = null
  const raw = await kvGet(ARTICLE_INDEX_KEY)
  if (raw) {
    try {
      const ids = JSON.parse(raw) as string[]
      for (const id of ids) await largeRemove(`${ARTICLE_CACHE_KEY}${id}`)
    } catch {
      /* ignore */
    }
  }
  await kvRemove(ARTICLE_INDEX_KEY)
}
