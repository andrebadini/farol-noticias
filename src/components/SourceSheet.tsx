import { useEffect } from 'react'
import type { SourceInfo } from '../types'
import { CheckIcon, CloseIcon, SignalIcon } from './Icons'
import { SourceBadge } from './SourceBadge'

export function SourceSheet({
  sources,
  enabled,
  onToggle,
  onAll,
  onClose,
}: {
  sources: SourceInfo[]
  enabled: Set<string>
  onToggle: (id: string) => void
  onAll: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const all = enabled.size === sources.length
  return (
    <div className="sheet-layer" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sources-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <div>
            <span className="eyebrow">monte seu farol</span>
            <h2 id="sources-title">Suas fontes</h2>
            <p>O recorte vale para o celular e para a lista nos óculos.</p>
          </div>
          <button className="icon-btn icon-btn--round" onClick={onClose} aria-label="Fechar">
            <CloseIcon size={19} />
          </button>
        </header>

        <button className={`source-row source-row--all ${all ? 'is-on' : ''}`} onClick={onAll}>
          <span className="source-row__all"><SignalIcon size={18} /></span>
          <span className="source-row__grow">
            <strong>Todas as fontes</strong>
            <span>{sources.length} veículos · edição completa</span>
          </span>
          <span className={`check ${all ? 'is-on' : ''}`}>{all && <CheckIcon size={14} />}</span>
        </button>

        <div className="source-list">
          {sources.map((source) => {
            const on = enabled.has(source.id)
            return (
              <button key={source.id} className={`source-row ${on ? 'is-on' : ''}`} onClick={() => onToggle(source.id)}>
                <SourceBadge source={source} size="md" />
                <span className="source-row__grow">
                  <strong>{source.name}</strong>
                  <span>
                    {source.kind} · {source.tag}
                    {!source.ok && <em className="source-row__off"> fora do ar</em>}
                  </span>
                </span>
                <span className="source-row__count">{source.count}</span>
                <span className={`check ${on ? 'is-on' : ''}`}>{on && <CheckIcon size={14} />}</span>
              </button>
            )
          })}
        </div>

        <footer className="sheet__foot">
          <p>
            <strong>{enabled.size}</strong> de {sources.length} fontes ativas. As escolhas ficam
            salvas no celular.
          </p>
          <button className="btn btn--ink btn--sm" onClick={onClose}>Pronto</button>
        </footer>
      </div>
    </div>
  )
}
