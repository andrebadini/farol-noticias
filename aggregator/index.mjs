#!/usr/bin/env node
/**
 * Farolira — agregador.
 *
 * Lê os feeds RSS/Atom das fontes brasileiras, normaliza, deduplica, classifica,
 * extrai o texto dos artigos (quando necessário) e grava um snapshot estático:
 *
 *   dist/data/latest.json      → manchetes + metadados (leve, polling frequente)
 *   dist/data/a/<id>.json      → texto completo de cada matéria (sob demanda)
 *
 * O snapshot é publicado no GitHub Pages pelo workflow a cada 15 minutos.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import { convert as htmlToText } from 'html-to-text'
import { extract as extractArticle } from '@extractus/article-extractor'
import { CATEGORIES, KEYWORDS, SOURCES } from './sources.mjs'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const OUT_DIR = resolve(ROOT, argValue('--out', 'dist'))
const DATA_DIR = join(OUT_DIR, 'data')
const ARTICLE_DIR = join(DATA_DIR, 'a')
const CACHE_DIR = resolve(ROOT, '.cache')
const ARCHIVE_FILE = join(CACHE_DIR, 'news-archive.json')
const NOW = Date.now()
const MAX_AGE_H = 96
const MAX_ARTICLES = 700
const PER_SOURCE_CAP = 70
const EXTRACT_CAP = Number(argValue('--extract-cap', '300'))
const EXTRACT_PER_SOURCE = 30
const EXTRACT_AGE_H = 30
const EXTRACT_CONCURRENCY = 8
const REQUEST_TIMEOUT_MS = 22_000
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const log = (...a) => console.log(`[farol ${new Date().toISOString().slice(11, 19)}]`, ...a)
const hashId = (s) => createHash('sha1').update(s).digest('hex').slice(0, 14)

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', aacute: 'á', eacute: 'é',
  iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', ccedil: 'ç', ecirc: 'ê',
  ocirc: 'ô', acirc: 'â', agrave: 'à', ordf: 'ª', ordm: 'º', deg: '°', middot: '·',
  copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', dollar: '$', times: '×',
}

function decodeEntities(input = '') {
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

function stripAccents(s = '') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const SEARCH_STOP = new Set(
  'para como mais menos muito pouco isso aquilo este esta esse essa aquele aquela entre sobre depois antes quando onde qual quais quem cujo cuja seus suas pelo pela pelos pelas ainda também apenas ainda desde mesmo mesma outro outra outros outras todo toda todos todas fazer feito disse diz ainda hoje ontem agora porque porém contudo entretanto segundo afirma informa aponta revela mostra pode podem deve devem será serão foi foram tem têm havia'.split(' '),
)

function searchKeywords(title = '', body = '') {
  const text = stripAccents(`${title} ${title} ${body}`.toLowerCase())
  const words = text.match(/[a-z0-9]{4,}/g) ?? []
  const counts = new Map()
  for (const word of words) {
    if (SEARCH_STOP.has(word)) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 22)
    .map(([word]) => word)
    .join(' ')
}

function stripSourcePrefix(text = '', short = '') {
  if (!text || !short) return text
  const escaped = short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return String(text).replace(new RegExp(`^${escaped}\\s*[–—-]\\s*`, 'i'), '').trim()
}

function cleanText(input = '') {
  return decodeEntities(String(input))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\u200b]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function html2text(html = '') {
  if (!html) return ''
  let text = ''
  try {
    text = htmlToText(String(html), {
      wordwrap: false,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'figure', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'noscript', format: 'skip' },
        { selector: 'h1', options: { uppercase: false } },
        { selector: 'h2', options: { uppercase: false } },
        { selector: 'h3', options: { uppercase: false } },
      ],
    })
  } catch {
    text = String(html)
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
  }
  text = decodeEntities(text)
  const skip =
    /^(leia (mais|também)|continua (após|depois) a publicidade|publicidade|compartilhe|assine|veja (também|mais)|saiba mais|ouça|siga o|receba (as|os)|apoie|apoie o|reportagem em vídeo|fotos?:|imagem:|crédito:|legenda:|fonte:|tags?:)/i
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 2 && !skip.test(l))
    .filter((l) => !/^(share|tweet|whatsapp|facebook|linkedin)$/i.test(l))
  // Junta linhas curtas que são continuação de parágrafos (quebra de HTML).
  const paragraphs = []
  for (const line of lines) {
    const last = paragraphs[paragraphs.length - 1]
    if (last && last.length < 60 && line.length < 60 && !/[.!?…:”"]$/.test(last)) {
      paragraphs[paragraphs.length - 1] = `${last} ${line}`
    } else {
      paragraphs.push(line)
    }
  }
  return paragraphs
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function summarize(text, max = 240) {
  const flat = cleanText(text).replace(/\s+/g, ' ')
  if (!flat) return ''
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max + 1)
  const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf(' '))
  return `${cut.slice(0, at > max * 0.55 ? at : max).trim()}…`
}

function canonicalUrl(raw = '') {
  let url = String(raw).trim()
  // Folha/UOL usam redirecionadores: .../rss091/*https://destino
  const star = url.indexOf('*http')
  if (star > 0) url = url.slice(star + 1)
  try {
    const u = new URL(url)
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|srsltid|itm_|campaign)/i.test(key)) u.searchParams.delete(key)
    }
    return u.toString()
  } catch {
    return url
  }
}

function titleKey(title) {
  return stripAccents(String(title).toLowerCase())
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 12)
    .join(' ')
}

function cleanTitle(title = '') {
  return cleanText(String(title))
    .replace(/\s+[|–—-]\s+(G1|Valor|InfoMoney|Folha|UOL|Veja|Exame|CNN Brasil|Metrópoles|Poder360|Nexo|Agência Brasil)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function categorize(title, summary, source) {
  const norm = ` ${stripAccents(`${title} ${summary}`.toLowerCase())} `
  let best = { id: 'geral', score: 0 }
  for (const cat of CATEGORIES) {
    if (cat.id === 'geral') continue
    let score = 0
    for (const word of KEYWORDS[cat.id] ?? []) {
      const w = stripAccents(word.toLowerCase())
      if (!w) continue
      const re = new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'g')
      const hits = (norm.match(re) ?? []).length
      if (hits) score += hits * (title.toLowerCase().includes(w) ? 3 : 1)
    }
    if (score > best.score) best = { id: cat.id, score }
  }
  if (best.score === 0) {
    const fallback = {
      valor: 'economia', infomoney: 'economia', exame: 'economia', poder360: 'politica',
      oantagonista: 'politica', crusoe: 'justica', intercept: 'justica', veja: 'politica',
      brasil247: 'politica', forum: 'politica', dcm: 'politica', agenciabrasil: 'geral',
      aosfatos: 'politica', ponte: 'justica', almapreta: 'cidades', metropoles: 'cidades',
      jovempan: 'geral', cnnbrasil: 'geral', g1: 'geral', uol: 'geral', folha: 'geral',
      nexo: 'geral', brasildefato: 'politica', planeta: 'ciencia',
    }
    return fallback[source.id] ?? 'geral'
  }
  return best.id
}

/* ------------------------------------------------------------------ fetch */

function charsetOf(contentType, bytes) {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType ?? '')?.[1]
  if (fromHeader) return normalizeCharset(fromHeader)
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 220))
  const fromXml = /encoding=["']([\w-]+)["']/i.exec(head)?.[1]
  return normalizeCharset(fromXml ?? 'utf-8')
}

function normalizeCharset(charset = 'utf-8') {
  const c = charset.toLowerCase()
  if (c === 'iso-8859-1' || c === 'latin1' || c === 'latin-1') return 'windows-1252'
  if (c === 'utf8') return 'utf-8'
  return c
}

async function fetchText(url, { timeout = REQUEST_TIMEOUT_MS, retries = 1 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': UA,
          accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
          'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(timeout),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      let text
      try {
        text = new TextDecoder(charsetOf(res.headers.get('content-type'), bytes)).decode(bytes)
      } catch {
        text = new TextDecoder('utf-8').decode(bytes)
      }
      return { text, finalUrl: res.url }
    } catch (error) {
      lastError = error
      if (attempt < retries) await sleep(600 + attempt * 900)
    }
  }
  throw lastError
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* --------------------------------------------------------------- parsing */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  allowBooleanAttributes: true,
  parseTagValue: false,
  parseAttributeValue: false,
})

function asArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function textOf(v) {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.map(textOf).join(' ')
  if (typeof v === 'object') {
    if (v['#text']) return textOf(v['#text'])
    if (v.__cdata) return textOf(v.__cdata)
    return ''
  }
  return ''
}

function pickText(obj, keys) {
  for (const key of keys) {
    const v = obj?.[key]
    if (v != null) {
      const t = textOf(v)
      if (t) return t
    }
  }
  return ''
}

function pickLink(item) {
  for (const key of ['link', 'guid', 'id']) {
    const v = item?.[key]
    for (const one of asArray(v)) {
      if (typeof one === 'string' && /^https?:/i.test(one)) return one
      if (one && typeof one === 'object') {
        const href = one['@_href'] || one['@_url']
        if (href && /^https?:/i.test(href)) return href
        const t = textOf(one)
        if (t && /^https?:/i.test(t)) return t
      }
    }
  }
  return ''
}

function parseFeed(xml, source) {
  let doc
  try {
    doc = parser.parse(xml)
  } catch (error) {
    log(`  ! XML inválido em ${source.id}: ${error.message}`)
    return parseFeedWithRegex(xml, source)
  }
  const channel = doc?.rss?.channel ?? doc?.RDF ?? doc?.['rdf:RDF'] ?? doc?.feed ?? doc
  const rawItems = asArray(
    channel?.item ?? channel?.entry ?? doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [],
  )
  const items = []
  for (const item of rawItems) {
    const link = pickLink(item)
    const title = cleanTitle(pickText(item, ['title']))
    if (!link || !title) continue
    const description = pickText(item, ['description', 'summary', 'subtitle'])
    const encoded = pickText(item, ['content:encoded', 'content', 'body'])
    const published = pickText(item, ['pubDate', 'published', 'updated', 'dc:date', 'date'])
    const author = pickText(item, ['author', 'dc:creator', 'creator'])
    let image = ''
    const media = item['media:content'] ?? item['media:thumbnail'] ?? item.enclosure
    for (const one of asArray(media)) {
      if (one && typeof one === 'object' && one['@_url']) {
        image = one['@_url']
        break
      }
    }
    items.push({ link, title, description, encoded, published, author, image })
  }
  return items
}

function parseFeedWithRegex(xml, source) {
  const blocks = [...String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0])
  const items = []
  for (const block of blocks) {
    const link =
      (block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ??
        block.match(/<link>([^<]+)<\/link>/i)?.[1] ??
        '') || ''
    const title = cleanTitle((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''))
    if (!link || !title) continue
    items.push({
      link,
      title,
      description: block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '',
      encoded: block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ?? '',
      published: block.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '',
      author: block.match(/<(dc:creator|author)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '',
      image: '',
    })
  }
  if (!items.length) log(`  ! nenhum item extraído de ${source.id}`)
  return items
}

/* -------------------------------------------------------------- extraction */

const myFetch = (url) =>
  fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'accept-language': 'pt-BR,pt;q=0.9' },
    signal: AbortSignal.timeout(18_000),
  })

let jinaBudget = Number(process.env.JINA_BUDGET ?? '60')
let jinaUsed = 0
let jinaSuccess = 0

/**
 * Converte o markdown devolvido pelo Jina Reader em parágrafos de notícia.
 * O seletor `article` já remove quase todo o menu; o título da matéria é usado
 * para começar no lugar certo e descartar chapéu/breadcrumb.
 */
function markdownToText(markdown = '', title = '') {
  const text = String(markdown)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/^\s*[-*•]\s+/gm, '')

  const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const wanted = stripAccents(String(title).toLowerCase()).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const skip =
    /^(not[ií]cias|celebridades|descri[cç][aã]o de chap[eé]u|deixe seu coment[aá]rio|v[ií]deos?|leia (mais|tamb[eé]m)|veja (tamb[eé]m|mais)|compartilhe|siga|assine|publicidade|continua (após|depois)|menu|home|in[ií]cio|uol|folha|valor|g1|exame|metr[oó]poles|cnn|poder360|estad[aã]o|oglobo)$/i
  const date = /^(\d{2}\/\d{2}\/\d{4})(\s+\d{1,2}h\d{2})?/
  const out = []
  let started = false

  for (const line of lines) {
    const normalized = stripAccents(line.toLowerCase()).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    if (
      !started &&
      wanted &&
      normalized &&
      (normalized === wanted ||
        normalized.includes(wanted.slice(0, Math.min(40, wanted.length))) ||
        wanted.includes(normalized.slice(0, Math.min(40, normalized.length))))
    ) {
      started = true
      continue
    }
    if (!started) {
      if (line.length >= 90 && !/^https?:/i.test(line)) started = true
      else continue
    }
    if (skip.test(line)) continue
    if (date.test(line) && line.length < 90) continue
    if (line.length < 30) continue
    out.push(line)
  }

  if (!out.length) {
    for (const line of lines) {
      if (line.length >= 50 && !skip.test(line) && !/^https?:/i.test(line)) out.push(line)
    }
  }
  return out.join('\n\n')
}

async function extractWithJina(url, title) {
  if (jinaBudget <= 0) return null
  const canonical = canonicalUrl(url)

  const attempt = async (target, selector) => {
    if (jinaBudget <= 0) return null
    jinaBudget--
    jinaUsed++
    for (let retry = 0; retry < 2; retry++) {
      try {
        const headers = { accept: 'text/plain', 'user-agent': UA }
        if (selector) headers['x-target-selector'] = selector
        const response = await fetch(`https://r.jina.ai/${target}`, {
          headers,
          signal: AbortSignal.timeout(35_000),
        })
        if (response.status === 429) {
          await sleep(4000)
          continue
        }
        if (!response.ok) return null
        const raw = await response.text()
        const marker = 'Markdown Content:'
        const body = raw.includes(marker) ? raw.slice(raw.indexOf(marker) + marker.length) : raw
        const text = cleanArticleText(markdownToText(body, title))
        if (text.length >= 450) {
          jinaSuccess++
          return text
        }
        return null
      } catch {
        return null
      }
    }
    return null
  }

  // 1) página pública com o seletor do corpo do artigo
  let text = await attempt(canonical, 'article')
  // 2) se houver paywall, tenta um snapshot público do Wayback
  if (!text) {
    try {
      const availability = await fetch(
        `https://archive.org/wayback/available?url=${encodeURIComponent(canonical)}`,
        { signal: AbortSignal.timeout(12_000) },
      )
      const data = await availability.json()
      const snapshot = data?.archived_snapshots?.closest?.url
      if (snapshot && jinaBudget > 0) text = await attempt(snapshot, 'article')
    } catch {
      /* sem snapshot */
    }
  }
  // 3) último recurso: página inteira (o parser acha o título e o corpo)
  if (!text) text = await attempt(canonical, '')
  return text
}

async function extractFullText(url, title = '') {
  let direct = null
  try {
    const article = await extractArticle(url, { contentLengthThreshold: 250 }, myFetch)
    if (article) {
      const content = cleanArticleText(html2text(article.content ?? ''))
      if (content.length >= 450) {
        direct = {
          title: article.title ? cleanTitle(article.title) : '',
          content,
          author: article.author ?? '',
          url: article.url ?? url,
        }
      }
    }
  } catch {
    /* tenta o Jina */
  }

  const paywall = /(assine|exclusivo para assinantes|continue lendo|conteúdo exclusivo|já é assinante|para continuar lendo)/i
  if (direct && direct.content.length >= 700 && !paywall.test(direct.content.slice(0, 2000))) return direct

  const jina = await extractWithJina(url, title)
  if (jina && (!direct || jina.length > direct.content.length)) {
    return {
      title: '',
      content: jina,
      author: '',
      url,
    }
  }
  if (direct && paywall.test(direct.content.slice(0, 2000))) return null
  return direct
}

/**
 * Remove o "molho" que os portais injetam no meio do texto (cotações, banners,
 * chamadas de assinatura) e corta em fronteira de parágrafo.
 */
function cleanArticleText(text, max = 6500) {
  const seen = new Set()
  text = String(text).replace(/continua (após|depois) a publicidade[^\n]*/gi, '\n\n')
  const drop =
    /^(moedas|dólar (comercial|turismo)|euro (comercial|turismo)|ibovespa|bolsa de valores|oferecido por|publicidade|continua após|compartilhe|assine|já é assinante|leia também|leia mais|veja também|saiba mais|receba (as|os)|siga (o|a)|apoie|tempo de leitura|por que isso importa|em resumo|ouça (o|a)|crédito|legenda|foto:|imagem:)/i
  const parts = String(text)
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 2)
    .filter((p) => !/^[-–—_*·\s]+$/.test(p))
    .filter((p) => !drop.test(p))
    .filter((p) => !/^(resumo|resumo\s*[+＋]|em resumo|o que aconteceu|o que você precisa saber|entenda( o caso)?|contexto|saiba mais|veja também|leia também)$/i.test(p))
    .filter((p) => !(p.length < 170 && /^(moedas|dólar|euro|ibovespa)/i.test(p)))
    .filter((p) => {
      const key = stripAccents(p.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').slice(0, 70)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  let out = parts.join('\n\n')
  if (!out.includes('\n\n') && out.length > 700) {
    // Alguns extratotes devolvem um único paredão de texto. Quebra em blocos
    // de ~480 caracteres respeitando fim de frase, para leitura no celular e
    // nos óculos.
    const sentences = out.match(/[^.!?…]+[.!?…]+["”’]?/g) ?? [out]
    const blocks = []
    let block = ''
    for (const sentence of sentences) {
      if (block && block.length + sentence.length > 480) {
        blocks.push(block.trim())
        block = ''
      }
      block += sentence
    }
    if (block.trim()) blocks.push(block.trim())
    if (blocks.length > 1) out = blocks.join('\n\n')
  }
  if (out.length > max) {
    out = out.slice(0, max)
    const cut = out.lastIndexOf('\n\n')
    if (cut > max * 0.6) out = out.slice(0, cut)
    out = out.trim()
  }
  return out
}

/* ------------------------------------------------------------------- main */

function loadArchive(raw) {
  try {
    const data = JSON.parse(raw)
    if (data && typeof data === 'object' && data.articles) return data
  } catch {
    /* cache corrompido: recomeça */
  }
  return { version: 3, updatedAt: new Date(0).toISOString(), articles: {} }
}

function articleFromItem(source, item, category) {
  const canonical = canonicalUrl(item.link)
  const encodedText = item.encoded ? cleanArticleText(html2text(item.encoded)) : ''
  const descriptionText = html2text(item.description)
  const content = encodedText.length >= 650 ? encodedText : ''
  const summary = summarize(encodedText || descriptionText || item.title)
  const publishedAt = Number.isFinite(Date.parse(item.published)) ? new Date(item.published).toISOString() : new Date().toISOString()
  return {
    id: hashId(canonical),
    sourceId: source.id,
    title: item.title,
    url: item.link,
    canonical,
    publishedAt,
    category: category ?? categorize(item.title, summary, source),
    summary,
    content,
    full: Boolean(content),
    author: cleanText(item.author).slice(0, 120),
    image: item.image?.startsWith('http') ? item.image : '',
    firstSeenAt: new Date().toISOString(),
    contentAt: content ? new Date().toISOString() : null,
    extractFailedAt: null,
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await fn(items[current], current).catch((error) => ({ error }))
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  log(`agregando ${SOURCES.length} fontes → ${OUT_DIR}`)
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(ARTICLE_DIR, { recursive: true })
  await mkdir(CACHE_DIR, { recursive: true })

  let archive = { version: 3, updatedAt: new Date(0).toISOString(), articles: {} }
  try {
    archive = loadArchive(await readFile(ARCHIVE_FILE, 'utf8'))
  } catch {
    log('sem cache anterior — primeiro run')
  }

  const knownByCanonical = new Map()
  const knownByHash = new Map()
  for (const article of Object.values(archive.articles)) {
    knownByHash.set(article.id, article)
    if (article.canonical) knownByCanonical.set(article.canonical, article)
  }

  const health = []
  const collected = []

  const feedResults = await mapLimit(SOURCES, 6, async (source) => {
    try {
      const { text } = await fetchText(source.feed)
      const items = parseFeed(text, source)
      if (!items.length) throw new Error('feed vazio')
      return { source, items, ok: true }
    } catch (error) {
      log(`  ✕ ${source.name}: ${String(error.message).slice(0, 90)}`)
      return { source, items: [], ok: false, error: String(error.message).slice(0, 140) }
    }
  })

  for (const result of feedResults) {
    const { source } = result
    const seenTitles = new Set()
    let fresh = 0
    let cached = 0

    for (const item of result.items) {
      const canonical = canonicalUrl(item.link)
      if (!canonical) continue
      const tKey = titleKey(item.title)
      if (tKey && seenTitles.has(tKey)) continue
      seenTitles.add(tKey)

      const existing = knownByCanonical.get(canonical) ?? knownByHash.get(hashId(canonical))
      if (existing) {
        existing.canonical = canonical
        existing.summary = existing.summary || summarize(item.description || item.title)
        existing.image = existing.image || (item.image?.startsWith('http') ? item.image : '')
        collected.push(existing)
        cached++
        continue
      }
      const article = articleFromItem(source, item)
      knownByHash.set(article.id, article)
      knownByCanonical.set(canonical, article)
      archive.articles[article.id] = article
      collected.push(article)
      fresh++
    }

    if (!result.ok) {
      // Fonte fora do ar: mantém o que já temos em cache dentro da janela.
      for (const article of Object.values(archive.articles)) {
        if (article.sourceId === source.id) {
          collected.push(article)
          cached++
        }
      }
    }
    health.push({ id: source.id, ok: result.ok, error: result.error ?? null, fresh, cached, items: result.items.length })
    log(`  ${result.ok ? '✓' : '!'} ${source.name.padEnd(22)} itens=${String(result.items.length).padStart(3)} novos=${String(fresh).padStart(2)} cache=${cached}`)
  }

  // Deduplica por id e mantém a janela / limites.
  const byId = new Map()
  for (const article of collected) byId.set(article.id, article)
  let list = [...byId.values()].filter((a) => {
    const age = (NOW - Date.parse(a.publishedAt)) / 3_600_000
    return age >= -6 && age <= MAX_AGE_H
  })
  list.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))

  const perSource = new Map()
  const kept = []
  for (const article of list) {
    const count = perSource.get(article.sourceId) ?? 0
    if (count >= PER_SOURCE_CAP) continue
    perSource.set(article.sourceId, count + 1)
    kept.push(article)
    if (kept.length >= MAX_ARTICLES) break
  }
  list = kept

  // Texto completo: prioriza as mais novas que ainda não têm conteúdo.
  const needsContent = list
    .filter((a) => !a.content || a.content.length < 500)
    .filter((a) => {
      const ageH = (NOW - Date.parse(a.publishedAt)) / 3_600_000
      return ageH <= EXTRACT_AGE_H
    })
    .filter((a) => {
      if (!a.extractFailedAt) return true
      return Date.now() - Date.parse(a.extractFailedAt) > 2 * 3_600_000
    })
    .slice(0, EXTRACT_CAP)

  const perSourceExtract = new Map()
  const queue = needsContent.filter((a) => {
    const n = perSourceExtract.get(a.sourceId) ?? 0
    if (n >= EXTRACT_PER_SOURCE) return false
    perSourceExtract.set(a.sourceId, n + 1)
    return true
  })

  log(`extraindo texto completo de ${queue.length} matérias (${list.length} no snapshot)…`)
  let extracted = 0
  let failed = 0
  await mapLimit(queue, EXTRACT_CONCURRENCY, async (article) => {
    try {
      const full = await extractFullText(article.url, article.title)
      if (full?.content) {
        article.content = full.content
        article.full = true
        article.contentAt = new Date().toISOString()
        article.extractFailedAt = null
        if (!article.summary || article.summary.length < 60) article.summary = summarize(full.content)
        if (!article.author && full.author) article.author = cleanText(full.author).slice(0, 120)
        extracted++
      } else {
        article.extractFailedAt = new Date().toISOString()
        failed++
      }
    } catch {
      article.extractFailedAt = new Date().toISOString()
      failed++
    }
  })
  log(`  texto completo: ${extracted} ok, ${failed} sem extração · Jina: ${jinaSuccess}/${jinaUsed} chamadas`)

  // Atualiza o conteúdo do archive com o que foi extraído.
  for (const article of list) archive.articles[article.id] = article
  // Poda do archive.
  for (const [id, article] of Object.entries(archive.articles)) {
    const age = (NOW - Date.parse(article.publishedAt)) / 3_600_000
    if (age > MAX_AGE_H + 24 || !Number.isFinite(age)) delete archive.articles[id]
  }
  archive.updatedAt = new Date().toISOString()

  // ---- saída -------------------------------------------------------------
  const sourcesOut = SOURCES.map((source) => {
    const items = list.filter((a) => a.sourceId === source.id)
    const h = health.find((x) => x.id === source.id)
    return {
      id: source.id,
      name: source.name,
      short: source.short,
      monogram: source.monogram ?? source.short.slice(0, 3),
      domain: source.domain,
      color: source.color,
      kind: source.kind,
      tag: source.tag,
      count: items.length,
      ok: Boolean(h?.ok),
      lastTitle: items[0]?.title ?? null,
      lastAt: items[0]?.publishedAt ?? null,
    }
  })
  const categoriesOut = CATEGORIES.map((cat) => ({
    ...cat,
    count: list.filter((a) => a.category === cat.id).length,
  })).filter((c) => c.count > 0)

  const latest = {
    generatedAt: new Date().toISOString(),
    version: 3,
    locale: 'pt-BR',
    total: list.length,
    sources: sourcesOut.filter((s) => s.count > 0),
    categories: categoriesOut,
    health: health.map((h) => ({ id: h.id, ok: h.ok, items: h.items, fresh: h.fresh })),
    articles: list.map((a) => ({
      id: a.id,
      title: a.title,
      sourceId: a.sourceId,
      url: a.url,
      publishedAt: a.publishedAt,
      category: a.category,
      summary: stripSourcePrefix(a.summary, SOURCES.find((source) => source.id === a.sourceId)?.short ?? ''),
      keywords: searchKeywords(a.title, (a.content || a.summary || '').slice(0, 5000)),
      full: Boolean(a.content && a.content.length > 450),
      readingMin: Math.max(1, Math.round((a.content || a.summary).split(/\s+/).length / 200)),
      author: a.author || '',
      image: a.image || '',
    })),
  }

  await writeFile(join(DATA_DIR, 'latest.json'), JSON.stringify(latest))

  let bytes = 0
  for (const article of list) {
    const payload = {
      id: article.id,
      title: article.title,
      sourceId: article.sourceId,
      url: article.url,
      publishedAt: article.publishedAt,
      category: article.category,
      summary: stripSourcePrefix(article.summary, SOURCES.find((source) => source.id === article.sourceId)?.short ?? ''),
      author: article.author || '',
      full: Boolean(article.content && article.content.length > 450),
      content: article.content
        ? stripSourcePrefix(
            cleanArticleText(article.content),
            SOURCES.find((source) => source.id === article.sourceId)?.short ?? '',
          )
        : '',
    }
    const json = JSON.stringify(payload)
    bytes += json.length
    await writeFile(join(ARTICLE_DIR, `${article.id}.json`), json)
  }

  await writeFile(ARCHIVE_FILE, JSON.stringify(archive))

  // Página de pouso do Pages (não é o plugin, só um cartão de status).
  const okCount = sourcesOut.filter((s) => s.ok).length
  await writeFile(
    join(OUT_DIR, 'index.html'),
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Farolira · dados</title><style>
:root{color-scheme:dark}body{margin:0;background:#0c0c0b;color:#f2efe8;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;min-height:100vh;place-items:center}
main{max-width:620px;padding:40px} .k{display:inline-block;padding:4px 10px;border:1px solid #fef991;color:#fef991;border-radius:999px;font-size:12px;letter-spacing:.12em;text-transform:uppercase}
h1{font-size:54px;line-height:.95;letter-spacing:-.04em;margin:24px 0 8px;font-weight:700} p{color:#b7b3a8}
code{background:#1a1a18;padding:3px 6px;border-radius:6px;color:#fef991} a{color:#fef991}
</style></head><body><main><span class="k">farolira · dados abertos</span><h1>Notícias do Brasil,<br>num olhar.</h1>
<p>Snapshot estático que alimenta o plugin <strong>Farolira</strong> nos óculos Even Realities G2.</p>
<p><strong>${list.length}</strong> matérias · <strong>${okCount}/${SOURCES.length}</strong> fontes no ar · atualizado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília).</p>
<p><a href="./data/latest.json">data/latest.json</a> · <a href="./privacy.html">privacidade</a> · <a href="https://github.com/andrebadini/farol-noticias">código</a></p>
<p style="font-size:12px;color:#6d6a62">Atualização automática a cada 15 minutos via GitHub Actions. Conteúdo de terceiros; os direitos são dos veículos originais.</p></main></body></html>`,
  )

  await writeFile(
    join(OUT_DIR, 'privacy.html'),
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Farolira · Privacidade</title><style>
:root{color-scheme:dark}body{margin:0;background:#0c0c0b;color:#f2efe8;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:700px;margin:0 auto;padding:48px 24px 72px} .k{display:inline-block;padding:4px 10px;border:1px solid #fef991;color:#fef991;border-radius:999px;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
h1{font-size:46px;line-height:1;letter-spacing:-.03em;margin:20px 0 8px} h2{font-size:20px;margin:34px 0 8px;letter-spacing:-.01em} p,li{color:#b9b4a7}
a{color:#fef991} small{color:#7d786c} strong{color:#f2efe8}
</style></head><body><main>
<span class="k">farol · privacidade</span>
<h1>Privacidade,<br>sem letra miúda.</h1>
<p>Farolira é um leitor de notícias para os óculos Even Realities G2. Ele não tem login, não pede dados pessoais e não usa rastreadores.</p>
<h2>O que o app faz</h2>
<p>O app baixa um arquivo público de manchetes e matérias do endereço <a href="https://andrebadini.github.io/farol-noticias/data/latest.json">andrebadini.github.io/farol-noticias</a>, mantido por um robô que lê os feeds RSS públicos dos veículos citados no app. Nenhuma informação sua é enviada nesse pedido.</p>
<h2>O que fica no seu celular</h2>
<p>Favoritos, ajustes, cache da edição e a última matéria aberta ficam no armazenamento local do Even Hub (ou no armazenamento do navegador, em modo de desenvolvimento). Eles não saem do seu aparelho. Ao desinstalar o app, esses dados podem ser removidos pelo sistema.</p>
<h2>Busca por voz</h2>
<p>Quando o WebView do Even Hub oferece reconhecimento de voz, o áudio é processado pelo serviço do sistema/navegador, conforme a política da plataforma. O app não grava nem envia áudio para servidores próprios. Se o recurso não estiver disponível, use o ditado do teclado do celular.</p>
<h2>Links para os veículos</h2>
<p>Ao abrir a versão original, você sai do Farol e passa a navegar no site do veículo, sujeito à política de privacidade dele. Farolira não controla esses sites.</p>
<h2>Conteúdo de terceiros</h2>
<p>As notícias pertencem aos veículos que as publicaram. O Farol apenas organiza os feeds públicos e sempre indica a fonte e o link original. Para pedir a remoção de um conteúdo do agregador, abra uma issue no repositório do projeto.</p>
<h2>Contato</h2>
<p>Dúvidas, sugestões ou remoção de conteúdo: <a href="https://github.com/andrebadini/farol-noticias/issues">github.com/andrebadini/farol-noticias/issues</a>.</p>
<p><small>Última atualização: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · Farolira 1.0.0</small></p>
</main></body></html>`,
  )

  log(`snapshot: ${list.length} matérias · latest=${(JSON.stringify(latest).length / 1024).toFixed(0)}KB · artigos=${(bytes / 1024).toFixed(0)}KB · fontes ok=${okCount}/${SOURCES.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
