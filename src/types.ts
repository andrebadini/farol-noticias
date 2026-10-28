export type CategoryId =
  | 'politica'
  | 'economia'
  | 'mundo'
  | 'esportes'
  | 'tecnologia'
  | 'cultura'
  | 'cidades'
  | 'saude'
  | 'ciencia'
  | 'justica'
  | 'geral'

export interface SourceInfo {
  id: string
  name: string
  short: string
  monogram?: string
  domain: string
  color: string
  kind: string
  tag: string
  count: number
  ok: boolean
  lastTitle: string | null
  lastAt: string | null
}

export interface CategoryInfo {
  id: CategoryId
  name: string
  emoji: string
  count: number
}

export interface ArticleMeta {
  id: string
  title: string
  sourceId: string
  url: string
  publishedAt: string
  category: CategoryId
  summary: string
  keywords?: string
  full: boolean
  readingMin: number
  author: string
  image: string
}

export interface ArticleFull extends ArticleMeta {
  content: string
}

export interface LatestPayload {
  generatedAt: string
  version: number
  locale: string
  total: number
  sources: SourceInfo[]
  categories: CategoryInfo[]
  health: Array<{ id: string; ok: boolean; items: number; fresh: number }>
  articles: ArticleMeta[]
}

export interface Bookmark extends ArticleMeta {
  savedAt: number
  content: string
}

export interface SavedIndexEntry extends ArticleMeta {
  savedAt: number
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type TabId = 'agora' | 'buscar' | 'salvos' | 'ajustes'

export interface Settings {
  theme: ThemeMode
  refreshMinutes: number
  fontScale: number
  enabledSources: string[] | null
  showTips: boolean
}

export interface LoadOrigin {
  kind: 'remote' | 'local' | 'cache' | 'none'
  at: number
}
