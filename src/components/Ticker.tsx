import type { ArticleMeta, SourceInfo } from '../types'
import { relativeTime } from '../lib/time'
import { t } from '../lib/i18n'

interface TickerProps {
  articles: ArticleMeta[]
  sourceMap: Map<string, SourceInfo>
  onOpen: (article: ArticleMeta) => void
}

export function Ticker({ articles, sourceMap, onOpen }: TickerProps) {
  const items = articles.slice(0, 6)
  if (!items.length) {
    return (
      <div className="ticker ticker--empty" aria-hidden="true">
        <span className="ticker__label">{t('AGORA')}</span>
        <span className="ticker__static">{t('acendendo o farol…')}</span>
      </div>
    )
  }
  const loop = [...items, ...items]
  return (
    <div className="ticker" aria-label={t('Manchetes agora')}>
      <span className="ticker__label">
        <span className="ticker__pulse" />
        {t('AGORA')}
      </span>
      <div className="ticker__viewport">
        <div className="ticker__track">
          {loop.map((article, index) => (
            <button
              key={`${article.id}-${index}`}
              className="ticker__item"
              onClick={() => onOpen(article)}
              tabIndex={index < items.length ? 0 : -1}
              aria-hidden={index >= items.length}
            >
              <span className="ticker__src">{sourceMap.get(article.sourceId)?.short ?? article.sourceId}</span>
              <span className="ticker__headline">{article.title}</span>
              <span className="ticker__time">{relativeTime(article.publishedAt)}</span>
              <span className="ticker__sep" aria-hidden="true">◆</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
