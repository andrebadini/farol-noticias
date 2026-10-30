import type { ArticleMeta, SourceInfo } from '../types'
import { CATEGORY_META } from '../data/meta'
import { relativeTime } from '../lib/time'
import { BookmarkFilledIcon, BookmarkIcon, GlassesIcon } from './Icons'
import { SignalArt } from './Art'
import { SourceBadge } from './SourceBadge'
import { t } from '../lib/i18n'

export function Hero({
  article,
  source,
  saved,
  onOpen,
  onToggleSave,
  onGlasses,
}: {
  article: ArticleMeta
  source?: SourceInfo
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
  onGlasses: () => void
}) {
  const category = CATEGORY_META[article.category] ?? CATEGORY_META.geral
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__art" aria-hidden="true">
        <SignalArt seed={article.id} color={source?.color ?? '#6B675C'} glyph={category.glyph} />
      </div>

      <div className="hero__kicker">
        <span className="kicker">
          <span className="kicker__dot" />
          {t('destaque do dia')}
        </span>
        <span className="hero__when">{relativeTime(article.publishedAt)}</span>
      </div>

      <button className="hero__headline" id="hero-title" onClick={onOpen}>
        {article.title}
      </button>

      {article.summary && <p className="hero__deck">{article.summary}</p>}

      <div className="hero__meta">
        <SourceBadge source={source} size="sm" />
        <span className="hero__source">{source?.name ?? article.sourceId}</span>
        <span className="dot" aria-hidden="true" />
        <span className="hero__cat">{t(category.name)}</span>
        <span className="dot" aria-hidden="true" />
        <span>{t('{n} min', { n: article.readingMin })}</span>
        <button
          className={`hero__save ${saved ? 'is-saved' : ''}`}
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={t(saved ? 'Remover dos salvos' : 'Salvar matéria')}
        >
          {saved ? <BookmarkFilledIcon size={19} /> : <BookmarkIcon size={19} />}
        </button>
      </div>

      <div className="hero__actions">
        <button className="btn btn--ink" onClick={onOpen}>
          {t('Ler a matéria')}
          <span className="btn__arrow" aria-hidden="true">→</span>
        </button>
        <button className="btn btn--ghost" onClick={onGlasses}>
          <GlassesIcon size={18} />
          {t('Nos óculos')}
        </button>
      </div>
    </section>
  )
}
