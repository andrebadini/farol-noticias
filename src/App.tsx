import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ArticleFull,
  ArticleMeta,
  CategoryId,
  LatestPayload,
  LoadOrigin,
  SavedIndexEntry,
  Settings,
  TabId,
} from './types'
import { FALLBACK_SOURCES, CATEGORY_META } from './data/meta'
import {
  clearFarolCache,
  DEFAULT_SETTINGS,
  kvGet,
  kvSet,
  loadBookmark,
  loadBookmarkIndex,
  loadSettings,
  removeBookmark,
  saveBookmark,
  saveSettings,
} from './lib/storage'
import { fetchArticle, fetchLatest } from './lib/api'
import { GlassesUI, type GlassesSnapshot, type GlassesStatus } from './lib/glasses'
import { generatedLabel } from './lib/time'
import { Header } from './components/Header'
import { Ticker } from './components/Ticker'
import { FilterBar } from './components/FilterBar'
import { Hero } from './components/Hero'
import { Feed } from './components/Feed'
import { SourceRail } from './components/SourceRail'
import { BottomNav } from './components/BottomNav'
import { Reader } from './components/Reader'
import { SearchView } from './components/SearchView'
import { SavedView } from './components/SavedView'
import { SettingsView } from './components/SettingsView'
import { SourceSheet } from './components/SourceSheet'
import { Toast, type ToastMessage } from './components/Toast'
import { TipCard } from './components/TipCard'
import { BootSplash, FeedSkeleton } from './components/Boot'
import { EmptyArt } from './components/Art'
import { RefreshIcon, WifiOffIcon } from './components/Icons'

const RECENT_KEY = 'farol:recent-searches'
const SESSION_KEY = 'farol:v3:gsession'

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

const HERO_CATEGORIES = new Set(['politica', 'economia', 'mundo', 'justica', 'cidades', 'ciencia', 'saude'])
const LOW_SIGNAL = /(lotof[aá]cil|quina|mega-sena|lotomania|sorteio|resultado do|hor[oó]scopo|bbb|celebridade|fofoca)/i
const HARD_NEWS = /(elei[çc][ãa]o|elei[çc][õo]es|governo|congresso|senado|c[âa]mara|stf|supremo|economia|d[óo]lar|juros|infla[çc][ãa]o|guerra|acordo|presidente|lula|bolsonaro|pol[íi]cia|crime|julgamento|pris[ãa]o|morte|acidente|greve|reforma|tarifa|ibovespa|ministro|deputado|senador|justi[çc]a|ataque|bomba|terremoto|cat[áa]strofe)/i
const FEATURE = /(golfinhos|baleias|mirante|arquip[ée]lago|praia|viagem|turismo|curiosidade|natureza|fotos|imagens|v[íi]deo|p[ôo]r do sol|receita|restaurante|hotel|destino)/i

/** Escolhe a manchete do topo: notícia dura e recente acima de curiosidade/feature. */
function pickHero(articles: ArticleMeta[]): ArticleMeta | null {
  const candidates = articles.slice(0, 25)
  if (!candidates.length) return null
  let best = candidates[0]
  let bestScore = Number.NEGATIVE_INFINITY
  for (const article of candidates) {
    let score = 0
    if (HERO_CATEGORIES.has(article.category)) score += 3
    if (article.category === 'geral') score += 1
    if (article.full) score += 1
    score += Math.min(1, article.readingMin * 0.1)
    if (HARD_NEWS.test(article.title)) score += 2.5
    if (FEATURE.test(article.title)) score -= 5
    if (article.title.length > 130) score -= 1.5
    if (LOW_SIGNAL.test(article.title)) score -= 6
    const ageHours = Math.max(0, (Date.now() - Date.parse(article.publishedAt)) / 3_600_000)
    score -= Math.min(3, ageHours * 0.05)
    if (score > bestScore) {
      best = article
      bestScore = score
    }
  }
  return best
}

interface ReaderState {
  meta: ArticleMeta
  article: ArticleFull | null
  loading: boolean
  retrying?: boolean
}

export default function App() {
  const bootStart = useRef(Date.now())
  const [latest, setLatest] = useState<LatestPayload | null>(null)
  const [origin, setOrigin] = useState<LoadOrigin>({ kind: 'none', at: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState<SavedIndexEntry[]>([])
  const [tab, setTab] = useState<TabId>('agora')
  const [category, setCategory] = useState<CategoryId | 'tudo'>('tudo')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [reader, setReader] = useState<ReaderState | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [glassesStatus, setGlassesStatus] = useState<GlassesStatus>({ state: 'connecting' })
  const [booting, setBooting] = useState(true)
  const [splashLeaving, setSplashLeaving] = useState(false)
  const [restored, setRestored] = useState(false)

  const latestRef = useRef<LatestPayload | null>(null)
  const settingsRef = useRef(settings)
  const savedRef = useRef(saved)
  const filterRef = useRef(sourceFilter)
  const feedRef = useRef<ArticleMeta[]>([])
  const sourcesRef = useRef(FALLBACK_SOURCES)
  const glassesSourcesRef = useRef(FALLBACK_SOURCES)
  const refreshRef = useRef<(manual?: boolean) => Promise<void>>(async () => undefined)
  const toggleSaveRef = useRef<(article: ArticleMeta) => Promise<boolean>>(async () => false)
  const glassesRef = useRef<GlassesUI | null>(null)
  const pendingGlassesRef = useRef<GlassesSnapshot | null>(null)
  const sessionTimer = useRef<number | null>(null)

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'default') => {
    setToast({ id: Date.now() + Math.random(), text, tone })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  const sources = useMemo(() => {
    const list = latest?.sources?.length ? latest.sources : FALLBACK_SOURCES
    return list
  }, [latest])

  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources])

  const enabledSet = useMemo(() => {
    if (settings.enabledSources === null) return new Set(sources.map((source) => source.id))
    return new Set(settings.enabledSources)
  }, [settings.enabledSources, sources])

  const baseArticles = useMemo(() => {
    const articles = latest?.articles ?? []
    return articles.filter(
      (article) => enabledSet.has(article.sourceId) && (!sourceFilter || article.sourceId === sourceFilter),
    )
  }, [latest, enabledSet, sourceFilter])

  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryId | 'tudo', number>()
    counts.set('tudo', baseArticles.length)
    for (const article of baseArticles) {
      counts.set(article.category, (counts.get(article.category) ?? 0) + 1)
    }
    return counts
  }, [baseArticles])

  const feed = useMemo(
    () => (category === 'tudo' ? baseArticles : baseArticles.filter((article) => article.category === category)),
    [baseArticles, category],
  )

  const savedIds = useMemo(() => new Set(saved.map((entry) => entry.id)), [saved])
  const online = sources.filter((source) => source.ok).length
  const enabledCount = enabledSet.size
  const hasFilters =
    category !== 'tudo' ||
    sourceFilter !== null ||
    (settings.enabledSources !== null && settings.enabledSources.length < sources.length)
  const sourceName = sourceFilter ? (sourceMap.get(sourceFilter)?.name ?? sourceFilter) : null

  feedRef.current = feed
  sourcesRef.current = sources
  glassesSourcesRef.current = sources.filter((source) => enabledSet.has(source.id))
  savedRef.current = saved
  filterRef.current = sourceFilter
  settingsRef.current = settings

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch }
      settingsRef.current = next
      void saveSettings(next)
      return next
    })
  }, [])

  const refresh = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true)
      try {
        const before = latestRef.current
        const result = await fetchLatest(manual)
        latestRef.current = result.payload
        setLatest(result.payload)
        setOrigin(result.origin)
        if (manual) {
          if (result.origin.kind === 'none') {
            showToast('Sem conexão. Mostrando o que já está salvo.')
          } else {
            const diff = before ? result.payload.total - before.total : 0
            showToast(
              diff > 0 ? `${diff} ${diff === 1 ? 'matéria nova' : 'matérias novas'} na edição` : 'Edição já está atualizada',
              diff > 0 ? 'accent' : 'default',
            )
          }
        }
      } catch {
        if (manual) showToast('Não foi possível atualizar agora. Tente de novo.')
      } finally {
        if (manual) setRefreshing(false)
      }
    },
    [showToast],
  )
  refreshRef.current = refresh

  const toggleSave = useCallback(
    async (article: ArticleMeta): Promise<boolean> => {
      const current = savedRef.current
      const existing = current.find((entry) => entry.id === article.id)
      if (existing) {
        await removeBookmark(article.id)
        const next = current.filter((entry) => entry.id !== article.id)
        savedRef.current = next
        setSaved(next)
        showToast('Removido dos salvos')
        return false
      }
      const full = await fetchArticle(article)
      const content = full?.content?.trim() || article.summary || ''
      const entry: SavedIndexEntry = { ...article, savedAt: Date.now() }
      await saveBookmark(entry, content)
      const next = [entry, ...savedRef.current.filter((item) => item.id !== article.id)]
      savedRef.current = next
      setSaved(next)
      showToast('Salvo no seu celular', 'accent')
      return true
    },
    [showToast],
  )
  toggleSaveRef.current = toggleSave

  const openArticle = useCallback(async (meta: ArticleMeta) => {
    setReader({ meta, article: null, loading: true })
    const isSaved = savedRef.current.some((entry) => entry.id === meta.id)
    if (isSaved) {
      const offlineCopy = await loadBookmark(meta.id)
      if (offlineCopy) {
        setReader({ meta, article: offlineCopy, loading: false })
        void fetchArticle(meta).then((full) => {
          if (full?.content) {
            setReader((current) =>
              current && current.meta.id === meta.id ? { ...current, article: full, loading: false } : current,
            )
          }
        })
        return
      }
    }
    const full = await fetchArticle(meta)
    setReader((current) => (current && current.meta.id === meta.id ? { meta, article: full, loading: false } : current))
  }, [])

  const closeReader = useCallback(() => setReader(null), [])

  const retryFullText = useCallback(async () => {
    const current = reader
    if (!current) return
    setReader((prev) => (prev && prev.meta.id === current.meta.id ? { ...prev, retrying: true } : prev))
    const full = await fetchArticle(current.meta, true)
    const previousLength = current.article?.content?.length ?? 0
    const improved = Boolean(full?.content && (full.full || full.content.length > previousLength + 150))
    setReader((prev) => {
      if (!prev || prev.meta.id !== current.meta.id) return prev
      if (improved && full) return { ...prev, article: full, loading: false, retrying: false }
      return { ...prev, retrying: false }
    })
    showToast(improved ? 'Texto completo carregado' : 'Ainda só temos o resumo. Abra o original.', improved ? 'accent' : 'default')
  }, [reader, showToast])

  const sendToGlasses = useCallback(
    async (meta: ArticleMeta) => {
      if (glassesStatus.state !== 'ready' || !glassesRef.current) {
        showToast('Abra o app no Even Hub com os óculos G2 conectados.')
        return
      }
      const full = (await fetchArticle(meta)) ?? { ...meta, content: meta.summary }
      await glassesRef.current.showArticle(full)
      showToast('No visor: matéria aberta', 'accent')
    },
    [glassesStatus.state, showToast],
  )

  const toggleSource = useCallback(
    (id: string) => {
      const allIds = sources.map((source) => source.id)
      const current = settingsRef.current.enabledSources ?? allIds
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      if (next.length === 0) {
        showToast('Mantenha pelo menos uma fonte ativa.')
        return
      }
      if (sourceFilter === id && !next.includes(id)) setSourceFilter(null)
      updateSettings({ enabledSources: next.length === allIds.length ? null : next })
    },
    [sources, sourceFilter, showToast, updateSettings],
  )

  const resetFilters = useCallback(() => {
    setCategory('tudo')
    setSourceFilter(null)
    updateSettings({ enabledSources: null })
  }, [updateSettings])

  const rememberSearch = useCallback((term: string) => {
    const clean = term.trim()
    if (clean.length < 2) return
    setRecent((previous) => {
      const next = [clean, ...previous.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6)
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const clearRecent = useCallback(() => {
    setRecent([])
    try {
      window.localStorage.removeItem(RECENT_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const changeTab = useCallback((next: TabId) => {
    setTab(next)
    requestAnimationFrame(() => window.scrollTo({ top: 0 }))
  }, [])

  const persistSession = useCallback((snapshot: GlassesSnapshot) => {
    const raw = JSON.stringify(snapshot)
    try {
      window.localStorage.setItem(SESSION_KEY, raw)
    } catch {
      /* modo privado */
    }
    if (sessionTimer.current) window.clearTimeout(sessionTimer.current)
    sessionTimer.current = window.setTimeout(() => {
      void kvSet(SESSION_KEY, raw)
    }, 120)
  }, [])

  /* boot ---------------------------------------------------------------- */
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [loadedSettings, bookmarks, result, recentSearches] = await Promise.all([
        loadSettings(),
        loadBookmarkIndex(),
        fetchLatest(false),
        Promise.resolve(readRecent()),
      ])
      if (!alive) return
      setSettings(loadedSettings)
      settingsRef.current = loadedSettings
      setSaved(bookmarks)
      savedRef.current = bookmarks
      setLatest(result.payload)
      latestRef.current = result.payload
      setOrigin(result.origin)
      setRecent(recentSearches)
      setLoading(false)
      const wait = Math.max(0, 900 - (Date.now() - bootStart.current))
      window.setTimeout(() => {
        if (!alive) return
        setSplashLeaving(true)
        window.setTimeout(() => alive && setBooting(false), 430)
      }, wait)
    })().catch(() => {
      if (!alive) return
      setLoading(false)
      setSplashLeaving(true)
      window.setTimeout(() => alive && setBooting(false), 430)
    })
    return () => {
      alive = false
    }
  }, [])

  /* glasses ------------------------------------------------------------- */
  useEffect(() => {
    const ui = new GlassesUI({
      getFeed: () => feedRef.current,
      getSources: () => glassesSourcesRef.current,
      getSaved: () => savedRef.current,
      getFilter: () => filterRef.current,
      setFilter: (id) => {
        setSourceFilter(id)
        if (id) setCategory('tudo')
      },
      loadArticle: (meta, force) => fetchArticle(meta, force),
      toggleSave: (meta) => toggleSaveRef.current(meta),
      refresh: async () => {
        await refreshRef.current(false)
      },
      onStatus: (status) => {
        setGlassesStatus(status)
        if (status.state === 'ready' && pendingGlassesRef.current) {
          const snapshot = pendingGlassesRef.current
          pendingGlassesRef.current = null
          void glassesRef.current?.restore(snapshot)
        }
      },
      onSession: (snapshot) => persistSession(snapshot),
    })
    glassesRef.current = ui
    void ui.init()
    return () => {
      ui.destroy()
      glassesRef.current = null
    }
  }, [persistSession])

  useEffect(() => {
    glassesRef.current?.setData(
      feed,
      sources.filter((source) => enabledSet.has(source.id)),
      saved,
      sourceFilter,
    )
  }, [feed, sources, saved, sourceFilter, enabledSet])

  useEffect(() => {
    if (restored || glassesStatus.state !== 'ready' || !latest) return
    setRestored(true)
    void (async () => {
      try {
        let raw = await kvGet(SESSION_KEY)
        if (!raw) {
          try {
            raw = window.localStorage.getItem(SESSION_KEY) ?? ''
          } catch {
            raw = ''
          }
        }
        if (!raw) return
        const snapshot = JSON.parse(raw) as GlassesSnapshot
        if (snapshot?.mode === 'article') {
          if (snapshot.filter) {
            setSourceFilter(snapshot.filter)
            filterRef.current = snapshot.filter
          }
          await glassesRef.current?.restore(snapshot)
        }
      } catch {
        /* sessão antiga inválida */
      }
    })()
  }, [glassesStatus.state, latest, restored])

  /* tema ---------------------------------------------------------------- */
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
      root.dataset.theme = resolved
      root.style.colorScheme = resolved
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0d0d0c' : '#f7f4ec')
    }
    apply()
    if (settings.theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
    return undefined
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(settings.fontScale))
  }, [settings.fontScale])

  /* atualização automática ---------------------------------------------- */
  useEffect(() => {
    if (!settings.refreshMinutes) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void refresh(false)
    }, settings.refreshMinutes * 60_000)
    return () => window.clearInterval(timer)
  }, [settings.refreshMinutes, refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const at = Date.parse(latestRef.current?.generatedAt ?? '')
      if (!Number.isFinite(at) || Date.now() - at > 5 * 60_000) void refresh(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [refresh])

  /* estado global para o host ------------------------------------------ */
  useEffect(() => {
    const scope = window as unknown as {
      __getStateSnapshot?: () => string
      __restoreState?: (raw: string) => void
    }
    scope.__getStateSnapshot = () =>
      JSON.stringify({
        tab,
        category,
        sourceFilter,
        glasses: glassesRef.current?.getSnapshot() ?? null,
      })
    scope.__restoreState = (raw: string) => {
      try {
        const state = JSON.parse(raw) as {
          tab?: TabId
          category?: CategoryId | 'tudo'
          sourceFilter?: string | null
          glasses?: GlassesSnapshot | null
        }
        if (state.tab) setTab(state.tab)
        if (state.category) setCategory(state.category)
        if (state.sourceFilter !== undefined) setSourceFilter(state.sourceFilter)
        if (state.glasses) {
          pendingGlassesRef.current = state.glasses
          if (glassesRef.current) void glassesRef.current.restore(state.glasses)
        }
      } catch {
        /* snapshot inválido */
      }
    }
    return () => {
      delete scope.__getStateSnapshot
      delete scope.__restoreState
    }
  }, [tab, category, sourceFilter])

  /* derivações de tela -------------------------------------------------- */
  const heroArticle = !hasFilters && tab === 'agora' ? pickHero(feed) : null
  const listArticles = heroArticle ? feed.filter((article) => article.id !== heroArticle.id) : feed
  const tickerArticles = useMemo(() => {
    const picked: ArticleMeta[] = []
    const seen = new Set<string>()
    for (const article of latest?.articles ?? []) {
      if (LOW_SIGNAL.test(article.title)) continue
      if (seen.has(article.sourceId)) continue
      seen.add(article.sourceId)
      picked.push(article)
      if (picked.length === 6) break
    }
    return picked
  }, [latest])
  const currentCategory = category === 'tudo' ? null : CATEGORY_META[category]

  const readerSaved = reader ? savedIds.has(reader.meta.id) : false

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <Header
        updatedAt={latest?.generatedAt ?? ''}
        online={online}
        totalSources={sources.length}
        savedCount={saved.length}
        onSaved={() => changeTab('salvos')}
        onSearch={() => changeTab('buscar')}
        stale={origin.kind === 'cache'}
      />

      {tab === 'agora' && (
        <Ticker articles={tickerArticles} sourceMap={sourceMap} onOpen={(article) => void openArticle(article)} />
      )}

      {tab === 'agora' && (
        <FilterBar
          category={category}
          onCategory={setCategory}
          counts={categoryCounts}
          sourceFilter={sourceFilter}
          sourceName={sourceName}
          onClearSource={() => setSourceFilter(null)}
          onOpenSources={() => setSheetOpen(true)}
          enabledCount={enabledCount}
          totalSources={sources.length}
        />
      )}

      <main id="conteudo" className="content">
        {origin.kind === 'cache' && tab === 'agora' && (
          <div className="offline-banner" role="status">
            <WifiOffIcon size={17} />
            <span>Sem sinal agora. Esta é a última edição guardada no celular.</span>
            <button onClick={() => void refresh(true)}>Tentar</button>
          </div>
        )}

        {tab === 'agora' && (
          <>
            {loading && !latest ? (
              <FeedSkeleton />
            ) : latest && latest.total === 0 ? (
              <div className="empty">
                <EmptyArt />
                <h2>O farol ainda não acendeu</h2>
                <p>
                  Não recebemos a edição de hoje. Verifique sua conexão e puxe a atualização — o
                  serviço publica notícias a cada 15 minutos.
                </p>
                <button className="btn btn--ink" onClick={() => void refresh(true)} disabled={refreshing}>
                  <RefreshIcon size={17} className={refreshing ? 'spin' : ''} />
                  Buscar a edição
                </button>
              </div>
            ) : (
              <>
                {heroArticle && (
                  <Hero
                    article={heroArticle}
                    source={sourceMap.get(heroArticle.sourceId)}
                    saved={savedIds.has(heroArticle.id)}
                    onOpen={() => void openArticle(heroArticle)}
                    onToggleSave={() => void toggleSave(heroArticle)}
                    onGlasses={() => void sendToGlasses(heroArticle)}
                  />
                )}

                {hasFilters && (
                  <div className="filter-summary">
                    <span className="eyebrow">seu recorte</span>
                    <h1>
                      {currentCategory ? currentCategory.name : sourceName ?? 'Edição'}
                      <span>{sourceName && currentCategory ? ` · ${sourceName}` : ''}</span>
                    </h1>
                    <div className="filter-summary__row">
                      <span>{feed.length} matérias</span>
                      <button className="link-btn" onClick={resetFilters}>limpar filtros</button>
                    </div>
                  </div>
                )}

                {!hasFilters && settings.showTips && (
                  <TipCard
                    onDismiss={() => updateSettings({ showTips: false })}
                    onOpenGlasses={() => {
                      changeTab('ajustes')
                      window.setTimeout(() => {
                        document.getElementById('glasses-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }, 200)
                    }}
                  />
                )}

                {!hasFilters && (
                  <SourceRail
                    sources={sources}
                    active={sourceFilter}
                    onPick={(id) => setSourceFilter(id)}
                    onAll={() => setSourceFilter(null)}
                    onOpenAll={() => setSheetOpen(true)}
                  />
                )}

                {!loading && (listArticles.length > 0 || !heroArticle) && (
                  <Feed
                    articles={listArticles}
                    sourceMap={sourceMap}
                    savedIds={savedIds}
                    onOpen={(article) => void openArticle(article)}
                    onToggleSave={(article) => void toggleSave(article)}
                    onRefresh={() => void refresh(true)}
                    refreshing={refreshing}
                    updatedAt={generatedLabel(latest?.generatedAt ?? '')}
                    onOpenSources={() => setSheetOpen(true)}
                    totalSources={sources.length}
                    onlineSources={online}
                    onResetFilters={resetFilters}
                    hasFilters={hasFilters}
                  />
                )}
              </>
            )}
          </>
        )}

        {tab === 'buscar' && (
          <SearchView
            query={searchQuery}
            onQuery={setSearchQuery}
            articles={baseArticles}
            sourceMap={sourceMap}
            savedIds={savedIds}
            onOpen={(article) => void openArticle(article)}
            onToggleSave={(article) => void toggleSave(article)}
            recent={recent}
            onRemember={rememberSearch}
            onClearRecent={clearRecent}
          />
        )}

        {tab === 'salvos' && (
          <SavedView
            saved={saved}
            sourceMap={sourceMap}
            onOpen={(entry) => void openArticle(entry)}
            onRemove={(entry) => void toggleSave(entry)}
            onExplore={() => changeTab('agora')}
          />
        )}

        {tab === 'ajustes' && (
          <SettingsView
            settings={settings}
            onChange={updateSettings}
            glasses={glassesStatus}
            latest={latest}
            previewArticles={feed}
            previewTotal={feed.length}
            saved={saved}
            sourceMap={sourceMap}
            enabledCount={enabledCount}
            totalSources={sources.length}
            filterName={sourceName}
            onOpenSources={() => setSheetOpen(true)}
            onRefresh={() => void refresh(true)}
            refreshing={refreshing}
            onClearCache={async () => {
              await clearFarolCache()
              await refresh(true)
            }}
            onSendTop={() => {
              const top = feed[0] ?? latest?.articles[0]
              if (top) void sendToGlasses(top)
              else showToast('Ainda não há manchete para enviar.')
            }}
            onToast={showToast}
          />
        )}
      </main>

      <div className="nav-fade" aria-hidden="true" />

      <BottomNav tab={tab} onChange={changeTab} savedCount={saved.length} />

      {reader && (
        <Reader
          meta={reader.meta}
          article={reader.article}
          source={sourceMap.get(reader.meta.sourceId)}
          saved={readerSaved}
          fontScale={settings.fontScale}
          onFontScale={(scale) => updateSettings({ fontScale: scale })}
          onClose={closeReader}
          onToggleSave={() => void toggleSave(reader.meta)}
          onGlasses={() => void sendToGlasses(reader.meta)}
          onRetryFull={() => void retryFullText()}
          retrying={Boolean(reader.retrying)}
        />
      )}

      {sheetOpen && (
        <SourceSheet
          sources={sources}
          enabled={enabledSet}
          onToggle={toggleSource}
          onAll={() => updateSettings({ enabledSources: null })}
          onClose={() => setSheetOpen(false)}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />

      {booting && <BootSplash leaving={splashLeaving} />}
    </div>
  )
}
