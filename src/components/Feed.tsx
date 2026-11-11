import { useEffect, useRef, useState } from 'react'
import type { ArticleMeta, SourceInfo } from '../types'
import { ArticleRow } from './ArticleRow'
import { EmptyArt } from './Art'
import { RefreshIcon, SparkIcon } from './Icons'
import { t } from '../lib/i18n'

export const FEED_PAGE = 30
const PULL_THRESHOLD = 52
const PULL_LIMIT = 76

export function Feed({
  articles,
  sourceMap,
  savedIds,
  onOpen,
  onToggleSave,
  onRefresh,
  refreshing,
  updatedAt,
  onOpenSources,
  totalSources,
  onlineSources,
  onResetFilters,
  hasFilters,
  visible,
  onLoadOlder,
  onOpenMenu,
}: {
  articles: ArticleMeta[]
  sourceMap: Map<string, SourceInfo>
  savedIds: Set<string>
  onOpen: (article: ArticleMeta) => void
  onToggleSave: (article: ArticleMeta) => void
  onRefresh: () => void
  refreshing: boolean
  updatedAt: string
  onOpenSources: () => void
  totalSources: number
  onlineSources: number
  onResetFilters: () => void
  hasFilters: boolean
  visible: number
  onLoadOlder: () => void
  onOpenMenu: () => void
}) {
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const pullRef = useRef(0)
  const readyRef = useRef(false)
  const startRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const barRef = useRef<HTMLSpanElement>(null)

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

  if (!articles.length) {
    return (
      <div className="empty">
        <EmptyArt />
        <h2>{t(hasFilters ? 'Nada com esse filtro' : 'O farol está sem sinal')}</h2>
        <p>
          {hasFilters
            ? t('Nenhuma matéria corresponde às fontes e categorias escolhidas. Tente abrir um pouco o olhar.')
            : t('Não conseguimos falar com o serviço de notícias. Verifique a conexão e tente de novo.')}
        </p>
        <div className="empty__actions">
          {hasFilters ? (
            <button className="btn btn--ink" onClick={onResetFilters}>{t('Limpar filtros')}</button>
          ) : (
            <button className="btn btn--ink" onClick={onRefresh} disabled={refreshing}>
              <RefreshIcon size={17} className={refreshing ? 'spin' : ''} />
              {t('Tentar de novo')}
            </button>
          )}
          <button className="btn btn--ghost" onClick={onOpenSources}>
            <SparkIcon size={17} />
            {t('Escolher fontes')}
          </button>
        </div>
      </div>
    )
  }

  const shown = articles.slice(0, visible)
  const remaining = Math.max(0, articles.length - shown.length)

  const atBottom = () => {
    const scroller = document.scrollingElement ?? document.documentElement
    return scroller.scrollTop + window.innerHeight >= scroller.scrollHeight - 8
  }

  function paint(value: number) {
    pullRef.current = value
    if (barRef.current) {
      barRef.current.style.width = `${Math.min(100, (value / PULL_THRESHOLD) * 100)}%`
    }
    const nextReady = value >= PULL_THRESHOLD
    if (nextReady !== readyRef.current) {
      readyRef.current = nextReady
      setReady(nextReady)
    }
  }

  function resetPull() {
    pullRef.current = 0
    if (barRef.current) barRef.current.style.width = '0%'
    if (readyRef.current) {
      readyRef.current = false
      setReady(false)
    }
  }

  function begin(clientY: number): boolean {
    if (loadingMore || remaining === 0 || !atBottom()) return false
    startRef.current = clientY
    setDragging(true)
    return true
  }

  function move(clientY: number) {
    if (startRef.current === null) return
    paint(Math.max(0, Math.min(PULL_LIMIT, startRef.current - clientY)))
  }

  function finish() {
    if (startRef.current === null) return
    startRef.current = null
    setDragging(false)
    const shouldLoad = pullRef.current >= PULL_THRESHOLD
    resetPull()
    if (shouldLoad) loadOlder()
  }

  function cancel() {
    startRef.current = null
    setDragging(false)
    resetPull()
  }

  function loadOlder() {
    if (loadingMore || remaining === 0) return
    setLoadingMore(true)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setLoadingMore(false)
      onLoadOlder()
    }, 260)
  }

  return (
    <section className="feed" aria-label={t('Últimas notícias')}>
      <div className="section-head">
        <div>
          <span className="eyebrow">{t('a edição de agora')}</span>
          <h2 className="section-head__title">{t('Últimas')}</h2>
        </div>
        <div className="section-head__right">
          <span className="section-head__count">{t('{n} matérias', { n: articles.length })}</span>
          <button
            className="icon-btn icon-btn--soft"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={t('Atualizar notícias')}
          >
            <RefreshIcon size={18} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="feed__freshness" aria-live="polite">
        <span className={`live-dot ${onlineSources < totalSources ? 'is-warm' : ''}`} />
        {t('{online}/{total} fontes no ar', { online: onlineSources, total: totalSources })}
        <span className="dot" />
        {refreshing ? t('buscando agora…') : updatedAt}
      </div>

      <div className="feed__list">
        {shown.map((article, index) => (
          <ArticleRow
            key={article.id}
            article={article}
            source={sourceMap.get(article.sourceId)}
            saved={savedIds.has(article.id)}
            onOpen={() => onOpen(article)}
            onToggleSave={() => onToggleSave(article)}
            index={index}
          />
        ))}
      </div>

      {remaining > 0 ? (
        <div
          className={`load-older ${dragging ? 'is-dragging' : ''} ${ready ? 'is-ready' : ''} ${loadingMore ? 'is-loading' : ''}`}
          onTouchStart={(event) => {
            if ((event.target as HTMLElement | null)?.closest('button')) return
            const touch = event.touches[0]
            if (touch) begin(touch.clientY)
          }}
          onTouchMove={(event) => {
            const touch = event.touches[0]
            if (touch) move(touch.clientY)
          }}
          onTouchEnd={finish}
          onTouchCancel={cancel}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse' || event.button !== 0) return
            if ((event.target as HTMLElement | null)?.closest('button')) return
            if (begin(event.clientY)) event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (event.pointerType === 'mouse') move(event.clientY)
          }}
          onPointerUp={(event) => {
            if (event.pointerType === 'mouse') finish()
          }}
          onPointerCancel={(event) => {
            if (event.pointerType === 'mouse') cancel()
          }}
        >
          <span className="load-older__grip" aria-hidden="true"><span /></span>
          <p className="load-older__cue" aria-live="polite">
            {loadingMore
              ? t('Carregando as anteriores…')
              : ready
                ? t('Solte para carregar as anteriores')
                : t('Arraste para cima para carregar as anteriores')}
          </p>
          <div className="load-older__bar" aria-hidden="true">
            <span ref={barRef} />
          </div>
          <button className="load-older__button" onClick={loadOlder} disabled={loadingMore}>
            <span>{loadingMore ? t('Carregando…') : t('Carregar notícias mais antigas')}</span>
            <span className="load-older__count">{t('{n} restantes', { n: remaining })}</span>
          </button>
          <p className="load-older__hint">{t('Puxa um lote imediatamente mais antigo — não as notícias novas.')}</p>
          <button className="load-older__menu" onClick={onOpenMenu}>
            <span aria-hidden="true">☰</span>
            {t('Menu da edição')}
          </button>
        </div>
      ) : (
        <div className="feed__end">
          <span className="feed__end-mark" aria-hidden="true">◈</span>
          <p>{t('Você chegou ao fim da edição. O app se atualiza sozinho a cada 15 minutos.')}</p>
          <button className="feed__menu" onClick={onOpenMenu}>
            <span className="feed__menu-icon" aria-hidden="true">☰</span>
            <span className="feed__menu-copy">
              <strong>{t('Menu da edição')}</strong>
              <small>{t('atualizar, filtrar, salvos e ajustes')}</small>
            </span>
            <span className="feed__menu-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  )
}
