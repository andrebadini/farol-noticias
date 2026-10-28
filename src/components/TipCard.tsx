import { useState } from 'react'
import { GlassesIcon } from './Icons'
import { BeaconMark } from './Art'

export function TipCard({ onDismiss, onOpenGlasses }: { onDismiss: () => void; onOpenGlasses: () => void }) {
  const [leaving, setLeaving] = useState(false)
  return (
    <aside className={`tip ${leaving ? 'is-leaving' : ''}`} aria-label="Dica de uso">
      <div className="tip__art" aria-hidden="true">
        <BeaconMark size={26} />
        <span className="tip__ring" />
      </div>
      <div className="tip__body">
        <span className="eyebrow">primeira vez aqui</span>
        <strong>O jornal também mora nos óculos</strong>
        <p>Dois toques no G2 abrem o menu. Deslize para virar a página e salve aqui para ler lá.</p>
        <div className="tip__actions">
          <button className="btn btn--ink btn--sm" onClick={onOpenGlasses}>
            <GlassesIcon size={16} />
            Ver gestos
          </button>
          <button
            className="link-btn"
            onClick={() => {
              setLeaving(true)
              setTimeout(onDismiss, 220)
            }}
          >
            Entendi
          </button>
        </div>
      </div>
    </aside>
  )
}
