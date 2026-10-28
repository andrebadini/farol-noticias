import type { ArticleFull, ArticleMeta, LatestPayload, LoadOrigin } from '../types'
import { loadLatestCache, readCachedArticle, saveLatestCache, cacheArticle } from './storage'

const DEFAULT_BASE = 'https://andrebadini.github.io/farol-noticias/data'
const REMOTE_BASE = (import.meta.env.VITE_DATA_BASE as string | undefined)?.replace(/\/$/, '') || DEFAULT_BASE
const LOCAL_BASE = new URL('./data', document.baseURI).href.replace(/\/$/, '')

const TIMEOUT_LATEST = 9000
const TIMEOUT_ARTICLE = 8000

export const DATA_ENDPOINT = REMOTE_BASE

async function fetchJson<T>(url: string, timeout: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

function isLatest(value: unknown): value is LatestPayload {
  const payload = value as LatestPayload | null
  return Boolean(payload && Array.isArray(payload.articles) && typeof payload.generatedAt === 'string')
}

export interface LatestResult {
  payload: LatestPayload
  origin: LoadOrigin
}

function stamp(url: string): string {
  const joiner = url.includes('?') ? '&' : '?'
  return `${url}${joiner}t=${Date.now()}`
}

/**
 * Busca o snapshot mais novo. Tenta o GitHub Pages, depois o snapshot embutido
 * no pacote e, por fim, o cache local. Nunca lança: a UI decide o que mostrar.
 */
export async function fetchLatest(force = false): Promise<LatestResult> {
  const cached = await loadLatestCache()
  const attempts: Array<{ url: string; kind: LoadOrigin['kind'] }> = [
    { url: force ? stamp(`${REMOTE_BASE}/latest.json`) : `${REMOTE_BASE}/latest.json`, kind: 'remote' },
    { url: `${LOCAL_BASE}/latest.json`, kind: 'local' },
  ]

  for (const attempt of attempts) {
    try {
      const payload = await fetchJson<LatestPayload>(attempt.url, TIMEOUT_LATEST)
      if (!isLatest(payload)) continue
      if (cached && Date.parse(cached.generatedAt) > Date.parse(payload.generatedAt) && attempt.kind !== 'remote') {
        return { payload: cached, origin: { kind: 'cache', at: Date.now() } }
      }
      if (!cached || cached.generatedAt !== payload.generatedAt) void saveLatestCache(payload)
      return { payload, origin: { kind: attempt.kind, at: Date.now() } }
    } catch {
      /* tenta o próximo */
    }
  }

  if (cached) return { payload: cached, origin: { kind: 'cache', at: Date.now() } }
  return {
    payload: {
      generatedAt: new Date(0).toISOString(),
      version: 0,
      locale: 'pt-BR',
      total: 0,
      sources: [],
      categories: [],
      health: [],
      articles: [],
    },
    origin: { kind: 'none', at: Date.now() },
  }
}

export async function fetchArticle(meta: ArticleMeta): Promise<ArticleFull | null> {
  const cached = await readCachedArticle<ArticleFull>(meta.id)
  if (cached?.content) return cached

  const urls = [`${REMOTE_BASE}/a/${meta.id}.json`, `${LOCAL_BASE}/a/${meta.id}.json`]
  for (const url of urls) {
    try {
      const payload = await fetchJson<ArticleFull>(url, TIMEOUT_ARTICLE)
      if (!payload?.content && !payload?.summary) continue
      const article: ArticleFull = {
        ...meta,
        ...payload,
        id: meta.id,
        title: payload.title || meta.title,
        sourceId: payload.sourceId || meta.sourceId,
        content: payload.content || '',
      }
      void cacheArticle(article as unknown as { id: string } & Record<string, unknown>)
      return article
    } catch {
      /* próxima origem */
    }
  }

  return { ...meta, content: meta.summary }
}

export function articleBody(article: ArticleFull): string {
  const text = article.content?.trim() || article.summary?.trim() || ''
  if (text) return text
  return 'Esta matéria ainda não tem texto disponível. Abra a versão original para ler na íntegra.'
}

export function isProbablyTruncated(article: ArticleFull): boolean {
  const content = article.content?.trim() ?? ''
  return !article.full || content.length < 240
}
