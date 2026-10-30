import type { ArticleMeta, LatestPayload, SavedIndexEntry, Settings, SourceInfo } from '../types'
import { DATA_ENDPOINT } from '../lib/api'
import { generatedLabel } from '../lib/time'
import { resolveLanguage, t } from '../lib/i18n'
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
      ? t('óculos conectados')
      : glasses.state === 'connecting'
        ? t('procurando óculos…')
        : glasses.state === 'error'
          ? t('não foi possível falar com os óculos')
          : t('modo navegador')
  const detected = resolveLanguage('auto')
  const languageHint =
    settings.language === 'auto'
      ? t(detected === 'pt' ? 'Detectado: Português' : 'Detectado: English')
      : settings.language === 'pt'
        ? 'Português'
        : 'English'

  const battery = typeof glasses.battery === 'number' ? `${glasses.battery}%` : null

  return (
    <section className="settings">
      <header className="page-title">
        <span className="eyebrow">{t('seu farol, do seu jeito')}</span>
        <h1>{t('Ajustes')}</h1>
        <p>{t('Controle a edição, o tamanho da leitura e o que aparece nos óculos.')}</p>
      </header>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>{t('Idioma')}</h2>
          <span className="settings-card__hint">{languageHint}</span>
        </div>
        <div className="setting-row setting-row--stack">
          <span className="setting-row__label">{t('Idioma do app')}</span>
          <div className="segmented segmented--three">
            {[
              { id: 'auto' as const, label: t('Automático') },
              { id: 'pt' as const, label: 'Português' },
              { id: 'en' as const, label: 'English' },
            ].map(({ id, label }) => (
              <button
                key={id}
                className={`segmented__item ${settings.language === id ? 'is-active' : ''}`}
                onClick={() => onChange({ language: id })}
                aria-pressed={settings.language === id}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="setting-row__desc">{t('Interface do app. As notícias continuam em português.')}</span>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>{t('Leitura')}</h2>
          <span className="settings-card__hint">{t('vale para o celular')}</span>
        </div>

        <div className="setting-row setting-row--stack">
          <span className="setting-row__label">{t('Aparência')}</span>
          <div className="segmented segmented--three">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`segmented__item ${settings.theme === id ? 'is-active' : ''}`}
                onClick={() => onChange({ theme: id })}
                aria-pressed={settings.theme === id}
              >
                <Icon size={16} />
                {t(label)}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div>
            <span className="setting-row__label">{t('Tamanho do texto')}</span>
            <span className="setting-row__desc">{t('No leitor de matérias')}</span>
          </div>
          <div className="font-stepper">
            <button
              onClick={() => onChange({ fontScale: Math.max(0.9, Number((settings.fontScale - 0.06).toFixed(2))) })}
              aria-label={t('Diminuir texto')}
            >
              A−
            </button>
            <span>{Math.round(settings.fontScale * 100)}%</span>
            <button
              onClick={() => onChange({ fontScale: Math.min(1.3, Number((settings.fontScale + 0.06).toFixed(2))) })}
              aria-label={t('Aumentar texto')}
            >
              A+
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <span className="setting-row__label">{t('Dicas de uso')}</span>
            <span className="setting-row__desc">{t('Atalhos para os gestos dos óculos')}</span>
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
          <h2>{t('Atualização')}</h2>
          <span className="settings-card__hint">{t('servidor a cada 15 min')}</span>
        </div>

        <div className="setting-row setting-row--stack">
          <span className="setting-row__label">{t('Buscar novidades a cada')}</span>
          <div className="segmented segmented--four">
            {INTERVALS.map(({ value, label }) => (
              <button
                key={value}
                className={`segmented__item ${settings.refreshMinutes === value ? 'is-active' : ''}`}
                onClick={() => onChange({ refreshMinutes: value })}
                aria-pressed={settings.refreshMinutes === value}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div>
            <span className="setting-row__label">{t('Edição atual')}</span>
            <span className="setting-row__desc">
              {latest ? generatedLabel(latest.generatedAt) : t('carregando')} · {t('{n} matérias', { n: latest?.total ?? 0 })}
            </span>
          </div>
          <button className="btn btn--soft btn--sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshIcon size={15} className={refreshing ? 'spin' : ''} />
            {t('Atualizar')}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>{t('Fontes')}</h2>
          <span className="settings-card__hint">{t('{n} de {total} ativas', { n: enabledCount, total: totalSources })}</span>
        </div>
        <button className="setting-row setting-row--button" onClick={onOpenSources}>
          <span className="setting-row__icon"><SlidersIcon size={19} /></span>
          <span className="setting-row__grow">
            <span className="setting-row__label">{t('Escolher veículos')}</span>
            <span className="setting-row__desc">{t('G1, Folha, Valor, Crusoé, Intercept e mais')}</span>
          </span>
          <ChevronRightIcon size={18} />
        </button>
        <div className="source-preview">
          {[...sourceMap.values()].slice(0, 9).map((source) => (
            <span key={source.id} className="source-preview__dot" style={{ background: source.color }} title={source.name} />
          ))}
          <span className="source-preview__more">+{Math.max(0, totalSources - 9)}</span>
          <span className="source-preview__text">
            {t(enabledCount < totalSources ? 'você está com um recorte' : 'edição completa')}
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
          <div><kbd>▲</kbd><span>{t('Deslizar')}</span><small>{t('navegar / virar página')}</small></div>
          <div><kbd>●</kbd><span>{t('1 toque')}</span><small>{t('abrir a matéria')}</small></div>
          <div><kbd>●●</kbd><span>{t('2 toques')}</span><small>{t('menu de ações')}</small></div>
          <div><kbd>↻</kbd><span>{t('Atualizar')}</span><small>{t('2 toques → Atualizar')}</small></div>
        </div>

        <div className="glasses-actions">
          <button className="btn btn--soft btn--sm" onClick={onSendTop}>
            <GlassesIcon size={16} />
            {t('Enviar a manchete')}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onToast(t('No celular, use o botão “Ler nos óculos” dentro de qualquer matéria.'))}
          >
            {t('Como funciona')}
          </button>
        </div>
        {glasses.state === 'unavailable' && (
          <p className="settings-note">
            {t('Sem óculos por perto, o app segue funcionando aqui. Abra o app no Even Hub com o G2 conectado para espelhar as matérias.')}
          </p>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card__head">
          <h2>{t('Dados e privacidade')}</h2>
        </div>
        <div className="setting-row">
          <div>
            <span className="setting-row__label">{t('Snapshots de notícias')}</span>
            <span className="setting-row__desc data-endpoint">{DATA_ENDPOINT.replace('https://', '')}</span>
          </div>
          <button
            className="icon-btn icon-btn--soft"
            aria-label={t('Abrir endpoint de dados')}
            onClick={() => window.open(`${DATA_ENDPOINT}/latest.json`, '_blank', 'noopener')}
          >
            <ExternalIcon size={17} />
          </button>
        </div>
        <button
          className="setting-row setting-row--button"
          onClick={async () => {
            if (!window.confirm(t('Limpar o cache de notícias? Seus salvos continuam guardados.'))) return
            await onClearCache()
            onToast(t('Cache limpo. O Farol Diário vai buscar novidades.'))
          }}
        >
          <span className="setting-row__icon"><TrashIcon size={18} /></span>
          <span className="setting-row__grow">
            <span className="setting-row__label">{t('Limpar cache')}</span>
            <span className="setting-row__desc">{t('Mantém os salvos no celular')}</span>
          </span>
          <ChevronRightIcon size={18} />
        </button>
        <div className="setting-row">
          <div>
            <span className="setting-row__label">{t('Salvos offline')}</span>
            <span className="setting-row__desc">{t(saved.length === 1 ? '{n} matéria guardada' : '{n} matérias guardadas', { n: saved.length })} {t('no Even Hub')}</span>
          </div>
          <BookmarkIcon size={18} />
        </div>
        <p className="settings-note">
          {t('O app não tem login nem rastreamento. As notícias vêm de feeds públicos dos veículos; favoritos e ajustes ficam no armazenamento do seu celular via Even Hub.')}
        </p>
      </div>

      <footer className="about">
        <span className="about__mark" aria-hidden="true">◈</span>
        <div>
          <strong>Farol Diário</strong>
          <span>{t('versão 1.0.0 · feito para Even Realities G2')}</span>
          <button className="about__link" onClick={() => window.open('https://github.com/andrebadini/farol-noticias', '_blank', 'noopener')}>
            github.com/andrebadini/farol-noticias <ExternalIcon size={12} />
          </button>
        </div>
        <span className="about__check"><CheckIcon size={16} /></span>
      </footer>
    </section>
  )
}
