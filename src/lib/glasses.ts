import {
  CreateStartUpPageContainer,
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
import { clock, relativeTime } from './time'

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
}

type GlassesMode = 'home' | 'article' | 'actions' | 'sources' | 'saved' | 'help'

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
}

const W = 576
const BODY_W = 560
const BODY_H = 216
const BRIGHT = 4
const DIM = 2

const encoder = new TextEncoder()

/** Corta por bytes UTF-8: o firmware limita o item da lista a 63 bytes. */
function cut(text: string, maxBytes: number): string {
  if (encoder.encode(text).length <= maxBytes) return text
  let out = ''
  for (const char of text) {
    if (encoder.encode(`${out}${char}…`).length > maxBytes) break
    out += char
  }
  return `${out.trimEnd()}…`
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
  private feed: ArticleMeta[] = []
  private sources: SourceInfo[] = []
  private saved: SavedIndexEntry[] = []
  private filter: string | null = null
  private current: ArticleFull | null = null
  private pages: string[] = []
  private page = 0
  private actions: Array<() => void> = []
  private homeArticles: ArticleMeta[] = []
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
      this.deps.onStatus({ state: 'unavailable', message: 'Modo navegador — sem óculos conectados' })
      return
    }
    this.bridge = bridge
    try {
      const created = await bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer({
          containerTotalNum: 4,
          textObject: [
            new TextContainerProperty({
              xPosition: 0, yPosition: 0, width: W, height: 35,
              paddingLength: 4, containerID: 1, containerName: 'brand',
              textColor: BRIGHT, content: this.brandLine(), isEventCapture: 0,
            }),
            new TextContainerProperty({
              xPosition: 0, yPosition: 35, width: W, height: 35,
              paddingLength: 4, containerID: 2, containerName: 'topic',
              textColor: DIM, content: this.topicLine(), isEventCapture: 0,
            }),
            new TextContainerProperty({
              xPosition: 0, yPosition: 252, width: W, height: 36,
              paddingLength: 4, containerID: 4, containerName: 'hint',
              textColor: DIM, content: '▲▼ rolar  ·  ● abrir  ·  2× menu', isEventCapture: 0,
            }),
          ],
          listObject: [
            new ListContainerProperty({
              xPosition: 0, yPosition: 72, width: W, height: 160,
              paddingLength: 2, borderWidth: 0, containerID: 3, containerName: 'feed',
              isEventCapture: 1,
              itemContainer: new ListItemContainerProperty({
                itemCount: 1,
                itemWidth: 560,
                isItemSelectBorderEn: 1,
                itemName: ['◈  Abrindo o Farolira…'],
              }),
            }),
          ],
        }),
      )
      if (created !== 0) throw new Error(`startup ${created}`)
      this.ready = true
      this.attach()
      this.deps.onStatus({ state: 'ready' })
      this.refreshDevice()
      this.feed = this.deps.getFeed()
      this.sources = this.deps.getSources()
      this.saved = this.deps.getSaved()
      this.filter = this.deps.getFilter()
      this.clockTimer = setInterval(() => {
        if (this.mode === 'home') this.upgradeText(1, 'brand', this.brandLine())
      }, 60_000)
      this.renderHome()
    } catch (error) {
      this.deps.onStatus({ state: 'error', message: error instanceof Error ? error.message : 'falha ao iniciar' })
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
        if (type === OsEventTypeList.SCROLL_TOP_EVENT) this.changePage(-1)
        else if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) this.changePage(1)
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
    const changed = signature !== this.feedSignature
    this.feed = feed
    this.sources = sources
    this.saved = saved
    this.filter = filter
    this.feedSignature = signature
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
    if (!changed) return
    if (this.mode === 'home') void this.renderHome()
    else if (this.mode === 'saved') void this.renderSaved()
  }

  async showArticle(meta: ArticleMeta): Promise<void> {
    const article = (await this.deps.loadArticle(meta)) ?? { ...meta, content: meta.summary }
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
    const meta = `${source?.name ?? article.sourceId} · ${relativeTime(article.publishedAt)} · leitura ${article.readingMin} min`
    const body =
      (article.content || article.summary || '').trim() ||
      'Esta matéria ainda não tem texto completo no Farolira. Abra a versão original no celular.'
    const note = article.full
      ? ''
      : '\n\n(Resumo do Farolira. A íntegra está disponível no site da fonte.)'
    const text = `▌ ${article.title}\n\n${meta}\n\n${body}${note}\n\n— FAROLIRA`
    return paginate(text, { width: BODY_W, height: BODY_H })
  }

  private sourceFor(id: string): SourceInfo | undefined {
    return this.sources.find((source) => source.id === id)
  }

  private brandLine(): string {
    return `◈ FAROLIRA  ·  ${clock(new Date().toISOString())}`
  }

  private topicLine(): string {
    if (this.notice) return this.notice
    const filtered = this.filter ? this.sourceFor(this.filter)?.name ?? this.filter : 'tudo'
    const filterLabel = filtered === 'tudo' ? 'TUDO' : filtered.toUpperCase()
    return `${filterLabel} · ${this.feed.length} NOTÍCIAS`
  }

  private listItems(): string[] {
    if (!this.feed.length) {
      this.homeArticles = []
      return ['◈  Sem notícias agora — 2× para atualizar']
    }
    // Diversidade: no máximo 2 manchetes por veículo nas 20 primeiras, para a
    // home não virar um feed de uma fonte só quando ela publica em rajada.
    const picked: ArticleMeta[] = []
    const counts = new Map<string, number>()
    const overflow: ArticleMeta[] = []
    const noise = /(lotof[aá]cil|quina|mega-sena|lotomania|sorteio|resultado do|hor[oó]scopo|bbb|celebridade)/i
    for (const article of this.feed) {
      if (picked.length >= 20) break
      const count = counts.get(article.sourceId) ?? 0
      const perSource = picked.length < 8 ? 1 : 2
      if (noise.test(article.title) && picked.length < 14) {
        overflow.push(article)
      } else if (count < perSource) {
        picked.push(article)
        counts.set(article.sourceId, count + 1)
      } else {
        overflow.push(article)
      }
    }
    for (const article of overflow) {
      if (picked.length >= 20) break
      picked.push(article)
    }
    this.homeArticles = picked
    return picked.map((article) => {
      const source = this.sourceFor(article.sourceId)
      const prefix = source?.short ?? article.sourceId
      return cut(`${prefix} · ${article.title}`, 60)
    })
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
    const items = this.listItems()
    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 4,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 35,
            paddingLength: 4, containerID: 1, containerName: 'brand',
            textColor: BRIGHT, content: this.brandLine(), isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 35, width: W, height: 35,
            paddingLength: 4, containerID: 2, containerName: 'topic',
            textColor: DIM, content: this.topicLine(), isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 252, width: W, height: 36,
            paddingLength: 4, containerID: 4, containerName: 'hint',
            textColor: DIM, content: '▲▼ rolar  ·  ● abrir  ·  2× menu', isEventCapture: 0,
          }),
        ],
        listObject: [
          new ListContainerProperty({
            xPosition: 0, yPosition: 72, width: W, height: 160,
            paddingLength: 2, borderWidth: 0, containerID: 3, containerName: 'feed',
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
    const tail = this.mode === 'help' ? '● voltar' : '● ações'
    return `${this.page + 1}/${this.pages.length}  ${bar(this.page, this.pages.length)}  ${tail}`
  }

  private onTap() {
    if (!this.ready) return
    if (this.mode === 'article') void this.showActions('article')
    else if (this.mode === 'help') void this.renderHome()
    else if (this.mode === 'saved' && !this.saved.length) void this.renderHome()
  }

  private onDouble() {
    if (!this.ready) return
    if (this.mode === 'article') void this.showActions('article')
    else if (this.mode === 'home') void this.showActions('home')
    else if (this.mode === 'actions') void this.renderHome()
    else void this.renderHome()
  }

  private onListSelect(index: number) {
    if (!this.ready) return
    if (this.mode === 'home') {
      const meta = this.homeArticles[index]
      if (meta) void this.showArticle(meta)
      else void this.deps.refresh()
      return
    }
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
      items.push('◈  Últimas notícias')
      this.actions.push(() => this.renderHome())
      const isSaved = this.saved.some((entry) => entry.id === this.current!.id)
      items.push(isSaved ? '★  Remover dos salvos' : '☆  Salvar matéria')
      this.actions.push(() => this.toggleCurrentSave())
      items.push('◀  Voltar à leitura')
      this.actions.push(() => this.renderArticle())
      if (!this.current.full) {
        items.push('◈  Buscar texto completo')
        this.actions.push(() => this.tryFullText())
      }
    }

    items.push('▶  Atualizar notícias')
    this.actions.push(() => this.manualRefresh())
    items.push('▷  Filtrar por fonte')
    this.actions.push(() => this.renderSources())
    items.push('★  Matérias salvas')
    this.actions.push(() => this.renderSaved())
    items.push('◈  Como usar')
    this.actions.push(() => this.renderHelp())
    items.push('×  Sair do Farolira')
    this.actions.push(() => this.exit())

    const subtitle =
      from === 'article' && this.current
        ? cut(this.current.title, 48)
        : `${this.feed.length} matérias · atualize ou filtre`

    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 4,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 35,
            paddingLength: 4, containerID: 1, containerName: 'title',
            textColor: BRIGHT, content: 'MENU', isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 35, width: W, height: 35,
            paddingLength: 4, containerID: 2, containerName: 'subtitle',
            textColor: DIM, content: subtitle, isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 252, width: W, height: 36,
            paddingLength: 4, containerID: 4, containerName: 'hint',
            textColor: DIM, content: '▲▼ rolar  ·  ● escolher  ·  2× lista', isEventCapture: 0,
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
    await this.upgradeText(2, 'subtitle', 'Buscando texto completo…')
    const full = await this.deps.loadArticle(this.current, true)
    const previousLength = this.current.content?.length ?? 0
    if (full?.content && (full.full || full.content.length > previousLength + 150)) {
      this.current = full
      this.pages = this.paginateArticle(full)
      this.page = 0
      await this.renderArticle()
      return
    }
    await this.upgradeText(2, 'subtitle', 'Ainda só temos o resumo — abra no celular')
  }

  private async toggleCurrentSave(): Promise<void> {
    if (!this.current) return
    const saved = await this.deps.toggleSave(this.current)
    this.saved = this.deps.getSaved()
    this.notice = saved ? '★ SALVO NO CELULAR' : '☆ REMOVIDO DOS SALVOS'
    await this.showActions('article')
    this.scheduleNoticeClear()
  }

  private async manualRefresh(): Promise<void> {
    const wasArticle = this.previousMode === 'article' && this.current
    this.notice = '↻ ATUALIZANDO…'
    if (this.mode === 'home') await this.upgradeText(2, 'topic', this.notice)
    try {
      await this.deps.refresh()
      this.notice = 'OK · ATUALIZADO AGORA'
    } catch {
      this.notice = '! SEM CONEXÃO — TENTE DE NOVO'
    }
    this.feed = this.deps.getFeed()
    this.saved = this.deps.getSaved()
    if (wasArticle && this.current) await this.renderArticle()
    else await this.renderHome()
    this.scheduleNoticeClear()
  }

  private scheduleNoticeClear() {
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => {
      this.notice = ''
      if (this.mode === 'home') void this.renderHome()
    }, 4500)
  }

  private async renderSources(): Promise<void> {
    if (!this.ready) return
    this.mode = 'sources'
    const list = this.topSources()
    const items = ['●  Todas as fontes', ...list.map((source) => `${this.filter === source.id ? '●' : '○'}  ${source.name} · ${source.count}`)]
    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 4,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 35,
            paddingLength: 4, containerID: 1, containerName: 'title',
            textColor: BRIGHT, content: 'FONTES', isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 35, width: W, height: 35,
            paddingLength: 4, containerID: 2, containerName: 'subtitle',
            textColor: DIM, content: this.filter ? `filtrando: ${this.sourceFor(this.filter)?.name ?? this.filter}` : 'mostrando todas as fontes', isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 252, width: W, height: 36,
            paddingLength: 4, containerID: 4, containerName: 'hint',
            textColor: DIM, content: '▲▼ rolar  ·  ● filtrar  ·  2× voltar', isEventCapture: 0,
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
        'NADA SALVO AINDA\n\nAbra uma matéria e toque\nem ★ Salvar (no menu).\n\nFica no seu celular, mesmo\noffline.',
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
              textColor: DIM, content: '★ salvos  ·  ● voltar', isEventCapture: 0,
            }),
          ],
        }),
      )
      return
    }
    const items = this.saved.slice(0, 20).map((entry) => {
      const source = this.sourceFor(entry.sourceId)
      return cut(`${source?.short ?? entry.sourceId} · ${entry.title}`, 60)
    })
    await this.rebuild(
      new RebuildPageContainer({
        containerTotalNum: 4,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: W, height: 35,
            paddingLength: 4, containerID: 1, containerName: 'title',
            textColor: BRIGHT, content: `★ SALVOS · ${this.saved.length}`, isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 35, width: W, height: 35,
            paddingLength: 4, containerID: 2, containerName: 'subtitle',
            textColor: DIM, content: 'guardados no seu celular', isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 252, width: W, height: 36,
            paddingLength: 4, containerID: 4, containerName: 'hint',
            textColor: DIM, content: '▲▼ rolar  ·  ● abrir  ·  2× voltar', isEventCapture: 0,
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
    const help = `◈ FAROLIRA — COMO USAR

▲ ▼  navegar e virar página
●    abrir a matéria
●●   2 toques: menu de ações
2× em matéria abre o menu

${'─'.repeat(34)}

No menu: atualizar, filtrar
por fonte, salvar, ajuda e sair.

O app atualiza sozinho a
cada 15 minutos. Gesto manual:
2 toques → menu Atualizar.`
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
            textColor: DIM, content: `${this.page + 1}/${this.pages.length}  ${bar(this.page, this.pages.length)}  ● voltar`, isEventCapture: 0,
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
    }
  }

  async restore(snapshot: GlassesSnapshot): Promise<void> {
    this.filter = snapshot.filter
    this.feed = this.deps.getFeed()
    this.sources = this.deps.getSources()
    this.saved = this.deps.getSaved()
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
