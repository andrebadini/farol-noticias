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
import { getBridge } from './bridge'
import { paginate } from './paginate'
import { getTextWidth, measureTextWrap, pxTruncate } from '@evenrealities/pretext'
import { clock, newsClock, relativeTime } from './time'
import { SOURCE_LINE_HEIGHT, SOURCE_LINE_WIDTH, blankSourceLine, menuLineArt, sourceLineArt, sourceLineKey } from './glasses-art'
import { HOME_ROWS, clampHomeIndex, pageStartOf, slotItem } from './home-window'
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

type GlassesMode = GlassesScreen

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

/**
 * Home própria do HUD: a lista nativa do firmware é uma linha só e não aceita
 * negrito nem logo por item. Aqui desenhamos a linha "logo + veículo" em
 * bitmap (negrito real); manchete e horário são containers de texto.
 */
const HOME_ROW_TOP = [30, 116, 202]
const HOME_HEAD_W = 564
const HOME_TITLE_W = 564
const HOME_TITLE_H = 54
const HOME_TIME_X = 396
const HOME_TIME_W = 174
const HOME_ID_HEAD = 1
const HOME_ID_LOGO = 2
const HOME_ID_TITLE = 5
const HOME_ID_TIME = 8

interface HomeImage {
  key: string
  load: () => Promise<Uint8Array>
}

interface HomeView {
  head: string
  titles: string[]
  times: string[]
  images: HomeImage[]
}

/** Corta por caracteres, preservando o ellipsis para o container de texto. */
function trimTitle(text: string, max = 128): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Ajusta a manchete a no máximo 2 linhas, cortando palavras do fim e fechando com "…". */
function fitTitle(title: string, prefix: string): string {
  const words = title.split(/\s+/).filter(Boolean)
  const fits = (text: string) => measureTextWrap(`${prefix}${text}`, HOME_TITLE_W).lineCount <= 2
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

/** Alinha à direita no container de horário preenchendo com espaços. */
function rightAlign(text: string): string {
  const pad = Math.max(0, Math.floor((HOME_TIME_W - getTextWidth(text)) / getTextWidth(' ')))
  return `${' '.repeat(pad)}${text}`
}

function bar(page: number, total: number, width = 8): string {
  const filled = Math.max(1, Math.round(((page + 1) / Math.max(1, total)) * width))
  return '━'.repeat(filled) + '─'.repeat(Math.max(0, width - filled))
}

export class GlassesUI {
  private bridge: EvenAppBridge | null = null
  private ready = false
  private destroyed = false
  private queue: Promise<unknown> = Promise.resolve()
  private unsubscribe: (() => void) | null = null
  private unsubscribeDevice: (() => void) | null = null
  private clockTimer: ReturnType<typeof setInterval> | null = null

  private mode: GlassesMode = 'home'
  private previousMode: GlassesMode = 'home'
  private homeIndex = 0
  // Sincronização single-flight da home: o que já foi enviado aos óculos.
  private sentText = new Map<number, string>()
  private sentImage: Array<string | null> = [null, null, null]
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

  private deps: GlassesDeps

  constructor(deps: GlassesDeps) {
    this.deps = deps
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
      const view = this.homeView()
      const created = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(this.homeLayout(view)))
      if (created !== 0) throw new Error(`startup ${created}`)
      this.ready = true
      this.attach()
      this.deps.onStatus({ state: 'ready' })
      this.refreshDevice()
      this.clockTimer = setInterval(() => {
        if (this.mode === 'home') this.syncHome()
      }, 60_000)
      this.resetHomeCache(view)
      this.syncHome()
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
        void this.deps.refresh().catch(() => undefined)
        this.refreshCurrent()
        return
      }
      if (sysType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
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
    // Itens novos entram no topo: o cursor acompanha a notícia, não o índice.
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
    if (!changed && this.homeIndex === previousIndex) return
    if (this.mode === 'home') this.syncHome()
    else if (this.mode === 'saved') void this.renderSaved()
  }

  async setLanguage(): Promise<void> {
    if (!this.ready) return
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

  async showArticle(meta: ArticleMeta): Promise<void> {
    const article = (await this.deps.loadArticle(meta)) ?? { ...meta, content: meta.summary }
    const at = this.feed.findIndex((item) => item.id === meta.id)
    if (at >= 0) this.homeIndex = at
    this.current = article
    this.mode = 'article'
    this.page = 0
    this.pages = this.paginateArticle(article)
    await this.renderArticle()
  }

  async openArticle(meta: ArticleMeta): Promise<void> {
    await this.showArticle(meta)
  }

  private paginateArticle(article: ArticleFull): string[] {
    const source = this.sourceFor(article.sourceId)
    const when = newsClock(article.publishedAt)
    const stamp = when
      ? `${when.day} · ${when.clock} ${when.zone}`
      : relativeTime(article.publishedAt)
    const meta = `${stamp} · ${t('{n} min de leitura', { n: article.readingMin })}`
    const body =
      (article.content || article.summary || '').trim() ||
      t('Esta matéria ainda não tem texto completo no Além dos Pontos. Abra a versão original no celular.')
    const note = article.full
      ? ''
      : `\n\n${t('(Resumo do Além dos Pontos. A íntegra está disponível no site da fonte.)')}`
    const text = `▌ ${article.title}\n\n${(source?.name ?? article.sourceId).toUpperCase()}\n${meta}\n\n${body}${note}\n\n— ALÉM DOS PONTOS`
    return paginate(text, { width: BODY_W, height: BODY_H })
  }

  private sourceFor(id: string): SourceInfo | undefined {
    return this.sources.find((source) => source.id === id)
  }

  private homeItemAt(index: number): ArticleMeta | 'menu' | null {
    if (index >= 0 && index < this.feed.length) return this.feed[index]
    if (index === this.feed.length) return 'menu'
    return null
  }

  private homeHead(): string {
    const menuText = t('Menu: atualizar, filtrar, salvos')
    if (this.notice) return pxTruncate(this.notice, HOME_HEAD_W)
    if (this.homeIndex < 0) return pxTruncate(`▶ ${menuText}`, HOME_HEAD_W)
    const now = newsClock(new Date().toISOString())
    const filtered = this.filter ? this.sourceFor(this.filter)?.name ?? this.filter : null
    const label = filtered ? filtered.toUpperCase() : t('TUDO')
    const total = this.feed.length
    const position = Math.min(this.homeIndex + 1, total)
    const time = now ? `${now.clock} ${now.zone}` : clock(new Date().toISOString())
    return pxTruncate(`◈ ALÉM DOS PONTOS  ${time}  ·  ${label} ${position}/${total}`, HOME_HEAD_W)
  }

  /** O que a home deve mostrar agora, calculado do estado atual. */
  private homeView(): HomeView {
    const start = pageStartOf(this.homeIndex)
    const today = t('hoje')
    const view: HomeView = { head: this.homeHead(), titles: [], times: [], images: [] }
    for (let slot = 0; slot < HOME_ROWS; slot += 1) {
      const item = slotItem(start, slot, this.feed.length)
      const selected = start + slot === this.homeIndex
      const marker = selected ? '▶ ' : '  '
      if (item.kind === 'menu') {
        view.titles.push(`${marker}${t('Menu: atualizar, filtrar, salvos')}`)
        view.times.push(' ')
        view.images.push({ key: 'menu', load: menuLineArt })
      } else if (item.kind === 'article') {
        const article = this.feed[item.index]
        const source = this.sourceFor(article.sourceId)
        const when = newsClock(article.publishedAt)
        const stamp = when ? (when.day === today ? when.clock : `${when.day} ${when.clock}`) : ''
        view.titles.push(`${marker}${fitTitle(article.title, '▶ ')}`)
        view.times.push(stamp ? rightAlign(stamp) : ' ')
        view.images.push({
          key: sourceLineKey(source, article.sourceId),
          load: () => sourceLineArt(source, article.sourceId, article.sourceId),
        })
      } else {
        view.titles.push(' ')
        view.times.push(' ')
        view.images.push({ key: 'blank', load: async () => blankSourceLine() })
      }
    }
    return view
  }

  private homeLayout(view: HomeView) {
    const textObject = [
      new TextContainerProperty({
        xPosition: 6, yPosition: 0, width: HOME_HEAD_W, height: 28,
        paddingLength: 0, containerID: HOME_ID_HEAD, containerName: 'homeHead',
        textColor: BRIGHT, content: view.head, isEventCapture: 1,
      }),
      ...HOME_ROW_TOP.map(
        (top, slot) =>
          new TextContainerProperty({
            xPosition: 6, yPosition: top + 30, width: HOME_TITLE_W, height: HOME_TITLE_H,
            paddingLength: 0, containerID: HOME_ID_TITLE + slot, containerName: `title${slot}`,
            textColor: BRIGHT, content: view.titles[slot], isEventCapture: 0,
          }),
      ),
      ...HOME_ROW_TOP.map(
        (top, slot) =>
          new TextContainerProperty({
            xPosition: HOME_TIME_X, yPosition: top + 1, width: HOME_TIME_W, height: 28,
            paddingLength: 0, containerID: HOME_ID_TIME + slot, containerName: `time${slot}`,
            textColor: DIM, content: view.times[slot], isEventCapture: 0,
          }),
      ),
    ]
    const imageObject = HOME_ROW_TOP.map(
      (top, slot) =>
        new ImageContainerProperty({
          xPosition: 6, yPosition: top + 2, width: SOURCE_LINE_WIDTH, height: SOURCE_LINE_HEIGHT,
          containerID: HOME_ID_LOGO + slot, containerName: `logo${slot}`,
        }),
    )
    return { containerTotalNum: textObject.length + imageObject.length, textObject, imageObject }
  }

  private resetHome(): void {
    this.homeIndex = 0
  }

  /** Depois de um rebuild/startup: textos = layout, nenhuma imagem pintada. */
  private resetHomeCache(view: HomeView): void {
    this.sentText = new Map<number, string>([[HOME_ID_HEAD, view.head]])
    for (let slot = 0; slot < HOME_ROWS; slot += 1) {
      this.sentText.set(HOME_ID_TITLE + slot, view.titles[slot])
      this.sentText.set(HOME_ID_TIME + slot, view.times[slot])
    }
    this.sentImage = [null, null, null]
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
        const texts: Array<[number, string, string]> = [[HOME_ID_HEAD, 'homeHead', view.head]]
        for (let slot = 0; slot < HOME_ROWS; slot += 1) {
          texts.push([HOME_ID_TITLE + slot, `title${slot}`, view.titles[slot]])
          texts.push([HOME_ID_TIME + slot, `time${slot}`, view.times[slot]])
        }
        // Cabeçalho, depois título e horário de cada slot, depois as imagens.
        const ordered = [texts[0], ...texts.slice(1).filter(([id]) => id < HOME_ID_TIME), ...texts.slice(1).filter(([id]) => id >= HOME_ID_TIME)]
        let interrupted = false
        for (const [id, name, content] of ordered) {
          if (this.sentText.get(id) === content) continue
          this.sentText.set(id, content)
          await this.sendText(id, name, content)
          if (this.syncStale()) {
            interrupted = true
            break
          }
        }
        if (interrupted) continue
        for (let slot = 0; slot < HOME_ROWS; slot += 1) {
          const image = view.images[slot]
          if (this.sentImage[slot] === image.key) continue
          const data = await image.load()
          if (this.syncStale()) break
          this.sentImage[slot] = image.key
          const result = await this.run(() =>
            this.bridge!.updateImageRawData(
              new ImageRawDataUpdate({
                containerID: HOME_ID_LOGO + slot,
                containerName: `logo${slot}`,
                imageData: Array.from(data),
              }),
            ),
          )
          if (!result || !ImageRawDataUpdateResult.isSuccess(result)) this.sentImage[slot] = null
          if (this.syncStale()) break
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
    this.deps.onSession(this.getSnapshot())
  }

  private activateHome(): void {
    if (!this.ready || this.mode !== 'home') return
    const item = this.homeItemAt(this.homeIndex)
    if (item === null || item === 'menu') void this.showActions('home')
    else void this.showArticle(item)
  }

  private async run<T>(task: () => Promise<T>): Promise<T | null> {
    const next = this.queue.then(task, task)
    this.queue = next.catch(() => undefined)
    try {
      return await next
    } catch {
      return null
    }
  }

  private async rebuild(payload: RebuildPageContainer): Promise<void> {
    if (!this.bridge || !this.ready) return
    await this.run(() => this.bridge!.rebuildPageContainer(payload))
    this.deps.onSession(this.getSnapshot())
  }

  private async upgradeText(id: number, name: string, content: string): Promise<void> {
    if (!this.bridge || !this.ready) return
    await this.run(() =>
      this.bridge!.textContainerUpgrade(
        new TextContainerUpgrade({ containerID: id, containerName: name, content, contentOffset: 0, contentLength: 0 }),
      ),
    )
  }

  private async renderHome(): Promise<void> {
    this.mode = 'home'
    this.current = null
    if (!this.ready) return
    this.homeIndex = clampHomeIndex(this.homeIndex, this.feed.length)
    const view = this.homeView()
    this.rebuilding += 1
    try {
      await this.rebuild(new RebuildPageContainer(this.homeLayout(view)))
    } finally {
      this.rebuilding -= 1
    }
    if (this.mode !== 'home') return
    this.resetHomeCache(view)
    this.syncHome()
  }

  private async renderArticle(): Promise<void> {
    if (!this.ready || !this.current) return
    this.mode = 'article'
    const content = this.pages[this.page] ?? ''
    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 2,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 240,
            paddingLength: 8, containerID: 1, containerName: 'body',
            textColor: BRIGHT, content, isEventCapture: 1,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 242, width: W, height: 46,
            paddingLength: 6, containerID: 2, containerName: 'pager',
            textColor: DIM, content: this.pagerLine(), isEventCapture: 0,
          }),
        ],
      }),
    )
  }

  private pagerLine(): string {
    return this.footerLine()
  }

  private async renderPager(): Promise<void> {
    await this.upgradeText(2, 'pager', this.footerLine())
  }

  private changePage(delta: number) {
    if ((this.mode !== 'article' && this.mode !== 'help') || !this.ready) return
    const next = Math.min(this.pages.length - 1, Math.max(0, this.page + delta))
    if (next === this.page) return
    this.page = next
    void this.upgradeText(1, 'body', this.pages[this.page] ?? '')
    void this.upgradeText(2, 'pager', this.footerLine())
    this.deps.onSession(this.getSnapshot())
  }

  private footerLine(): string {
    const tail = `● ${t(this.mode === 'help' ? 'voltar' : 'ações')}`
    return `${this.page + 1}/${this.pages.length}  ${bar(this.page, this.pages.length)}  ${tail}`
  }

  private onTap() {
    if (!this.ready) return
    if (this.mode === 'home') this.activateHome()
    else if (this.mode === 'article') void this.showActions('article')
    else if (this.mode === 'help') void this.renderHome()
    else if (this.mode === 'saved' && !this.saved.length) void this.renderHome()
  }

  private onDouble() {
    if (!this.ready) return
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
        : t('{n} matérias · atualize ou filtre', { n: this.feed.length })

    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 4,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 35,
            paddingLength: 4, containerID: 1, containerName: 'title',
            textColor: BRIGHT, content: t('MENU'), isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 35, width: W, height: 35,
            paddingLength: 4, containerID: 2, containerName: 'subtitle',
            textColor: DIM, content: subtitle, isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 252, width: W, height: 36,
            paddingLength: 4, containerID: 4, containerName: 'hint',
            textColor: DIM, content: t('▲▼ rolar  ·  ● escolher  ·  2× lista'), isEventCapture: 0,
          }),
        ],
        listObject: [
          new ListContainerProperty({
            xPosition: 0, yPosition: 72, width: W, height: 178,
            paddingLength: 2, containerID: 3, containerName: 'menu',
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
              itemCount: items.length,
              itemWidth: 560,
              isItemSelectBorderEn: 1,
              itemName: items,
            }),
          }),
        ],
      }),
    )
  }

  private async tryFullText(): Promise<void> {
    if (!this.current) return
    await this.upgradeText(2, 'subtitle', t('Buscando texto completo…'))
    const full = await this.deps.loadArticle(this.current, true)
    const previousLength = this.current.content?.length ?? 0
    if (full?.content && (full.full || full.content.length > previousLength + 150)) {
      this.current = full
      this.pages = this.paginateArticle(full)
      this.page = 0
      await this.renderArticle()
      return
    }
    await this.upgradeText(2, 'subtitle', t('Ainda só temos o resumo — abra no celular'))
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
    this.notice = t('↻ ATUALIZANDO…')
    if (this.mode === 'home') this.syncHome()
    try {
      await this.deps.refresh()
      this.notice = t('OK · ATUALIZADO AGORA')
    } catch {
      this.notice = t('! SEM CONEXÃO — TENTE DE NOVO')
    }
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
      this.notice = ''
      if (this.mode === 'home') this.syncHome()
    }, 4500)
  }

  private async renderSources(): Promise<void> {
    if (!this.ready) return
    this.mode = 'sources'
    const list = this.topSources()
    const items = [t('●  Todas as fontes'), ...list.map((source) => `${this.filter === source.id ? '●' : '○'}  ${source.name} · ${source.count}`)]
    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 4,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 35,
            paddingLength: 4, containerID: 1, containerName: 'title',
            textColor: BRIGHT, content: t('FONTES'), isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 35, width: W, height: 35,
            paddingLength: 4, containerID: 2, containerName: 'subtitle',
            textColor: DIM, content: this.filter ? t('filtrando: {source}', { source: this.sourceFor(this.filter)?.name ?? this.filter }) : t('mostrando todas as fontes'), isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 252, width: W, height: 36,
            paddingLength: 4, containerID: 4, containerName: 'hint',
            textColor: DIM, content: t('▲▼ rolar  ·  ● filtrar  ·  2× voltar'), isEventCapture: 0,
          }),
        ],
        listObject: [
          new ListContainerProperty({
            xPosition: 0, yPosition: 70, width: W, height: 160,
            paddingLength: 2, containerID: 3, containerName: 'menu',
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
              itemCount: items.length,
              itemWidth: 560,
              isItemSelectBorderEn: 1,
              itemName: items,
            }),
          }),
        ],
      }),
    )
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
      await this.rebuild(
        new RebuildPageContainer({
          containerTotalNum: 2,
          textObject: [
            new TextContainerProperty({
              xPosition: 0, yPosition: 0, width: W, height: 240,
              paddingLength: 8, containerID: 1, containerName: 'body',
              textColor: BRIGHT, content: this.pages[0], isEventCapture: 1,
            }),
            new TextContainerProperty({
              xPosition: 0, yPosition: 242, width: W, height: 46,
              paddingLength: 6, containerID: 2, containerName: 'pager',
              textColor: DIM, content: t('★ salvos  ·  ● voltar'), isEventCapture: 0,
            }),
          ],
        }),
      )
      return
    }
    const items = this.saved.slice(0, 20).map((entry) => {
      const source = this.sourceFor(entry.sourceId)
      return trimTitle(`${source?.short ?? entry.sourceId} · ${entry.title}`, 60)
    })
    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 4,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 35,
            paddingLength: 4, containerID: 1, containerName: 'title',
            textColor: BRIGHT, content: t('★ SALVOS · {n}', { n: this.saved.length }), isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 35, width: W, height: 35,
            paddingLength: 4, containerID: 2, containerName: 'subtitle',
            textColor: DIM, content: t('guardados no seu celular'), isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 252, width: W, height: 36,
            paddingLength: 4, containerID: 4, containerName: 'hint',
            textColor: DIM, content: t('▲▼ rolar  ·  ● abrir  ·  2× voltar'), isEventCapture: 0,
          }),
        ],
        listObject: [
          new ListContainerProperty({
            xPosition: 0, yPosition: 70, width: W, height: 160,
            paddingLength: 2, containerID: 3, containerName: 'menu',
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
              itemCount: items.length,
              itemWidth: 560,
              isItemSelectBorderEn: 1,
              itemName: items,
            }),
          }),
        ],
      }),
    )
  }

  private async renderHelp(): Promise<void> {
    if (!this.ready) return
    this.mode = 'help'
    const help = [
      t('◈ ALÉM DOS PONTOS — COMO USAR'),
      '',
      t('▲ ▼  navegar e virar página'),
      t('●    abrir a matéria'),
      t('●●   2 toques na lista: sair'),
      t('2× em matéria abre o menu'),
      t('Menu: ▲ acima da 1ª notícia'),
      t('▲ ▼  percorre todas as notícias'),
      '',
      '─'.repeat(34),
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
    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 2,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 240,
            paddingLength: 8, containerID: 1, containerName: 'body',
            textColor: BRIGHT, content: this.pages[0], isEventCapture: 1,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 242, width: W, height: 46,
            paddingLength: 6, containerID: 2, containerName: 'pager',
            textColor: DIM, content: `${this.page + 1}/${this.pages.length}  ${bar(this.page, this.pages.length)}  ● ${t('voltar')}`, isEventCapture: 0,
          }),
        ],
      }),
    )
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
    this.deps.onSession(this.getSnapshot())
  }

  getSnapshot(): GlassesSnapshot {
    return {
      mode: this.mode,
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
    this.unsubscribe?.()
    this.unsubscribeDevice?.()
    if (this.clockTimer) clearInterval(this.clockTimer)
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.unsubscribe = null
    this.unsubscribeDevice = null
  }
}
