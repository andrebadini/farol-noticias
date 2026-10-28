import type { ArticleMeta, SourceInfo } from '../types'

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

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
  const seen = new Set<string>()
  const items = articles
    .filter((article) => {
      if (seen.has(article.sourceId)) return false
      seen.add(article.sourceId)
      return true
    })
    .slice(0, 4)
  return (
    <div className="mini-glasses" role="img" aria-label="Prévia aproximada do que aparece nos óculos">
      <div className="mini-glasses__screen">
        <div className="mini-glasses__top">
          <span>◈ FAROL</span>
          <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="mini-glasses__topic">
          {(filterName ?? 'TUDO').toUpperCase()} · {total} NOTÍCIAS
        </div>
        <div className="mini-glasses__list">
          {items.length ? (
            items.map((article, index) => (
              <div key={article.id} className={`mini-glasses__row ${index === 0 ? 'is-active' : ''}`}>
                <b>{sources.get(article.sourceId)?.short ?? article.sourceId}</b>
                <span>{cut(article.title, 46)}</span>
              </div>
            ))
          ) : (
            <div className="mini-glasses__empty">◈ Sem notícias agora — 2× para atualizar</div>
          )}
        </div>
        <div className="mini-glasses__hint">▲▼ rolar · ● abrir · 2× menu</div>
      </div>
      <span className="mini-glasses__caption">prévia aproximada do visor · 576 × 288</span>
    </div>
  )
}
