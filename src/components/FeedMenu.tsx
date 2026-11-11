import { useEffect } from 'react'
import {
  BookmarkIcon,
  CloseIcon,
  RefreshIcon,
  SettingsIcon,
  SlidersIcon,
} from './Icons'
import { t } from '../lib/i18n'

export function FeedMenu({
  total,
  savedCount,
  updatedAt,
  hasFilters,
  glassesLabel,
  onRefresh,
  onFilter,
  onSaved,
  onSettings,
  onResetFilters,
  onTop,
  onClose,
}: {
  total: number
  savedCount: number
  updatedAt: string
  hasFilters: boolean
  glassesLabel: string
  onRefresh: () => void
  onFilter: () => void
  onSaved: () => void
  onSettings: () => void
  onResetFilters: () => void
  onTop: () => void
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

  return (
    <div className="sheet-layer" role="presentation" onClick={onClose}>
      <div
        className="sheet feed-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-menu-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <div>
            <span className="eyebrow">{t('fim da edição')}</span>
            <h2 id="feed-menu-title">{t('Menu da edição')}</h2>
            <p>{t('{n} matérias · {updated}', { n: total, updated: updatedAt })}</p>
          </div>
          <button className="icon-btn icon-btn--round" onClick={onClose} aria-label={t('Fechar menu')}>
            <CloseIcon size={19} />
          </button>
        </header>

        <div className="feed-menu__list">
          <button className="feed-menu__item" onClick={onRefresh}>
            <span className="feed-menu__icon"><RefreshIcon size={19} /></span>
            <span className="feed-menu__copy">
              <strong>{t('Atualizar notícias')}</strong>
              <span>{t('Buscar novidades agora')}</span>
            </span>
            <span className="feed-menu__meta">{updatedAt}</span>
          </button>

          <button className="feed-menu__item" onClick={onFilter}>
            <span className="feed-menu__icon"><SlidersIcon size={19} /></span>
            <span className="feed-menu__copy">
              <strong>{t('Filtrar por fonte')}</strong>
              <span>{t('Escolher os veículos da edição')}</span>
            </span>
            <span className="feed-menu__meta">{hasFilters ? t('com filtro') : t('todas')}</span>
          </button>

          <button className="feed-menu__item" onClick={onSaved}>
            <span className="feed-menu__icon"><BookmarkIcon size={19} /></span>
            <span className="feed-menu__copy">
              <strong>{t('Matérias salvas')}</strong>
              <span>{t('Ler no celular, mesmo offline')}</span>
            </span>
            <span className="feed-menu__meta">{savedCount}</span>
          </button>

          <button className="feed-menu__item" onClick={onSettings}>
            <span className="feed-menu__icon"><SettingsIcon size={19} /></span>
            <span className="feed-menu__copy">
              <strong>{t('Ajustes e óculos')}</strong>
              <span>{t('Tema, leitura e prévia do G2')}</span>
            </span>
            <span className="feed-menu__meta">{glassesLabel}</span>
          </button>

          {hasFilters && (
            <button className="feed-menu__item" onClick={onResetFilters}>
              <span className="feed-menu__icon"><CloseIcon size={19} /></span>
              <span className="feed-menu__copy">
                <strong>{t('Limpar filtros')}</strong>
                <span>{t('Voltar à edição completa')}</span>
              </span>
            </button>
          )}

          <button className="feed-menu__item" onClick={onTop}>
            <span className="feed-menu__icon feed-menu__icon--glyph" aria-hidden="true">↑</span>
            <span className="feed-menu__copy">
              <strong>{t('Voltar ao topo')}</strong>
              <span>{t('As notícias mais recentes')}</span>
            </span>
          </button>
        </div>

        <footer className="sheet__foot">
          <p>{t('A edição se atualiza sozinha a cada 15 minutos.')}</p>
          <button className="btn btn--ink btn--sm" onClick={onClose}>{t('Pronto')}</button>
        </footer>
      </div>
    </div>
  )
}
