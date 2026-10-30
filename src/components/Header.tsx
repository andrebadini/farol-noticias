import { BeaconMark } from './Art'
import { BookmarkIcon, SearchIcon } from './Icons'
import { t } from '../lib/i18n'

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
  if (!Number.isFinite(at) || at < 1_000_000) return t('conectando')
  const min = Math.max(0, Math.floor((Date.now() - at) / 60_000))
  if (min < 1) return t('agora')
  if (min < 60) return t('há {n} min', { n: min })
  return t('há {n} h', { n: Math.floor(min / 60) })
}

export function Header({ updatedAt, online, totalSources, savedCount, onSaved, onSearch, stale }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark">
          <BeaconMark size={22} />
        </span>
        <div className="topbar__word">
          <span className="wordmark">Farol Diário</span>
          <span className="topbar__sub">{t('notícias do Brasil')}</span>
        </div>
      </div>

      <div className="topbar__status" title={t('{online} de {total} fontes no ar', { online, total: totalSources })}>
        <span className={`live-dot ${stale ? 'is-stale' : ''}`} />
        <span className="topbar__ago">{stale ? t('cache') : ago(updatedAt)}</span>
      </div>

      <div className="topbar__actions">
        <button className="icon-btn" onClick={onSaved} aria-label={`${t('Salvos')}${savedCount ? `, ${t('{n} matérias', { n: savedCount })}` : ''}`}>
          <BookmarkIcon size={21} />
          {savedCount > 0 && <span className="icon-btn__badge">{savedCount > 99 ? '99+' : savedCount}</span>}
        </button>
        <button className="icon-btn" onClick={onSearch} aria-label={t('Buscar notícias')}>
          <SearchIcon size={21} />
        </button>
      </div>
    </header>
  )
}
