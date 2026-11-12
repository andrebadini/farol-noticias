import type { SourceInfo } from '../types'
import type { AnimFrame } from './animator'
import { RING_STEPS, SPINNER_FRAME_COUNT, SPLASH_FRAME_COUNT, SPLASH_INTRO_FRAMES, SPLASH_LOOP_FRAMES, ringStep, splashIndex } from './hud-math'

/**
 * Arte do HUD: tudo desenhado em canvas no tamanho nativo e convertido para
 * gray4 (1 valor 0–15 por pixel). 0 = apagado/transparente, 15 = máximo.
 * Cada peça tem cache por chave; nada é redesenhado a cada gesto.
 */
export const BRAND_SIZE = 24
export const SPLASH_W = 200
export const SPLASH_H = 100
export const VEHICLE_W = 288
export const VEHICLE_H = 24
export const KEYS_W = 288
export const KEYS_H = 26

const FONT = '"Inter Tight Variable", "Inter Tight", Arial, sans-serif'

export type KeyGlyph = 'updown' | 'dot' | 'dots'
export interface KeycapItem {
  glyph: KeyGlyph
  label: string
}

const cache = new Map<string, Uint8Array>()
let fontsReady: Promise<unknown> | null = null

/** A fonte vem de @fontsource-variable/inter-tight (importada em main.tsx). */
function loadFonts(): Promise<unknown> {
  if (!fontsReady) {
    try {
      const sample = 'AÇÃOÉ0123456789 abcdefghijklmnopqrstuvwxyz…·'
      fontsReady = document.fonts
        ? Promise.all(
            ['350 15px', '400 15px', '500 12px', '600 12px', '600 9px', '600 11px', '500 11px'].map((spec) =>
              document.fonts.load(`${spec} "Inter Tight Variable"`, sample),
            ),
          ).catch(() => undefined)
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

function makeCanvas(width: number, height: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.fillStyle = gray(0)
  ctx.fillRect(0, 0, width, height)
  return ctx
}

function toGray4(ctx: CanvasRenderingContext2D): Uint8Array {
  const { width, height } = ctx.canvas
  const data = ctx.getImageData(0, 0, width, height).data
  const out = new Uint8Array(width * height)
  for (let i = 0; i < out.length; i += 1) {
    const luma = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]
    out[i] = Math.max(0, Math.min(15, Math.round((luma * (data[i * 4 + 3] / 255)) / 17)))
  }
  return out
}

function memo(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Uint8Array {
  const hit = cache.get(key)
  if (hit) return hit
  const ctx = makeCanvas(width, height)
  if (!ctx) return new Uint8Array(width * height)
  draw(ctx)
  const art = toGray4(ctx)
  cache.set(key, art)
  return art
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
}

/* ------------------------------------------------------------------ marca */

/**
 * Marca "além dos pontos": três pontos em linha e, ALÉM deles, um farol cujo
 * anel se expande. `rings` = fase (0..1) de cada anel já em curso.
 */
function drawMark24(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = gray(15)
  for (const x of [3, 8.2, 13.4]) {
    circle(ctx, x, 12, 1.9)
    ctx.fill()
  }
  ctx.strokeStyle = gray(15)
  ctx.lineWidth = 1.7
  circle(ctx, 18.6, 12, 3.1)
  ctx.stroke()
  ctx.strokeStyle = gray(5)
  ctx.lineWidth = 1
  circle(ctx, 18.6, 12, 4.8)
  ctx.stroke()
}

/** Marca estática 24×24 (canto do cabeçalho). */
export function brandMark(): Uint8Array {
  return memo('brand', BRAND_SIZE, BRAND_SIZE, drawMark24)
}

const SPLASH_Y = 50
const SPLASH_DOTS = [35, 67, 99]
const SPLASH_BEACON = 133

function drawSplash(ctx: CanvasRenderingContext2D, index: number) {
  const lit = index < SPLASH_INTRO_FRAMES ? index : 3
  const loop = index >= SPLASH_INTRO_FRAMES ? (index - SPLASH_INTRO_FRAMES) / SPLASH_LOOP_FRAMES : -1

  // Pontos: apagados = contorno fraco; acesos = disco cheio com halo suave.
  SPLASH_DOTS.forEach((x, i) => {
    if (i < lit) {
      const halo = ctx.createRadialGradient(x, SPLASH_Y, 5, x, SPLASH_Y, 16)
      halo.addColorStop(0, gray(5))
      halo.addColorStop(1, gray(0))
      ctx.fillStyle = halo
      circle(ctx, x, SPLASH_Y, 16)
      ctx.fill()
      ctx.fillStyle = gray(15)
      circle(ctx, x, SPLASH_Y, 7)
      ctx.fill()
    } else {
      ctx.strokeStyle = gray(3)
      ctx.lineWidth = 1.5
      circle(ctx, x, SPLASH_Y, 6.5)
      ctx.stroke()
    }
  })
  if (lit < 3) return

  // Farol: o quarto elemento, além dos pontos. Anéis nascem dele e esmaecem.
  const phases = loop >= 0 ? [loop, (loop + 1 / 3) % 1, (loop + 2 / 3) % 1] : [0.08]
  for (const p of phases) {
    const radius = 9 + p * 46
    const tone = 14 * (1 - p) ** 1.5
    if (tone < 0.8) continue
    ctx.strokeStyle = gray(tone)
    ctx.lineWidth = 2.8 - p * 1.6
    ctx.lineCap = 'round'
    // Só o lado direito: a onda sai do farol rumo ao que está ALÉM dos pontos.
    ctx.beginPath()
    ctx.arc(SPLASH_BEACON, SPLASH_Y, radius, -1.0 + p * 0.25, 1.0 - p * 0.25)
    ctx.stroke()
  }
  ctx.strokeStyle = gray(15)
  ctx.lineWidth = 2.2
  circle(ctx, SPLASH_BEACON, SPLASH_Y, 7)
  ctx.stroke()
  ctx.fillStyle = gray(15)
  circle(ctx, SPLASH_BEACON, SPLASH_Y, 2.8)
  ctx.fill()
}

/** Quadro 0..11 da abertura (200×100). */
export function splashFrameByIndex(index: number): Uint8Array {
  const i = Math.max(0, Math.min(SPLASH_FRAME_COUNT - 1, Math.trunc(index)))
  return memo(`splash:${i}`, SPLASH_W, SPLASH_H, (ctx) => drawSplash(ctx, i))
}

/** Quadro da abertura escolhido pelo relógio (ms desde o início). */
export function splashFrame(elapsedMs: number): AnimFrame {
  const index = splashIndex(elapsedMs)
  return { key: `splash:${index}`, data: splashFrameByIndex(index) }
}

/* ---------------------------------------------------------------- spinner */

/** Arco com cauda em degradê (tons 15→3), 8 quadros girando em passos de 45°. */
export function spinnerFrame(index: number): Uint8Array {
  const i = ((Math.trunc(index) % SPINNER_FRAME_COUNT) + SPINNER_FRAME_COUNT) % SPINNER_FRAME_COUNT
  return memo(`spin:${i}`, BRAND_SIZE, BRAND_SIZE, (ctx) => {
    const head = -Math.PI / 2 + (i / SPINNER_FRAME_COUNT) * Math.PI * 2
    const segments = 14
    const tail = Math.PI * 1.55
    ctx.lineWidth = 3.4
    ctx.lineCap = 'butt'
    for (let s = 0; s < segments; s += 1) {
      const to = head - (s / segments) * tail
      const from = head - ((s + 1.15) / segments) * tail
      ctx.strokeStyle = gray(15 - (s / (segments - 1)) * 12)
      ctx.beginPath()
      ctx.arc(12, 12, 9, from, to)
      ctx.stroke()
    }
  })
}

/* -------------------------------------------------------- anel de progresso */

/** Anel 24×24: trilho tom 3 + arco claro; 100% = disco cheio com "check" recortado. */
export function progressRing(fraction: number): Uint8Array {
  const step = ringStep(fraction)
  return memo(`ring:${step}`, BRAND_SIZE, BRAND_SIZE, (ctx) => {
    if (step >= RING_STEPS) {
      ctx.fillStyle = gray(15)
      circle(ctx, 12, 12, 11)
      ctx.fill()
      ctx.strokeStyle = gray(0)
      ctx.lineWidth = 2.6
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(6.8, 12.4)
      ctx.lineTo(10.6, 16.2)
      ctx.lineTo(17.4, 8.2)
      ctx.stroke()
      return
    }
    ctx.lineWidth = 3.2
    ctx.strokeStyle = gray(3)
    circle(ctx, 12, 12, 9.4)
    ctx.stroke()
    if (step > 0) {
      ctx.strokeStyle = gray(15)
      ctx.lineCap = 'butt'
      ctx.beginPath()
      ctx.arc(12, 12, 9.4, -Math.PI / 2, -Math.PI / 2 + (step / RING_STEPS) * Math.PI * 2)
      ctx.stroke()
    }
  })
}

/* ---------------------------------------------------------- linha do veículo */

/** Mesmo monograma do SourceBadge do celular. */
function monogramOf(source: SourceInfo | null | undefined, fallback: string): string {
  const label = source?.monogram ?? source?.short?.slice(0, 3) ?? fallback
  return (label || '?').slice(0, 3)
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

/**
 * 288×24: badge com monograma em CONTORNO e o nome em peso normal (500),
 * 15px, tom 10 — mais apagado que a manchete (texto do firmware, brilho total).
 */
function drawVehicle(ctx: CanvasRenderingContext2D, name: string, monogram: string | null) {
  ctx.strokeStyle = gray(12)
  ctx.lineWidth = 1.5
  roundedPath(ctx, 1.75, 1.75, 20.5, 20.5, 6)
  ctx.stroke()
  ctx.fillStyle = gray(12)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (monogram === null) {
    // Três barras com fillRect: o glifo ☰ não existe na fonte.
    for (const y of [7.5, 11, 14.5]) ctx.fillRect(6.5, y, 11, 2)
  } else {
    ctx.font = `600 ${monogram.length <= 2 ? 11 : 9}px ${FONT}`
    ctx.fillText(monogram, 12, 12.6)
  }
  ctx.fillStyle = gray(9)
  ctx.font = `350 15px ${FONT}`
  ctx.textAlign = 'left'
  const maxWidth = VEHICLE_W - 32
  let label = name
  if (ctx.measureText(label).width > maxWidth) {
    while (label.length > 1 && ctx.measureText(`${label.trimEnd()}…`).width > maxWidth) label = label.slice(0, -1)
    label = `${label.trimEnd()}…`
  }
  ctx.fillText(label, 31, 12.8)
}

export async function sourceLineArt(source: SourceInfo | null | undefined, fallbackName: string, fallbackId: string): Promise<Uint8Array> {
  const { name, monogram, key } = lineParts(source, fallbackName, fallbackId)
  await loadFonts()
  return memo(key, VEHICLE_W, VEHICLE_H, (ctx) => drawVehicle(ctx, name, monogram))
}

/** Ícone de menu (três barras em badge de contorno) + rótulo. */
export async function menuLineArt(label: string): Promise<Uint8Array> {
  await loadFonts()
  return memo(`menu:${label}`, VEHICLE_W, VEHICLE_H, (ctx) => drawVehicle(ctx, label, null))
}

export function blankVehicleLine(): Uint8Array {
  return new Uint8Array(VEHICLE_W * VEHICLE_H)
}

/* --------------------------------------------------------- barra de teclas */

const CAP_H = 19
const CAP_Y = 1.5
const CAP_GAP = 11
const CAP_LABEL_GAP = 6

function capWidth(glyph: KeyGlyph): number {
  return glyph === 'dot' ? 21 : 29
}

function drawGlyph(ctx: CanvasRenderingContext2D, glyph: KeyGlyph, cx: number, cy: number) {
  ctx.fillStyle = gray(15)
  if (glyph === 'updown') {
    for (const dir of [-1, 1]) {
      const tip = cy + dir * 6.6
      const base = cy + dir * 1.6
      ctx.beginPath()
      ctx.moveTo(cx, tip)
      ctx.lineTo(cx - 4, base)
      ctx.lineTo(cx + 4, base)
      ctx.closePath()
      ctx.fill()
    }
    return
  }
  const xs = glyph === 'dot' ? [cx] : [cx - 4.6, cx + 4.6]
  for (const x of xs) {
    circle(ctx, x, cy, glyph === 'dot' ? 3.3 : 3)
    ctx.fill()
  }
}

/**
 * Barra de teclas 288×26: teclas com cara de botão físico (contorno claro,
 * face tom 2, espessura em tom 7 embaixo e à direita), glifo e rótulo tom 9.
 * Alinhada à direita da imagem. Cache por idioma + itens.
 */
export async function keycapsArt(items: KeycapItem[], lang: string): Promise<Uint8Array> {
  const key = `keys:${lang}:${items.map((item) => `${item.glyph}=${item.label}`).join('|')}`
  const hit = cache.get(key)
  if (hit) return hit
  await loadFonts()
  return memo(key, KEYS_W, KEYS_H, (ctx) => {
    ctx.font = `500 12px ${FONT}`
    const widths = items.map((item) => capWidth(item.glyph) + CAP_LABEL_GAP + Math.ceil(ctx.measureText(item.label).width))
    const total = widths.reduce((sum, w) => sum + w, 0) + CAP_GAP * Math.max(0, items.length - 1)
    let x = Math.max(0, KEYS_W - total - 3)
    items.forEach((item, i) => {
      const w = capWidth(item.glyph)
      ctx.fillStyle = gray(7)
      roundedPath(ctx, x + 2, CAP_Y + 2.5, w, CAP_H, 5)
      ctx.fill()
      ctx.fillStyle = gray(2)
      roundedPath(ctx, x, CAP_Y, w, CAP_H, 5)
      ctx.fill()
      ctx.strokeStyle = gray(14)
      ctx.lineWidth = 1.2
      roundedPath(ctx, x + 0.6, CAP_Y + 0.6, w - 1.2, CAP_H - 1.2, 4.5)
      ctx.stroke()
      drawGlyph(ctx, item.glyph, x + w / 2, CAP_Y + CAP_H / 2)
      ctx.fillStyle = gray(9)
      ctx.font = `500 12px ${FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(item.label, x + w + CAP_LABEL_GAP, CAP_Y + CAP_H / 2 + 1)
      x += widths[i] + CAP_GAP
    })
  })
}
