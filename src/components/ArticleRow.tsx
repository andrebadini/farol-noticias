import type { ArticleMeta, SourceInfo } from '../types'
import { CATEGORY_META } from '../data/meta'
import { relativeTime } from '../lib/time'
import { BookmarkFilledIcon, BookmarkIcon, TrashIcon } from './Icons'
import { SourceBadge } from './SourceBadge'
import { t } from '../lib/i18n'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim()
  if (!q || q.length < 2) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'))
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={index} className="hl">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

export function ArticleRow({
  article,
  source,
  saved,
  onOpen,
  onToggleSave,
  index,
  query,
  variant = 'default',
}: {
  article: ArticleMeta
  source?: SourceInfo
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
  index?: number
  query?: string
  variant?: 'default' | 'saved' | 'compact'
}) {
  const category = CATEGORY_META[article.category] ?? CATEGORY_META.geral
  const flat = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  const summaryRepeatsTitle =
    Boolean(article.summary) &&
    (flat(article.summary).startsWith(flat(article.title).slice(0, 50)) ||
      flat(article.title).startsWith(flat(article.summary).slice(0, 50)))
  return (
    <article className={`row row--${variant} ${typeof index === 'number' ? 'row--numbered' : ''}`}>
      {typeof index === 'number' && (
        <span className="row__index" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
      )}
      <button className="row__main" onClick={onOpen}>
        <span className="row__meta">
          <SourceBadge source={source} size="xs" />
          <span className="row__source">{source?.short ?? article.sourceId}</span>
          <span className="row__sep" aria-hidden="true">·</span>
          <time dateTime={article.publishedAt}>{relativeTime(article.publishedAt)}</time>
          {!article.full && <span className="row__tag">{t('resumo')}</span>}
        </span>
        <span className="row__title">
          <Highlight text={article.title} query={query} />
        </span>
        {variant !== 'compact' && article.summary && !summaryRepeatsTitle && (
          <span className="row__summary">
            <Highlight text={article.summary} query={query} />
          </span>
        )}
        <span className="row__foot">
          <span className="row__cat">
            <span style={{ color: category.hue }}>{category.glyph}</span> {t(category.name)}
          </span>
          <span className="row__sep" aria-hidden="true">·</span>
          <span>{t('{n} min', { n: article.readingMin })}</span>
        </span>
      </button>
      <button
        className={`row__save ${saved ? 'is-saved' : ''}`}
        onClick={onToggleSave}
        aria-pressed={saved}
        aria-label={t(saved ? 'Remover "{title}" dos salvos' : 'Salvar "{title}"', { title: article.title })}
      >
        {variant === 'saved' ? (
          <TrashIcon size={19} />
        ) : saved ? (
          <BookmarkFilledIcon size={19} />
        ) : (
          <BookmarkIcon size={19} />
        )}
      </button>
    </article>
  )
}
