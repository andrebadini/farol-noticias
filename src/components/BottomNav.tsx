import type { TabId } from '../types'
import { BookmarkIcon, SearchIcon, SettingsIcon, SignalIcon } from './Icons'

const ITEMS: Array<{ id: TabId; label: string; icon: typeof SignalIcon }> = [
  { id: 'agora', label: 'Agora', icon: SignalIcon },
  { id: 'buscar', label: 'Buscar', icon: SearchIcon },
  { id: 'salvos', label: 'Salvos', icon: BookmarkIcon },
  { id: 'ajustes', label: 'Ajustes', icon: SettingsIcon },
]

export function BottomNav({
  tab,
  onChange,
  savedCount,
}: {
  tab: TabId
  onChange: (tab: TabId) => void
  savedCount: number
}) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const active = tab === id
        return (
          <button
            key={id}
            className={`bottom-nav__item ${active ? 'is-active' : ''}`}
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav__iconwrap">
              <Icon size={22} />
              {id === 'salvos' && savedCount > 0 && <span className="bottom-nav__badge">{savedCount > 9 ? '9+' : savedCount}</span>}
            </span>
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
