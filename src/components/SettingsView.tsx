import type { ArticleMeta, LatestPayload, SavedIndexEntry, Settings, SourceInfo } from '../types'
import { DATA_ENDPOINT } from '../lib/api'
import { generatedLabel } from '../lib/time'
import type { GlassesStatus } from '../lib/glasses'
import { MiniGlasses } from './MiniGlasses'
import {
  BookmarkIcon,
  CheckIcon,
  ChevronRightIcon,
  ExternalIcon,
  GlassesIcon,
  MonitorIcon,
  MoonIcon,
  RefreshIcon,
  SlidersIcon,
  SunIcon,
  TrashIcon,
} from './Icons'

const THEMES: Array<{ id: Settings['theme']; label: string; icon: typeof SunIcon }> = [
  { id: 'system', label: 'Sistema', icon: MonitorIcon },
  { id: 'light', label: 'Claro', icon: SunIcon },
  { id: 'dark', label: 'Escuro', icon: MoonIcon },
]

const INTERVALS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 0, label: 'Manual' },
]

export function SettingsView({
  settings,
  onChange,
  glasses,
  latest,
  previewArticles,
  previewTotal,
  saved,
  sourceMap,
  enabledCount,
  totalSources,
  filterName,
  onOpenSources,
  onRefresh,
  refreshing,
  onClearCache,
  onSendTop,
  onToast,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  glasses: GlassesStatus
  latest: LatestPayload | null
  previewArticles: ArticleMeta[]
  previewTotal: number
  saved: SavedIndexEntry[]
  sourceMap: Map<string, SourceInfo>
  enabledCount: number
  totalSources: number
  filterName: string | null
  onOpenSources: () => void
  onRefresh: () => void
  refreshing: boolean
  onClearCache: () => Promise<void>
  onSendTop: () => void
  onToast: (message: string) => void
}) {
  const statusLabel =
    glasses.state === 'ready'
      ? 'óculos conectados'
      : glasses.state === 'connecting'
        ? 'procurando óculos…'
        : glasses.state === 'error'
          ? 'não foi possível falar com os óculos'
          : 'modo navegador'

  const battery = typeof glasses.battery === 'number' ? `${glasses.battery}%` : null

  return (
    <section className="settings">
      <header className="page-title">
        <span className="eyebrow">seu farol, do seu jeito</span>
        <h1>Ajustes</h1>
        <p>Controle a edição, o tamanho da leitura e o que aparece nos óculos.</p>
      </header>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>Leitura</h2>
          <span className="settings-card__hint">vale para o celular</span>
        </div>

        <div className="setting-row setting-row--stack">
          <span className="setting-row__label">Aparência</span>
          <div className="segmented segmented--three">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`segmented__item ${settings.theme === id ? 'is-active' : ''}`}
                onClick={() => onChange({ theme: id })}
                aria-pressed={settings.theme === id}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div>
            <span className="setting-row__label">Tamanho do texto</span>
            <span className="setting-row__desc">No leitor de matérias</span>
          </div>
          <div className="font-stepper">
            <button
              onClick={() => onChange({ fontScale: Math.max(0.9, Number((settings.fontScale - 0.06).toFixed(2))) })}
              aria-label="Diminuir texto"
            >
              A−
            </button>
            <span>{Math.round(settings.fontScale * 100)}%</span>
            <button
              onClick={() => onChange({ fontScale: Math.min(1.3, Number((settings.fontScale + 0.06).toFixed(2))) })}
              aria-label="Aumentar texto"
            >
              A+
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <span className="setting-row__label">Dicas de uso</span>
            <span className="setting-row__desc">Atalhos para os gestos dos óculos</span>
          </div>
          <button
            className={`switch ${settings.showTips ? 'is-on' : ''}`}
            role="switch"
            aria-checked={settings.showTips}
            onClick={() => onChange({ showTips: !settings.showTips })}
          >
            <span />
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>Atualização</h2>
          <span className="settings-card__hint">servidor a cada 15 min</span>
        </div>

        <div className="setting-row setting-row--stack">
          <span className="setting-row__label">Buscar novidades a cada</span>
          <div className="segmented segmented--four">
            {INTERVALS.map(({ value, label }) => (
              <button
                key={value}
                className={`segmented__item ${settings.refreshMinutes === value ? 'is-active' : ''}`}
                onClick={() => onChange({ refreshMinutes: value })}
                aria-pressed={settings.refreshMinutes === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div>
            <span className="setting-row__label">Edição atual</span>
            <span className="setting-row__desc">
              {latest ? generatedLabel(latest.generatedAt) : 'carregando'} · {latest?.total ?? 0} matérias
            </span>
          </div>
          <button className="btn btn--soft btn--sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshIcon size={15} className={refreshing ? 'spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>Fontes</h2>
          <span className="settings-card__hint">{enabledCount} de {totalSources} ativas</span>
        </div>
        <button className="setting-row setting-row--button" onClick={onOpenSources}>
          <span className="setting-row__icon"><SlidersIcon size={19} /></span>
          <span className="setting-row__grow">
            <span className="setting-row__label">Escolher veículos</span>
            <span className="setting-row__desc">G1, Folha, Valor, Crusoé, Intercept e mais</span>
          </span>
          <ChevronRightIcon size={18} />
        </button>
        <div className="source-preview">
          {[...sourceMap.values()].slice(0, 9).map((source) => (
            <span key={source.id} className="source-preview__dot" style={{ background: source.color }} title={source.name} />
          ))}
          <span className="source-preview__more">+{Math.max(0, totalSources - 9)}</span>
          <span className="source-preview__text">
            {enabledCount < totalSources ? 'você está com um recorte' : 'edição completa'}
          </span>
        </div>
      </div>

      <div className="settings-card settings-card--glasses" id="glasses-card">
        <div className="settings-card__head">
          <h2>Even Realities G2</h2>
          <span className={`status-pill ${glasses.state === 'ready' ? 'is-online' : ''}`}>
            <span className="live-dot" />
            {statusLabel}
            {battery ? ` · ${battery}` : ''}
          </span>
        </div>

        <MiniGlasses
          articles={previewArticles}
          total={previewTotal}
          sources={sourceMap}
          filterName={filterName}
        />

        <div className="gesture-grid">
          <div><kbd>▲</kbd><span>Deslizar</span><small>navegar / virar página</small></div>
          <div><kbd>●</kbd><span>1 toque</span><small>abrir a matéria</small></div>
          <div><kbd>●●</kbd><span>2 toques</span><small>menu de ações</small></div>
          <div><kbd>↻</kbd><span>Atualizar</span><small>2 toques → Atualizar</small></div>
        </div>

        <div className="glasses-actions">
          <button className="btn btn--soft btn--sm" onClick={onSendTop}>
            <GlassesIcon size={16} />
            Enviar a manchete
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onToast('No celular, use o botão “Ler nos óculos” dentro de qualquer matéria.')}
          >
            Como funciona
          </button>
        </div>
        {glasses.state === 'unavailable' && (
          <p className="settings-note">
            Sem óculos por perto, o Farol segue funcionando aqui. Abra o app no Even Hub com o G2
            conectado para espelhar as matérias.
          </p>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>Dados e privacidade</h2>
        </div>
        <div className="setting-row">
          <div>
            <span className="setting-row__label">Snapshots de notícias</span>
            <span className="setting-row__desc data-endpoint">{DATA_ENDPOINT.replace('https://', '')}</span>
          </div>
          <button
            className="icon-btn icon-btn--soft"
            aria-label="Abrir endpoint de dados"
            onClick={() => window.open(`${DATA_ENDPOINT}/latest.json`, '_blank', 'noopener')}
          >
            <ExternalIcon size={17} />
          </button>
        </div>
        <button
          className="setting-row setting-row--button"
          onClick={async () => {
            if (!window.confirm('Limpar o cache de notícias? Seus salvos continuam guardados.')) return
            await onClearCache()
            onToast('Cache limpo. O Farol vai buscar novidades.')
          }}
        >
          <span className="setting-row__icon"><TrashIcon size={18} /></span>
          <span className="setting-row__grow">
            <span className="setting-row__label">Limpar cache</span>
            <span className="setting-row__desc">Mantém os salvos no celular</span>
          </span>
          <ChevronRightIcon size={18} />
        </button>
        <div className="setting-row">
          <div>
            <span className="setting-row__label">Salvos offline</span>
            <span className="setting-row__desc">{saved.length === 1 ? '1 matéria guardada' : `${saved.length} matérias guardadas`} no Even Hub</span>
          </div>
          <BookmarkIcon size={18} />
        </div>
        <p className="settings-note">
          O Farol não tem login nem rastreamento. As notícias vêm de feeds públicos dos veículos;
          favoritos e ajustes ficam no armazenamento do seu celular via Even Hub.
        </p>
      </div>

      <footer className="about">
        <span className="about__mark" aria-hidden="true">◈</span>
        <div>
          <strong>Farol Notícias</strong>
          <span>versão 1.0.0 · feito para Even Realities G2</span>
          <button className="about__link" onClick={() => window.open('https://github.com/andrebadini/farol-noticias', '_blank', 'noopener')}>
            github.com/andrebadini/farol-noticias <ExternalIcon size={12} />
          </button>
        </div>
        <span className="about__check"><CheckIcon size={16} /></span>
      </footer>
    </section>
  )
}
