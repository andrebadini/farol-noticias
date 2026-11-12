/**
 * Aritmética pura da home do HUD (sem DOM nem SDK).
 *
 * O foco fica sempre no mesmo lugar (o card grande). O cursor vai de -1 (Menu
 * acima da 1ª notícia) até `feedLength` (Menu no fim do feed); abaixo do card
 * aparecem as HOME_NEXT itens seguintes.
 */
export const HOME_NEXT = 2

export type HomeItem =
  | { kind: 'article'; index: number }
  | { kind: 'menu' }
  | { kind: 'empty' }

/** Mantém o cursor entre -1 e feedLength. */
export function clampHomeIndex(index: number, feedLength: number): number {
  const last = Math.max(0, Math.floor(feedLength))
  const value = Number.isFinite(index) ? Math.trunc(index) : 0
  return Math.max(-1, Math.min(last, value))
}

/** O que existe numa posição do cursor. */
export function itemAt(index: number, feedLength: number): HomeItem {
  if (index >= 0 && index < feedLength) return { kind: 'article', index }
  if (index === feedLength || index === -1) return { kind: 'menu' }
  return { kind: 'empty' }
}

/** Os itens logo abaixo do foco ("A seguir"): notícias, depois a linha Menu, depois vazio. */
export function nextItems(index: number, feedLength: number, count = HOME_NEXT): HomeItem[] {
  const out: HomeItem[] = []
  for (let step = 1; step <= count; step += 1) {
    const at = index + step
    out.push(at >= 0 && at < feedLength ? { kind: 'article', index: at } : at === feedLength ? { kind: 'menu' } : { kind: 'empty' })
  }
  return out
}

/** Posição para o rodapé "5/545": o Menu de cima é 0 e o de baixo é o total. */
export function progressOf(index: number, feedLength: number): { position: number; total: number } {
  const total = Math.max(0, Math.floor(feedLength))
  return { position: Math.max(0, Math.min(total, index + 1)), total }
}

/** Barra de progresso em texto: `━━━─────`. */
export function progressBar(position: number, total: number, width = 8): string {
  if (total <= 0 || position <= 0) return '─'.repeat(width)
  const filled = Math.max(1, Math.min(width, Math.round((position / total) * width)))
  return '━'.repeat(filled) + '─'.repeat(width - filled)
}
