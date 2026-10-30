import { useMemo, useRef, useState } from 'react'
import type { ArticleMeta, SourceInfo } from '../types'
import { SEARCH_SUGGESTIONS } from '../data/meta'
import { useVoiceSearch } from '../lib/useVoiceSearch'
import { ArticleRow } from './ArticleRow'
import { EmptyArt } from './Art'
import { CloseIcon, MicIcon, SearchIcon, SparkIcon } from './Icons'
import { t } from '../lib/i18n'

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function SearchView({
  query,
  onQuery,
  articles,
  sourceMap,
  savedIds,
  onOpen,
  onToggleSave,
  recent,
  onRemember,
  onClearRecent,
}: {
  query: string
  onQuery: (value: string) => void
  articles: ArticleMeta[]
  sourceMap: Map<string, SourceInfo>
  savedIds: Set<string>
  onOpen: (article: ArticleMeta) => void
  onToggleSave: (article: ArticleMeta) => void
  recent: string[]
  onRemember: (query: string) => void
  onClearRecent: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [voiceHelp, setVoiceHelp] = useState(false)
  const voice = useVoiceSearch((text) => {
    onQuery(text)
    onRemember(text)
  })

  const results = useMemo(() => {
    const q = normalize(query.trim())
    if (q.length < 2) return []
    return articles
      .map((article) => {
        const title = normalize(article.title)
        const summary = normalize(article.summary)
        const source = normalize(sourceMap.get(article.sourceId)?.name ?? article.sourceId)
        const keywords = normalize(article.keywords ?? '')
        let score = 0
        if (title.startsWith(q)) score += 6
        else if (title.includes(q)) score += 4
        if (summary.includes(q)) score += 2
        if (source.includes(q)) score += 3
        if (keywords.includes(q)) score += 1
        return { article, score }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt))
      .slice(0, 60)
      .map((item) => item.article)
  }, [query, articles, sourceMap])

  function submit(value: string) {
    onQuery(value)
    if (value.trim().length > 2) onRemember(value.trim())
  }

  return (
    <section className="search">
      <header className="page-title">
        <span className="eyebrow">{t('em todas as fontes')}</span>
        <h1>{t('Buscar')}</h1>
        <p>{t('Procure por tema, veículo ou palavra-chave. Fale ou escreva.')}</p>
      </header>

      <form
        className={`searchbox ${voice.listening ? 'is-listening' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          submit(query)
          inputRef.current?.blur()
        }}
      >
        <SearchIcon size={20} className="searchbox__icon" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t('Ex.: eleições, dólar, Amazônia…')}
          aria-label={t('Buscar notícias')}
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="searchbox__clear" onClick={() => onQuery('')} aria-label={t('Limpar busca')}>
            <CloseIcon size={16} />
          </button>
        )}
        <button
          type="button"
          className={`searchbox__mic ${voice.listening ? 'is-on' : ''}`}
          onClick={() => {
            if (voice.listening) {
              voice.stop()
              return
            }
            const started = voice.start()
            if (!started) {
              setVoiceHelp(true)
              inputRef.current?.focus()
            }
          }}
          aria-label={t(voice.listening ? 'Parar de ouvir' : 'Buscar por voz')}
          aria-pressed={voice.listening}
        >
          <MicIcon size={20} />
        </button>
      </form>

      {voice.listening && (
        <div className="voice-panel" role="status">
          <div className="voice-panel__rings" aria-hidden="true">
            <span /><span /><span />
            <MicIcon size={20} />
          </div>
          <div>
            <strong>{t('Ouvindo…')}</strong>
            <p>{voice.interim || t('Fale o tema da busca.')}</p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={voice.stop}>{t('Parar')}</button>
        </div>
      )}

      {voice.error && voice.error !== 'unsupported' && (
        <div className="inline-alert" role="alert">
          <span>{voice.error}</span>
          <button onClick={voice.clearError} aria-label={t('Fechar aviso')}><CloseIcon size={14} /></button>
        </div>
      )}

      {(voiceHelp || !voice.supported) && (
        <div className="voice-tip">
          <span className="voice-tip__mark"><MicIcon size={17} /></span>
          <div>
            <strong>{t('Voz no bolso')}</strong>
            <p>
              {voice.supported
                ? t('O microfone do navegador está disponível. Se a permissão falhar, use o botão de ditado do teclado.')
                : t('O WebView do Even Hub não libera o microfone para páginas. Toque no microfone do teclado do celular e dite a busca — a busca entende igual.')}
            </p>
          </div>
          {voiceHelp && (
            <button className="voice-tip__close" onClick={() => setVoiceHelp(false)} aria-label={t('Fechar dica')}>
              <CloseIcon size={14} />
            </button>
          )}
        </div>
      )}

      {query.trim().length < 2 ? (
        <>
          <div className="search-section">
            <span className="eyebrow">{t('sugestões')}</span>
            <div className="suggestion-list">
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} className="suggestion" onClick={() => submit(suggestion)}>
                  <SparkIcon size={15} />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {recent.length > 0 && (
            <div className="search-section">
              <div className="search-section__head">
                <span className="eyebrow">{t('buscas recentes')}</span>
                <button className="link-btn" onClick={onClearRecent}>{t('limpar')}</button>
              </div>
              <div className="recent-list">
                {recent.map((term) => (
                  <button key={term} className="recent" onClick={() => submit(term)}>
                    <span className="recent__mark" aria-hidden="true">↺</span>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="search-note">
            <span aria-hidden="true">◈</span>
            <p>
              {t('A busca roda na edição carregada no seu celular — {n} matérias das principais fontes do Brasil. Sem enviar sua pesquisa para ninguém.', { n: articles.length })}
            </p>
          </div>
        </>
      ) : (
        <div className="search-results">
          <div className="search-results__head">
            <span className="eyebrow">
              {t(results.length === 1 ? '{n} resultado' : '{n} resultados', { n: results.length })}
            </span>
            <span className="search-results__term">“{query.trim()}”</span>
          </div>

          {results.length === 0 ? (
            <div className="empty empty--compact">
              <EmptyArt />
              <h2>{t('Nada encontrado')}</h2>
              <p>{t('Tente uma palavra mais curta, o nome do veículo ou outro tema.')}</p>
              <button className="btn btn--ghost" onClick={() => onQuery('')}>{t('Limpar busca')}</button>
            </div>
          ) : (
            <div className="feed__list">
              {results.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  source={sourceMap.get(article.sourceId)}
                  saved={savedIds.has(article.id)}
                  onOpen={() => {
                    onRemember(query.trim())
                    onOpen(article)
                  }}
                  onToggleSave={() => onToggleSave(article)}
                  query={query}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
