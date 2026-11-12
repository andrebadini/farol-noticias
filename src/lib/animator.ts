/**
 * Motor de animação do HUD.
 *
 * Cada quadro custa um envio Bluetooth (0,3–1,5 s no aparelho real) e imagens
 * nunca podem ser enviadas em paralelo. Por isso o quadro é escolhido pelo
 * RELÓGIO no instante do envio (se o link é lento, quadros são pulados e nada
 * se acumula), nunca se reenvia a mesma key e, entre dois envios, o laço cede
 * com setTimeout — um gesto do usuário espera no máximo um quadro.
 */
export interface AnimFrame {
  key: string
  data: Uint8Array
}

export interface AnimTarget {
  containerId: number
  containerName: string
}

interface Running<S> extends AnimTarget {
  animKey: string
  screen: S
  frameAt: (elapsedMs: number) => AnimFrame
  minIntervalMs: number
  restore: (() => AnimFrame | null) | null
  startedAt: number
  lastKey: string | null
}

export class Animator<S> {
  private current: Running<S> | null = null
  private run = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private paused = false

  private readonly send: (target: AnimTarget, frame: AnimFrame) => Promise<boolean>
  private readonly isLive: (screen: S) => boolean

  /** `isLive`: a animação só vale enquanto a tela dela estiver ativa. */
  constructor(send: (target: AnimTarget, frame: AnimFrame) => Promise<boolean>, isLive: (screen: S) => boolean) {
    this.send = send
    this.isLive = isLive
  }

  get active(): string | null {
    return this.current?.animKey ?? null
  }

  start(
    key: string,
    containerId: number,
    containerName: string,
    frameAt: (elapsedMs: number) => AnimFrame,
    minIntervalMs: number,
    extra: { screen: S; restore?: () => AnimFrame | null },
  ): void {
    if (this.current && this.current.animKey === key && this.current.containerId === containerId && !this.paused) return
    this.stop(false)
    this.paused = false
    this.current = {
      animKey: key,
      containerId,
      containerName,
      screen: extra.screen,
      frameAt,
      minIntervalMs,
      restore: extra.restore ?? null,
      startedAt: performance.now(),
      lastKey: null,
    }
    this.schedule(0)
  }

  /** Para a animação; com `repaint` devolve ao container o estado estático. */
  stop(repaint = true): void {
    const current = this.current
    this.run += 1
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.current = null
    if (!repaint || !current?.restore || !this.isLive(current.screen)) return
    const frame = current.restore()
    if (frame) void this.send(current, frame)
  }

  pause(): void {
    this.paused = true
    this.run += 1
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  /** Retoma e repinta o quadro atual (a tela pode ter sido esvaziada). */
  resume(): void {
    if (!this.paused) return
    this.paused = false
    if (!this.current) return
    this.current.lastKey = null
    this.schedule(0)
  }

  private schedule(delay: number): void {
    const run = this.run
    this.timer = setTimeout(() => void this.tick(run), delay)
  }

  private async tick(run: number): Promise<void> {
    const current = this.current
    if (run !== this.run || !current || this.paused) return
    if (!this.isLive(current.screen)) {
      this.stop(false)
      return
    }
    const began = performance.now()
    const frame = current.frameAt(began - current.startedAt)
    if (frame.key !== current.lastKey) {
      current.lastKey = frame.key
      const ok = await this.send(current, frame)
      if (run !== this.run) return
      if (!ok) current.lastKey = null
    }
    const spent = performance.now() - began
    this.schedule(Math.max(16, current.minIntervalMs - spent))
  }
}
