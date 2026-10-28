import type { SourceInfo } from '../types'
import { SourceBadge } from './SourceBadge'
import { ChevronRightIcon, SignalIcon } from './Icons'

export function SourceRail({
  sources,
  active,
  onPick,
  onAll,
  onOpenAll,
}: {
  sources: SourceInfo[]
  active: string | null
  onPick: (id: string) => void
  onAll: () => void
  onOpenAll: () => void
}) {
  const shown = sources.filter((source) => source.count > 0).slice(0, 12)
  if (!shown.length) return null
  return (
    <section className="rail" aria-label="Fontes desta edição">
      <div className="rail__head">
        <span className="eyebrow">no radar</span>
        <button className="link-btn" onClick={onOpenAll}>
          todas as fontes <ChevronRightIcon size={13} />
        </button>
      </div>
      <div className="rail__scroll">
        <button className={`rail-card rail-card--all ${active === null ? 'is-active' : ''}`} onClick={onAll}>
          <span className="rail-card__icon"><SignalIcon size={18} /></span>
          <span className="rail-card__name">Tudo</span>
          <span className="rail-card__count">{sources.reduce((sum, source) => sum + source.count, 0)} matérias</span>
        </button>
        {shown.map((source) => (
          <button
            key={source.id}
            className={`rail-card ${active === source.id ? 'is-active' : ''}`}
            onClick={() => onPick(source.id)}
            style={{ ['--rail-color' as string]: source.color }}
          >
            <SourceBadge source={source} size="md" />
            <span className="rail-card__name">{source.name}</span>
            <span className="rail-card__count">{source.count} matérias</span>
            <span className="rail-card__line" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  )
}
