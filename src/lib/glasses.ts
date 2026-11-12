import { doubleTapAction, type GlassesScreen } from './gestures'
import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import type { ArticleFull, ArticleMeta, SavedIndexEntry, SourceInfo } from '../types'
import { CATEGORY_META } from '../data/meta'
import { getBridge } from './bridge'
import { paginate } from './paginate'
import { getTextWidth, measureTextWrap, pxTruncate } from '@evenrealities/pretext'
import { clock, newsClock, relativeTime } from './time'
import {
  BRAND_SIZE,
  KEYS_H,
  KEYS_W,
  SPLASH_H,
  SPLASH_W,
  VEHICLE_H,
  VEHICLE_W,
  brandMark,
  keycapsArt,
  menuLineArt,
  progressRing,
  sourceLineArt,
  sourceLineKey,
  spinnerFrame,
  splashFrame,
  type KeycapItem,
} from './glasses-art'
import { Animator, type AnimFrame } from './animator'
import { SPLASH_MAX_MS, SPLASH_MIN_MS, remainingMinutes, ringStep, spinnerIndex, splashDecision } from './hud-math'
import { clampHomeIndex, itemAt, nextItems, progressBar, progressOf } from './home-window'
import { currentLanguage, t, type Lang } from './i18n'

export type GlassesState = 'connecting' | 'ready' | 'unavailable' | 'error'

export interface GlassesStatus {
  state: GlassesState
  battery?: number
  wearing?: boolean
  model?: string
  message?: string
}

export interface GlassesSnapshot {
  mode: GlassesMode
  articleId: string | null
  page: number
  filter: string | null
  homeIndex?: number
}

type GlassesMode = GlassesScreen | 'splash'

export interface GlassesDeps {
  getFeed: () => ArticleMeta[]
  getSources: () => SourceInfo[]
  getSaved: () => SavedIndexEntry[]
  getFilter: () => string | null
  setFilter: (id: string | null) => void
  loadArticle: (meta: ArticleMeta, force?: boolean) => Promise<ArticleFull | null>
  toggleSave: (meta: ArticleMeta) => Promise<boolean>
  refresh: () => Promise<void>
  onStatus: (status: GlassesStatus) => void
  onSession: (snapshot: GlassesSnapshot) => void
  setLanguageSetting: (lang: Lang) => void
}

const W = 576
const BODY_W = 560
const BODY_H = 216
const BRIGHT = 4
const DIM = 2
const APP = 'ALÉM DOS PONTOS'
const OPEN_TIMEOUT_MS = 8000
const SPINNER_INTERVAL_MS = 250
const SPLASH_INTERVAL_MS = 250

interface Slot {
  id: number
  name: string
}

/* Home: 5 textos + 3 imagens. */
const H = {
  head: { id: 1, name: 'hHead' },
  card: { id: 2, name: 'hCard' },
  meta: { id: 3, name: 'hMeta' },
  next: { id: 4, name: 'hNext' },
  foot: { id: 5, name: 'hFoot' },
  brand: { id: 6, name: 'hBrand' },
  veh: { id: 7, name: 'hVeh' },
  keys: { id: 8, name: 'hKeys' },
}
/* Leitor e telas de texto compartilham corpo/rodapé. */
const R = {
  body: { id: 1, name: 'rBody' },
  foot: { id: 2, name: 'rFoot' },
  hint: { id: 3, name: 'rHint' },
  date: { id: 4, name: 'rDate' },
  veh: { id: 5, name: 'rVeh' },
  ring: { id: 6, name: 'rRing' },
}
const T = {
  body: { id: 1, name: 'tBody' },
  foot: { id: 2, name: 'tFoot' },
  head: { id: 3, name: 'tHead' },
  brand: { id: 4, name: 'tBrand' },
}
const L = {
  head: { id: 1, name: 'lHead' },
  foot: { id: 2, name: 'lFoot' },
  list: { id: 3, name: 'lList' },
  brand: { id: 4, name: 'lBrand' },
  keys: { id: 5, name: 'lKeys' },
}
const S = {
  cap: { id: 1, name: 'sCap' },
  img: { id: 2, name: 'sImg' },
  title: { id: 3, name: 'sTitle' },
  status: { id: 4, name: 'sStatus' },
}

/* Geometria da home (576×288). */
const CARD = { x: 6, y: 30, w: 564, h: 136 }
const CARD_TEXT_W = 536
const CARD_LINES = 3
const NEXT = { x: 16, y: 176, w: 548, h: 56 }
const FOOT_Y = 258

/** Corta por caracteres, preservando o ellipsis para o container de texto. */
function trimTitle(text: string, max = 128): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Ajusta a manchete a no máximo `lines` linhas, cortando palavras do fim e fechando com "…". */
function fitLines(title: string, lines: number, width: number): string {
  const words = title.split(/\s+/).filter(Boolean)
  const fits = (text: string) => measureTextWrap(text, width).lineCount <= lines
  if (fits(words.join(' '))) return words.join(' ')
  while (words.length > 1) {
    words.pop()
    const candidate = `${words.join(' ')}…`
    if (fits(candidate)) return candidate
  }
  let single = words[0] ?? ''
  while (single.length > 1 && !fits(`${single}…`)) single = single.slice(0, -1)
  return `${single}…`
}

/** Alinha à direita preenchendo com espaços (a fonte do firmware só alinha à esquerda). */
function rightAlign(text: string, width: number): string {
  // Uma folga de 2 espaços: o firmware quebra a linha se o texto encosta na borda.
  const pad = Math.max(0, Math.floor((width - getTextWidth(text)) / getTextWidth(' ')) - 2)
  return `${' '.repeat(pad)}${text}`
}

function centered(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - getTextWidth(text)) / 2 / getTextWidth(' ')))
  return `${' '.repeat(pad)}${text}`
}

const blank = (text: string): string => (text.trim() ? text : ' ')

function clockNow(): string {
  const now = newsClock(new Date().toISOString())
  return now ? `${now.clock} ${now.zone}` : clock(new Date().toISOString())
}

function stampOf(iso: string, withDay: boolean): string {
  const when = newsClock(iso)
  if (!when) return relativeTime(iso)
  return withDay || when.day !== t('hoje') ? `${when.day} · ${when.clock}` : when.clock
}

interface HomeView {
  head: string
  card: string
  meta: string
  next: string
  foot: string
  vehicle: { key: string; load: () => Promise<Uint8Array> }
}

type Screen = GlassesMode

export class GlassesUI {
  private bridge: EvenAppBridge | null = null
  private ready = false
  private destroyed = false
  private queue: Promise<unknown> = Promise.resolve()
  private unsubscribe: (() => void) | null = null
  private unsubscribeDevice: (() => void) | null = null
  private clockTimer: ReturnType<typeof setInterval> | null = null

  private mode: GlassesMode = 'splash'
  private previousMode: GlassesMode = 'home'
  private homeIndex = 0
  // Sincronização single-flight da home: o que já foi enviado aos óculos.
  private sentText = new Map<number, string>()
  private sentImage = new Map<string, string>()
  private epoch = 0
  private syncWanted = false
  private syncRunning = false
  private rebuilding = 0
  private feed: ArticleMeta[] = []
  private sources: SourceInfo[] = []
  private saved: SavedIndexEntry[] = []
  private filter: string | null = null
  private current: ArticleFull | null = null
  private pages: string[] = []
  private page = 0
  private actions: Array<() => void> = []
  private feedSignature = ''
  private pendingRestore: GlassesSnapshot | null = null
  private notice = ''
  private noticeTimer: ReturnType<typeof setTimeout> | null = null
  private busy = 0
  private busyLabel = ''
  private openToken = 0
  private splashStart = 0
  private splashTimers: Array<ReturnType<typeof setTimeout>> = []
  private splashStatus = ''
  // Cabeçalho das telas de lista/texto e o slot da imagem de marca.
  private headTitle = ''
  private headText: Slot | null = null
  private headImage: Slot | null = null
  private pageSlots: { body: Slot; foot: Slot } = { body: R.body, foot: R.foot }

  private deps: GlassesDeps
  private animator: Animator<Screen>

  constructor(deps: GlassesDeps) {
    this.deps = deps
    this.animator = new Animator<Screen>(
      (target, frame) => this.sendFrame({ id: target.containerId, name: target.containerName }, frame),
      (screen) => !this.destroyed && this.ready && this.mode === screen,
    )
  }

  async init(): Promise<void> {
    this.deps.onStatus({ state: 'connecting' })
    const bridge = await getBridge()
    if (!bridge) {
      this.deps.onStatus({ state: 'unavailable', message: t('Modo navegador — sem óculos conectados') })
      return
    }
    this.bridge = bridge
    try {
      this.feed = this.deps.getFeed()
      this.sources = this.deps.getSources()
      this.saved = this.deps.getSaved()
      this.filter = this.deps.getFilter()
      this.mode = 'splash'
      this.splashStatus = this.splashStatusText()
      const created = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(this.splashLayout()))
      if (created !== 0) throw new Error(`startup ${created}`)
      this.ready = true
      this.attach()
      this.deps.onStatus({ state: 'ready' })
      this.refreshDevice()
      this.clockTimer = setInterval(() => {
        if (this.mode === 'home') this.syncHome()
      }, 60_000)
      this.startSplash()
    } catch (error) {
      this.deps.onStatus({ state: 'error', message: error instanceof Error ? error.message : t('falha ao iniciar') })
      this.ready = false
    }
  }

  private attach() {
    if (!this.bridge) return
    this.unsubscribe = this.bridge.onEvenHubEvent((event) => {
      if (this.destroyed) return
      const sys = event.sysEvent
      const sysType = sys ? (sys.eventType ?? OsEventTypeList.CLICK_EVENT) : null

      if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        this.onDouble()
        return
      }
      if (sysType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
        this.animator.resume()
        void this.runBusy(t('ATUALIZANDO…'), () => this.deps.refresh()).catch(() => undefined)
        this.refreshCurrent()
        return
      }
      if (sysType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
        this.animator.pause()
        this.saveSession()
        return
      }
      if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
        this.destroy()
        return
      }
      if (event.textEvent) {
        const type = event.textEvent.eventType ?? 0
        const delta = type === OsEventTypeList.SCROLL_TOP_EVENT ? -1 : type === OsEventTypeList.SCROLL_BOTTOM_EVENT ? 1 : 0
        if (!delta) return
        if (this.mode === 'home') this.moveHome(delta)
        else this.changePage(delta)
        return
      }
      if (event.listEvent) {
        const index = event.listEvent.currentSelectItemIndex ?? 0
        this.onListSelect(index)
        return
      }
      if (sysType === OsEventTypeList.CLICK_EVENT) {
        this.onTap()
      }
    })

    this.unsubscribeDevice = this.bridge.onDeviceStatusChanged((status) => {
      this.deps.onStatus({
        state: 'ready',
        battery: status.batteryLevel,
        wearing: status.isWearing,
      })
    })
  }

  private async refreshDevice() {
    if (!this.bridge) return
    try {
      const info = await this.bridge.getDeviceInfo()
      if (!info) return
      this.deps.onStatus({
        state: 'ready',
        battery: info.status?.batteryLevel,
        wearing: info.status?.isWearing,
        model: info.model,
      })
    } catch {
      /* dispositivo pode não responder no simulador */
    }
  }

  setData(feed: ArticleMeta[], sources: SourceInfo[], saved: SavedIndexEntry[], filter: string | null) {
    const signature = `${filter ?? 'all'}|${feed
      .slice(0, 20)
      .map((a) => a.id)
      .join(',')}|${saved.map((entry) => entry.id).join(',')}`
    const changed = signature !== this.feedSignature || feed.length !== this.feed.length
    const filterChanged = filter !== this.filter
    // Itens novos entram no topo: o foco acompanha a notícia pelo id, não o índice.
    const selected = this.homeItemAt(this.homeIndex)
    const anchorId = this.current?.id ?? (selected && selected !== 'menu' ? selected.id : null)
    const previousIndex = this.homeIndex
    this.feed = feed
    this.sources = sources
    this.saved = saved
    this.filter = filter
    this.feedSignature = signature
    if (filterChanged) {
      this.resetHome()
    } else {
      const at = anchorId ? feed.findIndex((article) => article.id === anchorId) : -1
      this.homeIndex = clampHomeIndex(at >= 0 ? at : this.homeIndex, feed.length)
    }
    if (!this.ready) return
    if (this.pendingRestore) {
      const snapshot = this.pendingRestore
      const meta = feed.find((article) => article.id === snapshot.articleId)
      if (meta) {
        this.pendingRestore = null
        void this.restore(snapshot)
        return
      }
    }
    if (this.mode === 'splash') {
      this.updateSplashStatus()
      this.checkSplash()
      return
    }
    if (!changed && this.homeIndex === previousIndex) return
    if (this.mode === 'home') this.syncHome()
    else if (this.mode === 'saved') void this.renderSaved()
  }

  async setLanguage(): Promise<void> {
    if (!this.ready) return
    if (this.mode === 'splash') {
      this.updateSplashStatus()
      return
    }
    if (this.mode === 'article' && this.current) {
      this.pages = this.paginateArticle(this.current)
      this.page = Math.min(this.page, this.pages.length - 1)
      await this.renderArticle()
      return
    }
    if (this.mode === 'actions') {
      await this.showActions(this.previousMode)
      return
    }
    if (this.mode === 'sources') {
      await this.renderSources()
      return
    }
    if (this.mode === 'saved') {
      await this.renderSaved()
      return
    }
    if (this.mode === 'help') {
      await this.renderHelp()
      return
    }
    await this.renderHome()
  }

  /* ----------------------------------------------------------- ocupado/aviso */

  /** Liga o spinner do cabeçalho e o aviso enquanto `task` roda. */
  private async runBusy<T>(label: string, task: () => Promise<T>): Promise<T> {
    this.beginBusy(label)
    try {
      return await task()
    } finally {
      this.endBusy()
    }
  }

  private beginBusy(label: string): void {
    this.busy += 1
    this.busyLabel = label
    this.notice = label
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.startSpinner()
    this.refreshHeader()
  }

  private endBusy(repaint = true): void {
    this.busy = Math.max(0, this.busy - 1)
    if (this.busy > 0) return
    if (this.notice === this.busyLabel) this.notice = ''
    this.busyLabel = ''
    this.animator.stop(repaint)
    this.refreshHeader()
  }

  private startSpinner(): void {
    const slot = this.headImage
    if (!slot || this.busy === 0 || !this.ready) return
    this.animator.start(
      'spinner',
      slot.id,
      slot.name,
      (elapsed) => {
        const index = spinnerIndex(elapsed)
        return { key: `spin:${index}`, data: spinnerFrame(index) }
      },
      SPINNER_INTERVAL_MS,
      { screen: this.mode, restore: () => ({ key: 'brand', data: brandMark() }) },
    )
  }

  /** Marca estática, ou o spinner se algo está carregando. */
  private paintHead(): void {
    const slot = this.headImage
    if (!slot) return
    if (this.busy > 0) this.startSpinner()
    else void this.paintImage(slot, 'brand', async () => brandMark())
  }

  private refreshHeader(): void {
    if (!this.ready) return
    if (this.mode === 'home') this.syncHome()
    else if (this.headText) void this.upgradeText(this.headText.id, this.headText.name, this.listHead())
  }

  private listHead(): string {
    const text = this.notice ? `${this.headTitle}  ·  ${this.notice}` : `${APP}  ·  ${this.headTitle}`
    return blank(pxTruncate(text, 528))
  }

  /* --------------------------------------------------------------- abertura */

  private splashStatusText(): string {
    return this.feed.length ? t('{n} matérias', { n: this.feed.length }) : t('carregando a edição…')
  }

  private splashLayout() {
    const textObject = [
      new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: W, height: 288, paddingLength: 0,
        containerID: S.cap.id, containerName: S.cap.name, textColor: DIM,
        content: ' ', isEventCapture: 1, zOrderIndex: 0,
      }),
      new TextContainerProperty({
        xPosition: 0, yPosition: 154, width: W, height: 28, paddingLength: 0,
        containerID: S.title.id, containerName: S.title.name, textColor: BRIGHT,
        content: centered(APP, W), isEventCapture: 0, zOrderIndex: 2,
      }),
      new TextContainerProperty({
        xPosition: 0, yPosition: 196, width: W, height: 28, paddingLength: 0,
        containerID: S.status.id, containerName: S.status.name, textColor: DIM,
        content: blank(centered(this.splashStatus, W)), isEventCapture: 0, zOrderIndex: 3,
      }),
    ]
    const imageObject = [
      new ImageContainerProperty({
        xPosition: (W - SPLASH_W) / 2, yPosition: 44, width: SPLASH_W, height: SPLASH_H,
        containerID: S.img.id, containerName: S.img.name, zOrderIndex: 1,
      }),
    ]
    return { containerTotalNum: textObject.length + imageObject.length, textObject, imageObject }
  }

  private startSplash(): void {
    this.splashStart = performance.now()
    this.animator.start(
      'splash',
      S.img.id,
      S.img.name,
      (elapsed) => splashFrame(elapsed),
      SPLASH_INTERVAL_MS,
      { screen: 'splash' },
    )
    this.splashTimers = [
      setTimeout(() => this.checkSplash(), SPLASH_MIN_MS + 20),
      setTimeout(() => this.checkSplash(), SPLASH_MAX_MS + 20),
    ]
  }

  private clearSplashTimers(): void {
    for (const timer of this.splashTimers) clearTimeout(timer)
    this.splashTimers = []
  }

  private updateSplashStatus(): void {
    const next = this.splashStatusText()
    if (next === this.splashStatus) return
    this.splashStatus = next
    void this.upgradeText(S.status.id, S.status.name, blank(centered(next, W)))
  }

  private checkSplash(): void {
    if (this.mode !== 'splash' || !this.ready) return
    if (splashDecision(performance.now() - this.splashStart, this.feed.length) === 'leave') {
      this.clearSplashTimers()
      void this.renderHome()
    }
  }

  /* ------------------------------------------------------------- matérias */

  async showArticle(meta: ArticleMeta): Promise<void> {
    const token = ++this.openToken
    this.beginBusy(t('abrindo…'))
    let article: ArticleFull | null = null
    try {
      // Mais de 8 s ou falha: abre com o resumo, como antes.
      article = await Promise.race([
        this.deps.loadArticle(meta),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), OPEN_TIMEOUT_MS)),
      ])
    } catch {
      article = null
    }
    this.endBusy(false)
    if (token !== this.openToken || this.destroyed) return
    const opened = article ?? { ...meta, content: meta.summary }
    const at = this.feed.findIndex((item) => item.id === meta.id)
    if (at >= 0) this.homeIndex = at
    this.current = opened
    this.mode = 'article'
    this.page = 0
    this.pages = this.paginateArticle(opened)
    await this.renderArticle()
  }

  async openArticle(meta: ArticleMeta): Promise<void> {
    await this.showArticle(meta)
  }

  private paginateArticle(article: ArticleFull): string[] {
    const body =
      (article.content || article.summary || '').trim() ||
      t('Esta matéria ainda não tem texto completo no Além dos Pontos. Abra a versão original no celular.')
    const note = article.full
      ? ''
      : `\n\n${t('(Resumo do Além dos Pontos. A íntegra está disponível no site da fonte.)')}`
    // O veículo já está no cabeçalho: o corpo começa na manchete.
    const text = `${article.title}\n\n${t('{n} min de leitura', { n: article.readingMin })}\n\n${body}${note}\n\n– ${APP}`
    return paginate(text, { width: BODY_W, height: BODY_H })
  }

  private sourceFor(id: string): SourceInfo | undefined {
    return this.sources.find((source) => source.id === id)
  }

  private homeItemAt(index: number): ArticleMeta | 'menu' | null {
    const item = itemAt(index, this.feed.length)
    if (item.kind === 'article') return this.feed[item.index]
    return item.kind === 'menu' ? 'menu' : null
  }

  /* -------------------------------------------------------------------- home */

  private homeHead(): string {
    if (this.notice) return pxTruncate(this.notice, 528)
    if (!this.feed.length && !this.busy) return pxTruncate(t('◈  Sem notícias agora — toque para atualizar'), 528)
    const filtered = this.filter ? this.sourceFor(this.filter)?.name ?? this.filter : null
    const label = filtered ? filtered.toUpperCase() : t('TUDO')
    return pxTruncate(`${APP}  ·  ${label}  ·  ${clockNow()}`, 528)
  }

  private vehicleOf(article: ArticleMeta) {
    const source = this.sourceFor(article.sourceId)
    return {
      key: sourceLineKey(source, article.sourceId),
      load: () => sourceLineArt(source, article.sourceId, article.sourceId),
    }
  }

  /** Manchete do card; quando ela ocupa menos de 3 linhas, a última traz idade e tempo de leitura. */
  private cardBody(article: ArticleMeta): string {
    const title = fitLines(article.title, CARD_LINES, CARD_TEXT_W)
    const used = measureTextWrap(title, CARD_TEXT_W).lineCount
    if (used >= CARD_LINES) return title
    const detail = `${relativeTime(article.publishedAt)} · ${t('{n} min de leitura', { n: article.readingMin })}`
    return `${title}${'\n'.repeat(CARD_LINES - used)}${detail}`
  }

  /** O que a home deve mostrar agora, calculado do estado atual. */
  private homeView(): HomeView {
    const item = itemAt(this.homeIndex, this.feed.length)
    const { position, total } = progressOf(this.homeIndex, this.feed.length)
    const foot = `${progressBar(position, total)}  ${position}/${total}`
    const next = nextItems(this.homeIndex, this.feed.length)
      .map((entry) => {
        if (entry.kind === 'menu') return t('Menu: atualizar, filtrar, salvos')
        if (entry.kind === 'empty') return ''
        const article = this.feed[entry.index]
        const short = this.sourceFor(article.sourceId)?.short ?? article.sourceId
        return pxTruncate(`${short} · ${article.title}`, NEXT.w)
      })
      .filter(Boolean)
      .join('\n')
    if (item.kind === 'article') {
      const article = this.feed[item.index]
      const category = CATEGORY_META[article.category]?.name ?? article.category
      const meta = `${t(category).toUpperCase()} · ${stampOf(article.publishedAt, false)}`
      return {
        head: this.homeHead(),
        card: ` \n${this.cardBody(article)}`,
        meta: rightAlign(meta, 260),
        next: blank(next),
        foot,
        vehicle: this.vehicleOf(article),
      }
    }
    const menuLabel = t('MENU')
    const body = this.feed.length
      ? `${t('atualizar · filtrar · salvos · idioma · ajuda')}\n\n${t('toque para abrir')}`
      : t('◈  Sem notícias agora — toque para atualizar')
    return {
      head: this.homeHead(),
      card: ` \n${body}`,
      meta: ' ',
      next: blank(next),
      foot,
      vehicle: { key: `menu:${menuLabel}`, load: () => menuLineArt(menuLabel) },
    }
  }

  private homeLayout(view: HomeView) {
    const text = (slot: Slot, x: number, y: number, w: number, h: number, content: string, color: number, z: number, capture = 0, extra: Partial<TextContainerProperty> = {}) =>
      new TextContainerProperty({
        xPosition: x, yPosition: y, width: w, height: h, paddingLength: 0,
        containerID: slot.id, containerName: slot.name, textColor: color,
        content, isEventCapture: capture, zOrderIndex: z, ...extra,
      })
    const textObject = [
      text(H.head, 38, 0, 532, 28, view.head, BRIGHT, 0, 1),
      text(H.card, CARD.x, CARD.y, CARD.w, CARD.h, view.card, BRIGHT, 1, 0, {
        borderWidth: 2, borderColor: 13, borderRadius: 10, paddingLength: 8,
      }),
      text(H.meta, 300, CARD.y + 10, 260, 28, view.meta, DIM, 3),
      text(H.next, NEXT.x, NEXT.y, NEXT.w, NEXT.h, view.next, DIM, 4),
      text(H.foot, 16, FOOT_Y - 1, 262, 28, view.foot, DIM, 5),
    ]
    const image = (slot: Slot, x: number, y: number, w: number, h: number, z: number) =>
      new ImageContainerProperty({
        xPosition: x, yPosition: y, width: w, height: h, containerID: slot.id, containerName: slot.name, zOrderIndex: z,
      })
    const imageObject = [
      image(H.veh, 16, CARD.y + 11, VEHICLE_W, VEHICLE_H, 2),
      image(H.brand, 8, 2, BRAND_SIZE, BRAND_SIZE, 6),
      image(H.keys, 282, FOOT_Y - 1, KEYS_W, KEYS_H, 7),
    ]
    return { containerTotalNum: textObject.length + imageObject.length, textObject, imageObject }
  }

  private resetHome(): void {
    this.homeIndex = 0
  }

  /** Depois de um rebuild: textos = layout, nenhuma imagem pintada. */
  private resetHomeCache(view: HomeView): void {
    this.sentText = new Map<number, string>([
      [H.head.id, view.head],
      [H.card.id, view.card],
      [H.meta.id, view.meta],
      [H.next.id, view.next],
      [H.foot.id, view.foot],
    ])
  }

  /** Pede a sincronização da home; um único laço envia só o que mudou. */
  private syncHome(): void {
    this.syncWanted = true
    if (this.syncRunning) return
    void this.syncLoop()
  }

  private syncStale(): boolean {
    return this.syncWanted || this.rebuilding > 0 || this.mode !== 'home' || !this.ready
  }

  private async sendText(id: number, name: string, content: string): Promise<void> {
    if (!this.bridge) return
    const ok = await this.run(() =>
      this.bridge!.textContainerUpgrade(
        new TextContainerUpgrade({ containerID: id, containerName: name, content, contentOffset: 0, contentLength: 0 }),
      ),
    )
    if (!ok) this.sentText.delete(id)
  }

  private async syncLoop(): Promise<void> {
    this.syncRunning = true
    try {
      while (this.syncWanted) {
        this.syncWanted = false
        if (this.syncStale() || !this.bridge) continue
        const view = this.homeView()
        // Por gesto: card primeiro, depois meta, "a seguir", rodapé e cabeçalho; por fim a imagem.
        const ordered: Array<[Slot, string]> = [
          [H.card, view.card],
          [H.meta, view.meta],
          [H.next, view.next],
          [H.foot, view.foot],
          [H.head, view.head],
        ]
        let interrupted = false
        for (const [slot, content] of ordered) {
          if (this.sentText.get(slot.id) === content) continue
          this.sentText.set(slot.id, content)
          await this.sendText(slot.id, slot.name, content)
          if (this.syncStale()) {
            interrupted = true
            break
          }
        }
        if (interrupted) continue
        if (this.sentImage.get(H.veh.name) !== view.vehicle.key) {
          const data = await view.vehicle.load()
          if (this.syncStale()) continue
          await this.paintImage(H.veh, view.vehicle.key, async () => data)
        }
      }
    } finally {
      this.syncRunning = false
    }
  }

  private moveHome(delta: number): void {
    if (!this.ready || this.mode !== 'home') return
    const next = clampHomeIndex(this.homeIndex + delta, this.feed.length)
    if (next === this.homeIndex) return
    this.homeIndex = next
    this.syncHome()
    this.emitSession()
  }

  private activateHome(): void {
    if (!this.ready || this.mode !== 'home') return
    const item = this.homeItemAt(this.homeIndex)
    if (item === null || item === 'menu') void this.showActions('home')
    else void this.showArticle(item)
  }

  /* ------------------------------------------------------------ bridge/fila */

  private async run<T>(task: () => Promise<T>): Promise<T | null> {
    const next = this.queue.then(task, task)
    this.queue = next.catch(() => undefined)
    try {
      return await next
    } catch {
      return null
    }
  }

  /** Imagem pelo bridge, sempre pela fila; erro limpa o cache do slot e segue. */
  private async sendFrame(slot: Slot, frame: AnimFrame): Promise<boolean> {
    if (!this.bridge || this.destroyed) return false
    const epoch = this.epoch
    const result = await this.run(() =>
      this.bridge!.updateImageRawData(
        new ImageRawDataUpdate({ containerID: slot.id, containerName: slot.name, imageData: Array.from(frame.data) }),
      ),
    )
    const ok = !!result && ImageRawDataUpdateResult.isSuccess(result)
    if (epoch === this.epoch) {
      if (ok) this.sentImage.set(slot.name, frame.key)
      else this.sentImage.delete(slot.name)
    }
    return ok
  }

  /** Pinta uma imagem uma vez por key (pula se já está lá). */
  private async paintImage(slot: Slot, key: string, load: () => Promise<Uint8Array>): Promise<void> {
    if (this.sentImage.get(slot.name) === key) return
    const epoch = this.epoch
    try {
      const data = await load()
      if (epoch !== this.epoch || this.destroyed || this.sentImage.get(slot.name) === key) return
      await this.sendFrame(slot, { key, data })
    } catch {
      if (epoch === this.epoch) this.sentImage.delete(slot.name)
    }
  }

  private emitSession(): void {
    if (this.mode === 'splash') return
    this.deps.onSession(this.getSnapshot())
  }

  /** Troca a página inteira. As imagens voltam em branco: zera o cache e quem chamou repinta. */
  private async rebuild(payload: RebuildPageContainer): Promise<void> {
    if (!this.bridge || !this.ready) return
    this.animator.stop(false)
    this.clearSplashTimers()
    this.epoch += 1
    this.sentImage.clear()
    this.rebuilding += 1
    try {
      await this.run(() => this.bridge!.rebuildPageContainer(payload))
    } finally {
      this.rebuilding -= 1
    }
    this.emitSession()
  }

  private async upgradeText(id: number, name: string, content: string): Promise<void> {
    if (!this.bridge || !this.ready) return
    await this.run(() =>
      this.bridge!.textContainerUpgrade(
        new TextContainerUpgrade({ containerID: id, containerName: name, content: blank(content), contentOffset: 0, contentLength: 0 }),
      ),
    )
  }

  private keys(kind: 'home' | 'list' | 'open' | 'back'): KeycapItem[] {
    const scroll: KeycapItem = { glyph: 'updown', label: t(kind === 'home' ? 'navegar' : 'rolar') }
    const pick: KeycapItem = { glyph: 'dot', label: t(kind === 'home' || kind === 'open' ? 'abrir' : 'escolher') }
    const out: KeycapItem = { glyph: 'dots', label: t(kind === 'home' ? 'sair' : 'voltar') }
    return [scroll, pick, out]
  }

  private paintKeys(slot: Slot, kind: 'home' | 'list' | 'open'): void {
    const items = this.keys(kind)
    const lang = currentLanguage()
    void this.paintImage(slot, `keys:${lang}:${kind}`, () => keycapsArt(items, lang))
  }

  /* -------------------------------------------------------------- renderers */

  private async renderHome(): Promise<void> {
    this.mode = 'home'
    this.current = null
    this.headImage = H.brand
    this.headText = null
    if (!this.ready) return
    this.homeIndex = clampHomeIndex(this.homeIndex, this.feed.length)
    const view = this.homeView()
    await this.rebuild(new RebuildPageContainer(this.homeLayout(view)))
    if (this.mode !== 'home') return
    this.resetHomeCache(view)
    this.syncHome()
    this.paintHead()
    this.paintKeys(H.keys, 'home')
  }

  private readerHead(article: ArticleFull): string {
    const when = newsClock(article.publishedAt)
    const stamp = when ? `${when.day} · ${when.clock} ${when.zone}` : relativeTime(article.publishedAt)
    return blank(rightAlign(stamp, 262))
  }

  private readerFoot(): string {
    if (this.mode === 'help') return `${this.page + 1}/${this.pages.length}  ${progressBar(this.page + 1, this.pages.length)}  ${t('toque: voltar')}`
    const last = this.page >= this.pages.length - 1
    const tail = last
      ? t('fim da matéria')
      : t('{n} min restantes', { n: remainingMinutes(this.current?.readingMin ?? 1, this.page, this.pages.length) })
    return `${this.page + 1}/${this.pages.length}  ·  ${tail}`
  }

  private ringKey(): { key: string; fraction: number } {
    const fraction = this.pages.length ? (this.page + 1) / this.pages.length : 1
    return { key: `ring:${ringStep(fraction)}`, fraction }
  }

  private async renderArticle(): Promise<void> {
    if (!this.ready || !this.current) return
    this.mode = 'article'
    this.headImage = null
    this.headText = null
    this.pageSlots = { body: R.body, foot: R.foot }
    const article = this.current
    const textObject = [
      new TextContainerProperty({
        xPosition: 0, yPosition: 28, width: W, height: 232, paddingLength: 8,
        containerID: R.body.id, containerName: R.body.name, textColor: BRIGHT,
        content: blank(this.pages[this.page] ?? ''), isEventCapture: 1,
      }),
      new TextContainerProperty({
        xPosition: 40, yPosition: 260, width: 380, height: 28, paddingLength: 0,
        containerID: R.foot.id, containerName: R.foot.name, textColor: DIM,
        content: blank(this.readerFoot()), isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: 420, yPosition: 260, width: 150, height: 28, paddingLength: 0,
        containerID: R.hint.id, containerName: R.hint.name, textColor: DIM,
        content: rightAlign(`2× ${t('menu')}`, 150), isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: 300, yPosition: 0, width: 270, height: 28, paddingLength: 0,
        containerID: R.date.id, containerName: R.date.name, textColor: DIM,
        content: this.readerHead(article), isEventCapture: 0,
      }),
    ]
    const imageObject = [
      new ImageContainerProperty({
        xPosition: 6, yPosition: 2, width: VEHICLE_W, height: VEHICLE_H,
        containerID: R.veh.id, containerName: R.veh.name,
      }),
      new ImageContainerProperty({
        xPosition: 8, yPosition: 262, width: BRAND_SIZE, height: BRAND_SIZE,
        containerID: R.ring.id, containerName: R.ring.name,
      }),
    ]
    await this.rebuild(
      new RebuildPageContainer({ containerTotalNum: textObject.length + imageObject.length, textObject, imageObject }),
    )
    if (this.mode !== 'article') return
    const source = this.sourceFor(article.sourceId)
    void this.paintImage(R.veh, sourceLineKey(source, article.sourceId), () => sourceLineArt(source, article.sourceId, article.sourceId))
    const ring = this.ringKey()
    void this.paintImage(R.ring, ring.key, async () => progressRing(ring.fraction))
  }

  private async renderPager(): Promise<void> {
    await this.upgradeText(this.pageSlots.foot.id, this.pageSlots.foot.name, this.readerFoot())
  }

  private changePage(delta: number) {
    if ((this.mode !== 'article' && this.mode !== 'help') || !this.ready) return
    const next = Math.min(this.pages.length - 1, Math.max(0, this.page + delta))
    if (next === this.page) return
    this.page = next
    const { body, foot } = this.pageSlots
    void this.upgradeText(body.id, body.name, this.pages[this.page] ?? '')
    void this.upgradeText(foot.id, foot.name, this.readerFoot())
    if (this.mode === 'article') {
      const ring = this.ringKey()
      void this.paintImage(R.ring, ring.key, async () => progressRing(ring.fraction))
    }
    this.emitSession()
  }

  /** Tela de texto paginado (ajuda, salvos vazio): cabeçalho com a marca, corpo, rodapé. */
  private async renderTextScreen(title: string, footer: () => string): Promise<void> {
    this.headImage = T.brand
    this.headText = T.head
    this.headTitle = title
    this.pageSlots = { body: T.body, foot: T.foot }
    const textObject = [
      new TextContainerProperty({
        xPosition: 0, yPosition: 28, width: W, height: 232, paddingLength: 8,
        containerID: T.body.id, containerName: T.body.name, textColor: BRIGHT,
        content: blank(this.pages[this.page] ?? ''), isEventCapture: 1,
      }),
      new TextContainerProperty({
        xPosition: 16, yPosition: 260, width: 554, height: 28, paddingLength: 0,
        containerID: T.foot.id, containerName: T.foot.name, textColor: DIM,
        content: blank(footer()), isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: 38, yPosition: 0, width: 532, height: 28, paddingLength: 0,
        containerID: T.head.id, containerName: T.head.name, textColor: DIM,
        content: this.listHead(), isEventCapture: 0,
      }),
    ]
    const imageObject = [
      new ImageContainerProperty({
        xPosition: 8, yPosition: 2, width: BRAND_SIZE, height: BRAND_SIZE,
        containerID: T.brand.id, containerName: T.brand.name,
      }),
    ]
    await this.rebuild(
      new RebuildPageContainer({ containerTotalNum: textObject.length + imageObject.length, textObject, imageObject }),
    )
    this.paintHead()
  }

  /** Tela de lista nativa dentro de uma moldura (borda arredondada), com cabeçalho e teclas. */
  private async renderListScreen(title: string, subtitle: string, items: string[], kind: 'list' | 'open'): Promise<void> {
    this.headImage = L.brand
    this.headText = L.head
    this.headTitle = title
    const textObject = [
      new TextContainerProperty({
        xPosition: 38, yPosition: 0, width: 532, height: 28, paddingLength: 0,
        containerID: L.head.id, containerName: L.head.name, textColor: DIM,
        content: this.listHead(), isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: 16, yPosition: FOOT_Y - 1, width: 262, height: 28, paddingLength: 0,
        containerID: L.foot.id, containerName: L.foot.name, textColor: DIM,
        content: blank(pxTruncate(subtitle, 258)), isEventCapture: 0,
      }),
    ]
    const listObject = [
      new ListContainerProperty({
        xPosition: 6, yPosition: 32, width: 564, height: 218,
        borderWidth: 2, borderColor: 13, borderRadius: 10, paddingLength: 6,
        containerID: L.list.id, containerName: L.list.name, isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: items.length,
          itemWidth: 540,
          isItemSelectBorderEn: 1,
          itemName: items,
        }),
      }),
    ]
    const imageObject = [
      new ImageContainerProperty({
        xPosition: 8, yPosition: 2, width: BRAND_SIZE, height: BRAND_SIZE,
        containerID: L.brand.id, containerName: L.brand.name,
      }),
      new ImageContainerProperty({
        xPosition: 282, yPosition: FOOT_Y - 1, width: KEYS_W, height: KEYS_H,
        containerID: L.keys.id, containerName: L.keys.name,
      }),
    ]
    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: textObject.length + listObject.length + imageObject.length,
        textObject,
        listObject,
        imageObject,
      }),
    )
    this.paintHead()
    this.paintKeys(L.keys, kind)
  }

  private onTap() {
    if (!this.ready || this.mode === 'splash') return
    if (this.mode === 'home') this.activateHome()
    else if (this.mode === 'article') void this.showActions('article')
    else if (this.mode === 'help') void this.renderHome()
    else if (this.mode === 'saved' && !this.saved.length) void this.renderHome()
  }

  private onDouble() {
    if (!this.ready) return
    // Abertura: igual à raiz (diálogo de saída do sistema).
    if (this.mode === 'splash') {
      void this.exit()
      return
    }
    const action = doubleTapAction(this.mode)
    // Raiz: diálogo de saída do sistema. Não limpar nada aqui — se o usuário
    // cancelar, o app segue ativo; a limpeza fica no SYSTEM_EXIT_EVENT.
    if (action === 'exit-dialog') void this.exit()
    else if (action === 'actions') void this.showActions('article')
    else void this.renderHome()
  }

  private onListSelect(index: number) {
    if (!this.ready) return
    if (this.mode === 'actions') {
      this.actions[index]?.()
      return
    }
    if (this.mode === 'sources') {
      const list = this.topSources()
      if (index === 0) {
        this.filter = null
        this.deps.setFilter(null)
      } else {
        const source = list[index - 1]
        if (!source) return
        this.filter = source.id
        this.deps.setFilter(source.id)
      }
      this.resetHome()
      void this.renderHome()
      return
    }
    if (this.mode === 'saved') {
      const entry = this.saved[index]
      if (entry) void this.showArticle(entry)
    }
  }

  private topSources(): SourceInfo[] {
    return [...this.sources].sort((a, b) => b.count - a.count).slice(0, 18)
  }

  private async showActions(from: GlassesMode): Promise<void> {
    if (!this.ready) return
    this.previousMode = from === 'actions' ? 'home' : from
    this.mode = 'actions'
    const items: string[] = []
    this.actions = []

    if (from === 'article' && this.current) {
      items.push(t('◈  Últimas notícias'))
      this.actions.push(() => this.renderHome())
      const isSaved = this.saved.some((entry) => entry.id === this.current!.id)
      items.push(t(isSaved ? '★  Remover dos salvos' : '☆  Salvar matéria'))
      this.actions.push(() => this.toggleCurrentSave())
      items.push(t('◀  Voltar à leitura'))
      this.actions.push(() => this.renderArticle())
      if (!this.current.full) {
        items.push(t('◈  Buscar texto completo'))
        this.actions.push(() => this.tryFullText())
      }
    }

    items.push(t('▶  Atualizar notícias'))
    this.actions.push(() => this.manualRefresh())
    items.push(t('▷  Filtrar por fonte'))
    this.actions.push(() => this.renderSources())
    items.push(t('★  Matérias salvas'))
    this.actions.push(() => this.renderSaved())
    items.push(`◈  ${currentLanguage() === 'pt' ? 'English' : 'Português'}`)
    this.actions.push(() => this.deps.setLanguageSetting(currentLanguage() === 'pt' ? 'en' : 'pt'))
    items.push(t('◈  Como usar'))
    this.actions.push(() => this.renderHelp())
    items.push(t('×  Sair do Além dos Pontos'))
    this.actions.push(() => this.exit())

    const subtitle =
      from === 'article' && this.current
        ? trimTitle(this.current.title, 48)
        : t('{n} matérias', { n: this.feed.length })

    await this.renderListScreen(t('MENU'), subtitle, items, 'list')
  }

  private async tryFullText(): Promise<void> {
    if (!this.current) return
    const current = this.current
    const full = await this.runBusy(t('Buscando texto completo…'), () => this.deps.loadArticle(current, true))
    const previousLength = current.content?.length ?? 0
    if (full?.content && (full.full || full.content.length > previousLength + 150)) {
      this.current = full
      this.pages = this.paginateArticle(full)
      this.page = 0
      await this.renderArticle()
      return
    }
    this.notice = t('Ainda só temos o resumo — abra no celular')
    this.refreshHeader()
    this.scheduleNoticeClear()
  }

  private async toggleCurrentSave(): Promise<void> {
    if (!this.current) return
    const saved = await this.deps.toggleSave(this.current)
    this.saved = this.deps.getSaved()
    this.notice = t(saved ? '★ SALVO NO CELULAR' : '☆ REMOVIDO DOS SALVOS')
    await this.showActions('article')
    this.scheduleNoticeClear()
  }

  private async manualRefresh(): Promise<void> {
    const wasArticle = this.previousMode === 'article' && this.current
    let failed = false
    this.beginBusy(t('ATUALIZANDO…'))
    try {
      await this.deps.refresh()
    } catch {
      failed = true
    }
    this.endBusy(false)
    this.notice = t(failed ? '! SEM CONEXÃO — TENTE DE NOVO' : 'OK · ATUALIZADO AGORA')
    this.feed = this.deps.getFeed()
    this.saved = this.deps.getSaved()
    if (wasArticle && this.current) {
      await this.renderArticle()
    } else {
      this.resetHome()
      await this.renderHome()
    }
    this.scheduleNoticeClear()
  }

  private scheduleNoticeClear() {
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => {
      if (this.busy === 0) this.notice = ''
      this.refreshHeader()
    }, 4500)
  }

  private async renderSources(): Promise<void> {
    if (!this.ready) return
    this.mode = 'sources'
    const list = this.topSources()
    const items = [t('●  Todas as fontes'), ...list.map((source) => `${this.filter === source.id ? '●' : '○'}  ${source.name} · ${source.count}`)]
    const subtitle = this.filter
      ? t('filtrando: {source}', { source: this.sourceFor(this.filter)?.name ?? this.filter })
      : t('mostrando todas as fontes')
    await this.renderListScreen(t('FONTES'), subtitle, items, 'list')
  }

  private async renderSaved(): Promise<void> {
    if (!this.ready) return
    this.mode = 'saved'
    if (!this.saved.length) {
      this.pages = paginate(
        [
          t('NADA SALVO AINDA'),
          '',
          t('Abra uma matéria e toque'),
          t('em ★ Salvar (no menu).'),
          '',
          t('Fica no seu celular, mesmo'),
          t('offline.'),
        ].join('\n'),
        { width: BODY_W, height: BODY_H },
      )
      this.page = 0
      await this.renderTextScreen(t('SALVOS'), () => `★ ${t('salvos')}  ·  ${t('toque: voltar')}`)
      return
    }
    const items = this.saved.slice(0, 20).map((entry) => {
      const source = this.sourceFor(entry.sourceId)
      return trimTitle(`${source?.short ?? entry.sourceId} · ${entry.title}`, 60)
    })
    await this.renderListScreen(t('★ SALVOS · {n}', { n: this.saved.length }), t('guardados no seu celular'), items, 'open')
  }

  private async renderHelp(): Promise<void> {
    if (!this.ready) return
    this.mode = 'help'
    const help = [
      t('▲ ▼  navegar e virar página'),
      t('●    abrir a matéria'),
      t('2×   na lista: sair do app'),
      t('2×   na matéria: abrir o menu'),
      t('▲ acima da 1ª notícia: Menu'),
      '',
      '─'.repeat(30),
      '',
      t('A notícia em foco fica sempre no'),
      t('mesmo card; as demais passam por'),
      t('ele. Abaixo, “A seguir”.'),
      '',
      t('No menu: atualizar, filtrar'),
      t('por fonte, salvar, ajuda e sair.'),
      '',
      t('O app atualiza sozinho a'),
      t('cada 15 minutos. Gesto manual:'),
      t('Menu → Atualizar.'),
    ].join('\n')
    this.pages = paginate(help, { width: BODY_W, height: BODY_H })
    this.page = 0
    await this.renderTextScreen(t('COMO USAR'), () => this.readerFoot())
  }

  private refreshCurrent() {
    if (this.mode === 'home') void this.renderHome()
    else if (this.mode === 'article') void this.renderPager()
    else if (this.mode === 'saved') void this.renderSaved()
  }

  private async exit(): Promise<void> {
    if (!this.bridge) return
    try {
      await this.bridge.shutDownPageContainer(1)
    } catch {
      /* ignore */
    }
  }

  saveSession() {
    this.emitSession()
  }

  getSnapshot(): GlassesSnapshot {
    return {
      mode: this.mode === 'splash' ? 'home' : this.mode,
      articleId: this.current?.id ?? null,
      page: this.page,
      filter: this.filter,
      homeIndex: this.homeIndex,
    }
  }

  async restore(snapshot: GlassesSnapshot): Promise<void> {
    this.filter = snapshot.filter
    this.feed = this.deps.getFeed()
    this.sources = this.deps.getSources()
    this.saved = this.deps.getSaved()
    if (snapshot.homeIndex !== undefined) this.homeIndex = clampHomeIndex(snapshot.homeIndex, this.feed.length)
    if (snapshot.mode === 'article' && snapshot.articleId) {
      const meta =
        this.feed.find((article) => article.id === snapshot.articleId) ??
        this.saved.find((article) => article.id === snapshot.articleId)
      if (meta) {
        this.pendingRestore = null
        await this.showArticle(meta)
        this.page = Math.min(snapshot.page, this.pages.length - 1)
        await this.renderArticle()
        return
      }
      // O feed ainda pode estar carregando: tenta de novo no próximo setData.
      this.pendingRestore = snapshot
      return
    }
    this.resetHome()
    await this.renderHome()
  }

  destroy() {
    this.destroyed = true
    this.ready = false
    this.animator.stop(false)
    this.unsubscribe?.()
    this.unsubscribeDevice?.()
    if (this.clockTimer) clearInterval(this.clockTimer)
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.clearSplashTimers()
    this.unsubscribe = null
    this.unsubscribeDevice = null
  }
}
