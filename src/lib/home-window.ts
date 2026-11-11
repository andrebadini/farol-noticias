/**
 * Aritmética pura da home do HUD (sem DOM nem SDK).
 *
 * O cursor vai de -1 (menu do topo, mostrado no cabeçalho) até `feedLength`
 * (linha Menu, último item). As notícias aparecem em páginas de HOME_ROWS.
 */
export const HOME_ROWS = 3

export type HomeSlotItem =
  | { kind: 'article'; index: number }
  | { kind: 'menu' }
  | { kind: 'empty' }

/** Mantém o cursor entre -1 e feedLength. */
export function clampHomeIndex(index: number, feedLength: number): number {
  const last = Math.max(0, Math.floor(feedLength))
  const value = Number.isFinite(index) ? Math.trunc(index) : 0
  return Math.max(-1, Math.min(last, value))
}

/** Primeiro índice da página que contém o cursor (o menu do topo usa a página 0). */
export function pageStartOf(index: number): number {
  return Math.floor(Math.max(index, 0) / HOME_ROWS) * HOME_ROWS
}

/** O que cada slot da página mostra. */
export function slotItem(pageStart: number, slot: number, feedLength: number): HomeSlotItem {
  const index = pageStart + slot
  if (index >= 0 && index < feedLength) return { kind: 'article', index }
  if (index === feedLength) return { kind: 'menu' }
  return { kind: 'empty' }
}
