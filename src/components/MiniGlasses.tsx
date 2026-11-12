import type { ArticleMeta, SourceInfo } from '../types'
import { CATEGORY_META } from '../data/meta'
import { currentLanguage, t } from '../lib/i18n'
import { newsClock } from '../lib/time'
import { SourceBadge } from './SourceBadge'

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Prévia do visor: cabeçalho, card de destaque com borda, "A seguir" e rodapé com teclas. */
export function MiniGlasses({
  articles,
  total,
  sources,
  filterName,
}: {
  articles: ArticleMeta[]
  total: number
  sources: Map<string, SourceInfo>
  filterName: string | null
}) {
  const [focus, ...rest] = articles
  const next = rest.slice(0, 2)
  const when = focus ? newsClock(focus.publishedAt) : null
  const source = focus ? sources.get(focus.sourceId) : undefined
  const category = focus ? CATEGORY_META[focus.category]?.name ?? focus.category : ''
  const now = new Date().toLocaleTimeString(currentLanguage() === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="mini-glasses" role="img" aria-label={t('Prévia aproximada do que aparece nos óculos')}>
      <div className="mini-glasses__screen">
        <div className="mini-glasses__top">
          <span className="mini-glasses__mark" aria-hidden="true"><i /><i /><i /><b /></span>
          <span>ALÉM DOS PONTOS  ·  {(filterName ?? t('TUDO')).toUpperCase()}  ·  {now}</span>
        </div>
        {focus ? (
          <div className="mini-glasses__card">
            <div className="mini-glasses__source">
              <SourceBadge source={source} size="xs" fallback={focus.sourceId} />
              <em>{source?.name ?? focus.sourceId}</em>
              <i>{t(category).toUpperCase()}{when ? ` · ${when.clock}` : ''}</i>
            </div>
            <p>{cut(focus.title, 110)}</p>
          </div>
        ) : (
          <div className="mini-glasses__card mini-glasses__empty">{t('◈  Sem notícias agora — toque para atualizar')}</div>
        )}
        <div className="mini-glasses__next">
          {next.map((article) => (
            <span key={article.id}>{cut(`${sources.get(article.sourceId)?.short ?? article.sourceId} · ${article.title}`, 64)}</span>
          ))}
        </div>
        <div className="mini-glasses__foot">
          <span>━━━─────  {focus ? 1 : 0}/{total}</span>
          <span className="mini-glasses__keys">
            <kbd>▲▼</kbd>{t('navegar')} <kbd>●</kbd>{t('abrir')} <kbd>●●</kbd>{t('sair')}
          </span>
        </div>
      </div>
      <span className="mini-glasses__caption">{t('prévia aproximada do visor · 576 × 288')}</span>
    </div>
  )
}
