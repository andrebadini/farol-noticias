import type { CategoryId } from '../types'
import { CATEGORY_META, CATEGORY_ORDER } from '../data/meta'
import { CloseIcon, SlidersIcon } from './Icons'
import { t } from '../lib/i18n'

interface FilterBarProps {
  category: CategoryId | 'tudo'
  onCategory: (category: CategoryId | 'tudo') => void
  counts: Map<CategoryId | 'tudo', number>
  sourceFilter: string | null
  sourceName: string | null
  onClearSource: () => void
  onOpenSources: () => void
  enabledCount: number
  totalSources: number
}

export function FilterBar({
  category,
  onCategory,
  counts,
  sourceFilter,
  sourceName,
  onClearSource,
  onOpenSources,
  enabledCount,
  totalSources,
}: FilterBarProps) {
  return (
    <div className="filters">
      <div className="filters__scroll" role="tablist" aria-label={t('Categorias')}>
        <button
          role="tab"
          aria-selected={category === 'tudo'}
          className={`chip ${category === 'tudo' ? 'is-active' : ''}`}
          onClick={() => onCategory('tudo')}
        >
          {t('Tudo')}
          <span className="chip__count">{counts.get('tudo') ?? 0}</span>
        </button>
        {CATEGORY_ORDER.filter((id) => (counts.get(id) ?? 0) > 0).map((id) => {
          const meta = CATEGORY_META[id]
          return (
            <button
              key={id}
              role="tab"
              aria-selected={category === id}
              className={`chip ${category === id ? 'is-active' : ''}`}
              onClick={() => onCategory(id)}
            >
              <span className="chip__glyph" style={{ color: category === id ? 'var(--accent-ink)' : meta.hue }}>
                {meta.glyph}
              </span>
              {t(meta.name)}
            </button>
          )
        })}
      </div>

      {sourceFilter && sourceName ? (
        <button className="source-chip" onClick={onClearSource} aria-label={t('Remover filtro de {source}', { source: sourceName })}>
          <span>{sourceName}</span>
          <CloseIcon size={14} />
        </button>
      ) : (
        <button
          className={`source-chip source-chip--open ${enabledCount < totalSources ? 'is-filtered' : ''}`}
          onClick={onOpenSources}
          aria-label={t('Filtrar por fontes')}
        >
          <SlidersIcon size={16} />
          <span>
            {enabledCount < totalSources ? `${enabledCount}/${totalSources}` : t('Fontes')}
          </span>
        </button>
      )}
    </div>
  )
}
