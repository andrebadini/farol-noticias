import { useEffect, useState } from 'react'
import type { ArticleMeta, SourceInfo } from '../types'
import { ArticleRow } from './ArticleRow'
import { EmptyArt } from './Art'
import { RefreshIcon, SparkIcon } from './Icons'
import { t } from '../lib/i18n'

const PAGE = 30

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
}) {
  const [visible, setVisible] = useState(PAGE)
  const signature = `${articles.length}:${articles[0]?.id ?? ''}`

  useEffect(() => {
    setVisible(PAGE)
  }, [signature])

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

      {visible < articles.length ? (
        <button className="load-more" onClick={() => setVisible((n) => n + PAGE)}>
          {t('Carregar mais')}
          <span>{t('{n} restantes', { n: Math.min(PAGE, articles.length - visible) })}</span>
        </button>
      ) : (
        <div className="feed__end">
          <span className="feed__end-mark" aria-hidden="true">◈</span>
          {t('Você chegou ao fim da edição. O app se atualiza sozinho a cada 15 minutos.')}
        </div>
      )}
    </section>
  )
}

