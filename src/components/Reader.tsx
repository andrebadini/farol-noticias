import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleFull, ArticleMeta, SourceInfo } from '../types'
import { isProbablyTruncated, articleBody } from '../lib/api'
import { longDate } from '../lib/time'
import { CATEGORY_META } from '../data/meta'
import { ArrowLeftIcon, BookmarkFilledIcon, BookmarkIcon, ExternalIcon, CloseIcon, GlassesIcon, ShareIcon } from './Icons'
import { GlyphArt } from './Art'
import { SourceBadge } from './SourceBadge'
import { t } from '../lib/i18n'

interface ReaderProps {
  meta: ArticleMeta
  article: ArticleFull | null
  source?: SourceInfo
  saved: boolean
  fontScale: number
  onFontScale: (scale: number) => void
  onClose: () => void
  onToggleSave: () => void
  onGlasses: () => void
  onRetryFull: () => void
  retrying: boolean
}

const SCALES = [0.94, 1, 1.1, 1.22]

export function Reader({ meta, article, source, saved, fontScale, onFontScale, onClose, onToggleSave, onGlasses, onRetryFull, retrying }: ReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [progress, setProgress] = useState(0)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    setProgress(0)
  }, [meta.id])

  const paragraphs = useMemo(() => {
    if (!article) return []
    return articleBody(article)
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 0)
  }, [article])

  const category = CATEGORY_META[meta.category] ?? CATEGORY_META.geral
  const truncated = article ? isProbablyTruncated(article) : false
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  const deckIsLead =
    Boolean(article?.content) &&
    normalize(article?.content ?? '').startsWith(normalize(meta.summary ?? '').slice(0, 80))

  async function share() {
    const url = meta.url
    try {
      if (navigator.share) {
        await navigator.share({ title: meta.title, text: meta.summary, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShared(true)
        setTimeout(() => setShared(false), 2200)
      }
    } catch {
      setShared(true)
      setTimeout(() => setShared(false), 2200)
    }
  }

  function cycleScale() {
    const index = SCALES.findIndex((value) => Math.abs(value - fontScale) < 0.01)
    onFontScale(SCALES[(index + 1) % SCALES.length])
  }

  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label={meta.title}>
      <div className="reader__progress" style={{ width: `${progress}%` }} />
      <header className="reader__bar">
        <button ref={closeRef} className="icon-btn icon-btn--round" onClick={onClose} aria-label={t('Voltar')}>
          <ArrowLeftIcon size={21} />
        </button>
        <div className="reader__bar-source">
          <SourceBadge source={source} size="xs" />
          <span>{source?.name ?? meta.sourceId}</span>
          <span className="reader__bar-cat">{t(category.name)}</span>
        </div>
        <div className="reader__bar-actions">
          <button className="reader__aa" onClick={cycleScale} aria-label={t('Tamanho do texto')}>Aa</button>
          <button className="icon-btn icon-btn--round" onClick={share} aria-label={t('Compartilhar')}>
            {shared ? <CloseIcon size={18} /> : <ShareIcon size={19} />}
          </button>
        </div>
      </header>

      <div className="reader__scroll" ref={scrollRef} onScroll={(event) => {
        const el = event.currentTarget
        const max = el.scrollHeight - el.clientHeight
        setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0)
      }}>
        <article className="reader__article" style={{ ['--reader-scale' as string]: fontScale }}>
          <div className="reader__hero">
            <GlyphArt
              seed={meta.id}
              color={source?.color ?? '#6B675C'}
              glyph={category.glyph}
              label={source?.short ?? meta.sourceId.slice(0, 3).toUpperCase()}
              category={meta.category}
            />
          </div>

          <div className="reader__kicker">
            <span className="kicker" style={{ ['--kicker-color' as string]: category.hue }}>
              <span className="kicker__dot" />
              {t(category.name)}
            </span>
            <span>{t('{n} min de leitura', { n: meta.readingMin })}</span>
          </div>

          <h1 className="reader__title">{meta.title}</h1>

          {meta.summary && !deckIsLead && <p className="reader__deck">{meta.summary}</p>}

          <div className="reader__byline">
            <SourceBadge source={source} size="sm" />
            <div>
              <strong>{source?.name ?? meta.sourceId}</strong>
              <span>{longDate(meta.publishedAt)}</span>
            </div>
          </div>

          {truncated && (
            <div className="reader__notice">
              <span className="reader__notice-mark">◈</span>
              <div>
                <strong>{t('Texto resumido')}</strong>
                <p>
                  {t('Esta matéria chegou ao Farolira apenas com o resumo. Tente buscar o texto completo (versão pública ou arquivada) ou abra o original.')}
                </p>
                <div className="reader__notice-actions">
                  <button className="reader__retry" onClick={onRetryFull} disabled={retrying}>
                    {t(retrying ? 'Buscando texto completo…' : 'Buscar texto completo')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!article ? (
            <div className="reader__loading" aria-label={t('Carregando matéria')}>
              <span /><span /><span /><span /><span />
            </div>
          ) : (
            <div className="reader__body">
              {paragraphs.map((paragraph, index) =>
                index === 0 ? (
                  <p key={index} className="reader__lead">
                    <span className="dropcap" aria-hidden="true">{paragraph.charAt(0)}</span>
                    {paragraph.slice(1)}
                  </p>
                ) : (
                  <p key={index}>{paragraph}</p>
                ),
              )}
              {truncated && (
                <button className="reader__original" onClick={() => window.open(meta.url, '_blank', 'noopener')}>
                  {t('Ler na íntegra em {source}', { source: source?.name ?? meta.sourceId })}
                  <ExternalIcon size={17} />
                </button>
              )}
            </div>
          )}

          <div className="reader__end">
            <span aria-hidden="true">◈</span>
            <p>
              {source?.name ?? meta.sourceId} · {longDate(meta.publishedAt)}
            </p>
            <button className="reader__end-link" onClick={() => window.open(meta.url, '_blank', 'noopener')}>
              {t('Abrir no site original')} <ExternalIcon size={14} />
            </button>
          </div>
        </article>
      </div>

      <div className="reader__dock">
        <button className={`dock-btn ${saved ? 'is-on' : ''}`} onClick={onToggleSave} aria-pressed={saved}>
          {saved ? <BookmarkFilledIcon size={20} /> : <BookmarkIcon size={20} />}
          <span>{t(saved ? 'Salvo' : 'Salvar')}</span>
        </button>
        <button className="dock-btn dock-btn--accent" onClick={onGlasses}>
          <GlassesIcon size={21} />
          <span>{t('Ler nos óculos')}</span>
        </button>
        <button className="dock-btn" onClick={() => window.open(meta.url, '_blank', 'noopener')}>
          <ExternalIcon size={20} />
          <span>{t('Original')}</span>
        </button>
      </div>
    </div>
  )
}
