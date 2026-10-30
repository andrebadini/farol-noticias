import type { SavedIndexEntry, SourceInfo } from '../types'
import { ArticleRow } from './ArticleRow'
import { EmptyArt } from './Art'
import { BookmarkIcon, CheckIcon, GlassesIcon, SignalIcon } from './Icons'
import { t } from '../lib/i18n'

export function SavedView({
  saved,
  sourceMap,
  onOpen,
  onRemove,
  onExplore,
}: {
  saved: SavedIndexEntry[]
  sourceMap: Map<string, SourceInfo>
  onOpen: (entry: SavedIndexEntry) => void
  onRemove: (entry: SavedIndexEntry) => void
  onExplore: () => void
}) {
  return (
    <section className="saved">
      <header className="page-title">
        <span className="eyebrow">{t('seu recorte')}</span>
        <h1>{t('Salvos')}</h1>
        <p>
          {saved.length > 0
            ? t(saved.length === 1 ? '{n} matéria guardada no seu celular — leia quando quiser, mesmo sem sinal.' : '{n} matérias guardadas no seu celular — leia quando quiser, mesmo sem sinal.', { n: saved.length })
            : t('Guarde o que quer ler depois. Fica no celular e também no menu dos óculos.')}
        </p>
      </header>

      {saved.length === 0 ? (
        <div className="empty empty--saved">
          <EmptyArt />
          <h2>{t('Seu farol pessoal começa aqui')}</h2>
          <p>
            {t('Toque no marcador de uma matéria para salvá-la. No G2, dois toques abrem o menu e')}{' '}
            <strong>★ {t('Salvar')}</strong>.
          </p>
          <button className="btn btn--ink" onClick={onExplore}>
            <SignalIcon size={17} />
            {t('Explorar a edição')}
          </button>
        </div>
      ) : (
        <>
          <div className="saved__chips">
            <span className="meta-chip"><BookmarkIcon size={14} /> {t('offline')}</span>
            <span className="meta-chip"><GlassesIcon size={14} /> {t('nos óculos')}</span>
            <span className="meta-chip"><CheckIcon size={14} /> {t('sem login')}</span>
          </div>
          <div className="feed__list feed__list--saved">
            {saved.map((entry) => (
              <ArticleRow
                key={entry.id}
                article={entry}
                source={sourceMap.get(entry.sourceId)}
                saved
                onOpen={() => onOpen(entry)}
                onToggleSave={() => onRemove(entry)}
                variant="saved"
              />
            ))}
          </div>
          <div className="saved__foot">
            <span aria-hidden="true">◈</span>
            {t('Salvo no armazenamento do Even Hub — não some ao fechar o app.')}
          </div>
        </>
      )}
    </section>
  )
}
