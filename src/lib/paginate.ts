import { measureTextWrap } from '@evenrealities/pretext'

/**
 * Paginação pixel-perfect para o G2.
 *
 * O firmware LVGL usa altura de linha fixa (27 px) e quebra o texto pela largura
 * do container. Aqui a gente quebra o texto em linhas com as mesmas métricas de
 * glifo e distribui essas linhas em páginas — assim uma manchete longa nunca
 * "empurra" o corpo inteiro para a página seguinte deixando a primeira vazia.
 */
const LINE_HEIGHT = 27

export interface PaginateBox {
  width: number
  height: number
}

export function paginate(source: string, box: PaginateBox): string[] {
  const maxLines = Math.max(1, Math.floor(box.height / LINE_HEIGHT))

  // Preserva quebras de linha explícitas (textos de ajuda, citações) e
  // transforma linhas vazias em respiro entre parágrafos.
  const lines: string[] = []
  for (const rawLine of source.split(/\n/)) {
    const line = rawLine.replace(/^>\s?/, '').replace(/\s+/g, ' ').trim()
    if (!line) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('')
      continue
    }
    lines.push(...wrapParagraph(line, box.width))
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop()

  const pages: string[] = []
  for (let start = 0; start < lines.length; start += maxLines) {
    const chunk = lines.slice(start, start + maxLines)
    while (chunk.length && chunk[0] === '') chunk.shift()
    while (chunk.length && chunk[chunk.length - 1] === '') chunk.pop()
    if (chunk.length) pages.push(chunk.join('\n'))
  }
  return pages.length ? pages : ['']
}

function wrapParagraph(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && measureTextWrap(candidate, width).lineCount > 1) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}
