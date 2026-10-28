import { measureTextWrap } from '@evenrealities/pretext'

/**
 * Paginação pixel-perfect para o G2, usando as mesmas métricas de glifo que o
 * firmware LVGL. A altura de linha do firmware é fixa em 27 px.
 *
 * Adaptado do template oficial `text-heavy` da Even Realities (MIT).
 */
const LINE_HEIGHT = 27

export interface PaginateBox {
  width: number
  height: number
}

export function paginate(source: string, box: PaginateBox): string[] {
  const maxLines = Math.max(1, Math.floor(box.height / LINE_HEIGHT))
  const paragraphs = source
    .split(/\n{2,}/)
    .map((p) => p.replace(/^>\s?/gm, '').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)

  const pages: string[] = []
  let buffer: string[] = []
  let bufferLines = 0

  const flush = () => {
    if (!buffer.length) return
    pages.push(buffer.join('\n\n'))
    buffer = []
    bufferLines = 0
  }

  for (const para of paragraphs) {
    const paraLines = measureTextWrap(para, box.width).lineCount
    if (paraLines > maxLines) {
      flush()
      for (const chunk of splitParagraph(para, box.width, maxLines)) pages.push(chunk)
      continue
    }
    const cost = paraLines + (buffer.length ? 1 : 0)
    if (bufferLines + cost > maxLines) {
      flush()
      buffer.push(para)
      bufferLines = paraLines
    } else {
      buffer.push(para)
      bufferLines += cost
    }
  }
  flush()
  return pages.length ? pages : ['(sem conteúdo)']
}

function splitParagraph(text: string, width: number, maxLines: number): string[] {
  const tokens = text.split(/(\s+)/)
  const chunks: string[] = []
  let current = ''

  for (const token of tokens) {
    const candidate = current + token
    const { lineCount } = measureTextWrap(candidate, width)
    if (lineCount > maxLines && current.trim()) {
      chunks.push(current.trim())
      current = token.replace(/^\s+/, '')
    } else {
      current = candidate
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
