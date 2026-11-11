import type { SourceInfo } from '../types'

/** A linha "logo + veículo" é desenhada como bitmap para ter negrito real no G2. */
export const SOURCE_LINE_WIDTH = 288
export const SOURCE_LINE_HEIGHT = 26

const BADGE = 24
const BADGE_Y = 1
const LABEL_X = 32
const FONT_FAMILY = '"Inter Tight Variable", "Inter Tight", Arial, sans-serif'
const NAME_FONT = `800 18px ${FONT_FAMILY}`

const cache = new Map<string, Uint8Array>()
let fontsReady: Promise<unknown> | null = null

/** A fonte vem de @fontsource-variable/inter-tight (importada em main.tsx). */
function loadFonts(): Promise<unknown> {
  if (!fontsReady) {
    try {
      const sample = 'AÇÃOÉ0123456789 abcdefghijklmnopqrstuvwxyz…'
      fontsReady = document.fonts
        ? Promise.all([
            document.fonts.load('800 18px "Inter Tight Variable"', sample),
            document.fonts.load('800 13px "Inter Tight Variable"', sample),
            document.fonts.load('800 10px "Inter Tight Variable"', sample),
          ]).catch(() => undefined)
        : Promise.resolve()
    } catch {
      fontsReady = Promise.resolve()
    }
  }
  return fontsReady
}

function gray(level: number): string {
  const clamped = Math.max(0, Math.min(15, level))
  const value = Math.round((clamped / 15) * 255)
  return `rgb(${value},${value},${value})`
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Mesmo monograma do SourceBadge do celular. */
function monogramOf(source: SourceInfo | null | undefined, fallback: string): string {
  const label = source?.monogram ?? source?.short?.slice(0, 3) ?? fallback
  return (label || '?').slice(0, 3)
}

function toGray4(ctx: CanvasRenderingContext2D): Uint8Array {
  const { width, height } = ctx.canvas
  const data = ctx.getImageData(0, 0, width, height).data
  const out = new Uint8Array(width * height)
  for (let i = 0; i < out.length; i += 1) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const a = data[i * 4 + 3] / 255
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) * a
    out[i] = Math.max(0, Math.min(15, Math.round(luma / 17)))
  }
  return out
}

function badge(ctx: CanvasRenderingContext2D, glyph: (() => void) | string) {
  // No G2 (monocromático) o badge é branco com o monograma em preto.
  ctx.fillStyle = gray(15)
  roundedPath(ctx, 0, BADGE_Y, BADGE, BADGE, 5)
  ctx.fill()
  ctx.fillStyle = gray(0)
  if (typeof glyph === 'function') {
    glyph()
    return
  }
  ctx.font = `800 ${glyph.length <= 2 ? 13 : 10}px ${FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, BADGE / 2, BADGE_Y + BADGE / 2 + 0.5)
}

function lineParts(source: SourceInfo | null | undefined, fallbackName: string, fallbackId: string) {
  const name = source?.name ?? source?.short ?? fallbackName ?? fallbackId
  const monogram = monogramOf(source, fallbackName || fallbackId)
  return { name, monogram, key: `source:${source?.id ?? fallbackId}|${name}|${monogram}` }
}

/** Chave estável do que a linha desenha (veículo, nome e monograma). */
export function sourceLineKey(source: SourceInfo | null | undefined, fallbackId: string): string {
  return lineParts(source, fallbackId, fallbackId).key
}

export async function sourceLineArt(source: SourceInfo | null | undefined, fallbackName: string, fallbackId: string): Promise<Uint8Array> {
  const { name, monogram, key } = lineParts(source, fallbackName, fallbackId)
  return render(key, name, monogram)
}

export async function menuLineArt(): Promise<Uint8Array> {
  return render('menu', 'MENU', null)
}

async function render(key: string, name: string, monogram: string | null): Promise<Uint8Array> {
  const cached = cache.get(key)
  if (cached) return cached
  await loadFonts()
  const canvas = document.createElement('canvas')
  canvas.width = SOURCE_LINE_WIDTH
  canvas.height = SOURCE_LINE_HEIGHT
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return blankSourceLine()

  ctx.fillStyle = gray(0)
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (monogram === null) {
    // Três barras com fillRect: o glifo ☰ não existe na fonte do canvas.
    badge(ctx, () => {
      for (const y of [8, 12, 16]) ctx.fillRect(6, y, 12, 2)
    })
  } else {
    badge(ctx, monogram)
  }

  ctx.fillStyle = gray(15)
  ctx.font = NAME_FONT
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const maxWidth = SOURCE_LINE_WIDTH - LABEL_X
  let label = name
  if (ctx.measureText(label).width > maxWidth) {
    while (label.length > 1 && ctx.measureText(`${label.trimEnd()}…`).width > maxWidth) {
      label = label.slice(0, -1)
    }
    label = `${label.trimEnd()}…`
  }
  ctx.fillText(label, LABEL_X, BADGE_Y + BADGE / 2 + 0.5)

  const art = toGray4(ctx)
  cache.set(key, art)
  return art
}

export function blankSourceLine(): Uint8Array {
  return new Uint8Array(SOURCE_LINE_WIDTH * SOURCE_LINE_HEIGHT)
}
