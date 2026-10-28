import type { CategoryId, SourceInfo } from '../types'

export const CATEGORY_META: Record<CategoryId, { name: string; glyph: string; hue: string }> = {
  politica: { name: 'Política', glyph: '◉', hue: '#B3402F' },
  economia: { name: 'Economia', glyph: '▲', hue: '#3E6B4F' },
  mundo: { name: 'Mundo', glyph: '◎', hue: '#3B5C93' },
  esportes: { name: 'Esportes', glyph: '●', hue: '#B96A18' },
  tecnologia: { name: 'Tecnologia', glyph: '◆', hue: '#6B4A9E' },
  cultura: { name: 'Cultura', glyph: '✳', hue: '#A64A74' },
  cidades: { name: 'Cidades', glyph: '▣', hue: '#5C6B3A' },
  saude: { name: 'Saúde', glyph: '✚', hue: '#2C7A78' },
  ciencia: { name: 'Ciência', glyph: '✧', hue: '#3F7291' },
  justica: { name: 'Justiça', glyph: '§', hue: '#7A6128' },
  geral: { name: 'Geral', glyph: '•', hue: '#6B675C' },
}

/** Usado quando o snapshot remoto ainda não chegou (primeira execução/offline). */
export const FALLBACK_SOURCES: SourceInfo[] = [
  {
    id: 'g1',
    name: 'G1',
    short: 'G1',
    monogram: 'G1',
    domain: 'g1.globo.com',
    color: '#D6321F',
    kind: 'Portal',
    tag: 'Notícias 24h',
    count: 0,
    ok: true,
    lastTitle: null,
    lastAt: null,
  },
  {
    id: 'folha',
    name: 'Folha de S.Paulo',
    short: 'Folha',
    monogram: 'FSP',
    domain: 'folha.uol.com.br',
    color: '#111111',
    kind: 'Jornal',
    tag: 'Grande imprensa',
    count: 0,
    ok: true,
    lastTitle: null,
    lastAt: null,
  },
  {
    id: 'valor',
    name: 'Valor Econômico',
    short: 'Valor',
    monogram: 'VE',
    domain: 'valor.globo.com',
    color: '#14365D',
    kind: 'Jornal',
    tag: 'Economia',
    count: 0,
    ok: true,
    lastTitle: null,
    lastAt: null,
  },
]

export const CATEGORY_ORDER: CategoryId[] = [
  'politica',
  'economia',
  'mundo',
  'esportes',
  'tecnologia',
  'cultura',
  'cidades',
  'justica',
  'saude',
  'ciencia',
  'geral',
]

export const SEARCH_SUGGESTIONS = ['Eleições', 'Dólar', 'Amazônia', 'Futebol', 'Inteligência artificial', 'Congresso']

export function needsLightText(source?: SourceInfo): boolean {
  if (!source?.color) return true
  const hex = source.color.replace('#', '')
  if (hex.length !== 6) return true
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luma < 150
}
