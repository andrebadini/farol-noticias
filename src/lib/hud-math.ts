/**
 * Aritmética pura do HUD (sem DOM nem SDK): escolha de quadro por tempo,
 * quantização do anel de progresso, decisão de sair da abertura e tempo restante.
 */

/** Quadros da abertura: 4 de entrada (pontos acendendo) + 8 do laço do pulso. */
export const SPLASH_INTRO_FRAMES = 4
export const SPLASH_LOOP_FRAMES = 8
export const SPLASH_FRAME_COUNT = SPLASH_INTRO_FRAMES + SPLASH_LOOP_FRAMES
const SPLASH_INTRO_STEP_MS = 250
const SPLASH_LOOP_MS = 1600

/** Mínimo e máximo de tempo da abertura. */
export const SPLASH_MIN_MS = 1600
export const SPLASH_MAX_MS = 6000

export const SPINNER_FRAME_COUNT = 8
export const SPINNER_FPS = 4
export const RING_STEPS = 16

/** Escolhe o quadro pelo relógio: nunca pelo número de envios feitos. */
export function splashIndex(elapsedMs: number): number {
  const ms = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  const intro = SPLASH_INTRO_FRAMES * SPLASH_INTRO_STEP_MS
  if (ms < intro) return Math.floor(ms / SPLASH_INTRO_STEP_MS)
  const phase = ((ms - intro) % SPLASH_LOOP_MS) / SPLASH_LOOP_MS
  return SPLASH_INTRO_FRAMES + Math.min(SPLASH_LOOP_FRAMES - 1, Math.floor(phase * SPLASH_LOOP_FRAMES))
}

export function spinnerIndex(elapsedMs: number, fps = SPINNER_FPS): number {
  const ms = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  return Math.floor((ms / 1000) * fps) % SPINNER_FRAME_COUNT
}

/** 0..16; 16 só quando completo (vira o "check"); qualquer progresso aparece (≥1). */
export function ringStep(fraction: number): number {
  if (!Number.isFinite(fraction) || fraction <= 0) return 0
  if (fraction >= 1) return RING_STEPS
  return Math.min(RING_STEPS - 1, Math.max(1, Math.round(fraction * RING_STEPS)))
}

/** A abertura sai quando há feed e já passou o mínimo, ou ao estourar o máximo. */
export function splashDecision(elapsedMs: number, feedCount: number): 'wait' | 'leave' {
  if (elapsedMs >= SPLASH_MAX_MS) return 'leave'
  return feedCount > 0 && elapsedMs >= SPLASH_MIN_MS ? 'leave' : 'wait'
}

/** Minutos que faltam depois da página atual (0 na última). */
export function remainingMinutes(totalMin: number, page: number, pages: number): number {
  if (pages <= 1 || page >= pages - 1) return 0
  const share = 1 - (page + 1) / pages
  return Math.max(1, Math.round(Math.max(1, totalMin) * share))
}
