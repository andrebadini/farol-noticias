import { BeaconMark } from './Art'
import { BookmarkIcon, SearchIcon } from './Icons'

interface HeaderProps {
  updatedAt: string
  online: number
  totalSources: number
  savedCount: number
  onSaved: () => void
  onSearch: () => void
  stale: boolean
}

function ago(iso: string): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at) || at < 1_000_000) return 'conectando'
  const min = Math.max(0, Math.floor((Date.now() - at) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  return `há ${Math.floor(min / 60)} h`
}

export function Header({ updatedAt, online, totalSources, savedCount, onSaved, onSearch, stale }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark">
          <BeaconMark size={22} />
        </span>
        <div className="topbar__word">
          <span className="wordmark">Farol</span>
          <span className="topbar__sub">notícias do Brasil</span>
        </div>
      </div>

      <div className="topbar__status" title={`${online} de ${totalSources} fontes no ar`}>
        <span className={`live-dot ${stale ? 'is-stale' : ''}`} />
        <span className="topbar__ago">{stale ? 'cache' : ago(updatedAt)}</span>
      </div>

      <div className="topbar__actions">
        <button className="icon-btn" onClick={onSaved} aria-label={`Salvos${savedCount ? `, ${savedCount} matérias` : ''}`}>
          <BookmarkIcon size={21} />
          {savedCount > 0 && <span className="icon-btn__badge">{savedCount > 99 ? '99+' : savedCount}</span>}
        </button>
        <button className="icon-btn" onClick={onSearch} aria-label="Buscar notícias">
          <SearchIcon size={21} />
        </button>
      </div>
    </header>
  )
}
