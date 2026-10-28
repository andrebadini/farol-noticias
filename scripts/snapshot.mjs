#!/usr/bin/env node
/**
 * Gera um snapshot local em public/data para o app funcionar offline e durante
 * o desenvolvimento (o endpoint remoto no GitHub Pages continua sendo o padrão).
 */
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const tmp = join(root, '.cache', 'snapshot')
await rm(tmp, { recursive: true, force: true })
execFileSync(process.execPath, [join(root, 'aggregator/index.mjs'), '--out', tmp], { stdio: 'inherit' })
await rm(join(root, 'public', 'data'), { recursive: true, force: true })
await mkdir(join(root, 'public'), { recursive: true })
await cp(join(tmp, 'data'), join(root, 'public', 'data'), { recursive: true })
const latest = JSON.parse(await readFile(join(root, 'public', 'data', 'latest.json'), 'utf8'))
await writeFile(
  join(root, 'public', 'data', 'snapshot.json'),
  JSON.stringify({ generatedAt: latest.generatedAt, total: latest.total }, null, 2),
)
console.log(`snapshot local: ${latest.total} matérias em public/data`)
