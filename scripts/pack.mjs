import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditBundleUrls, describeUnexpected } from './bundle-urls.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const manifest = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (manifest.version !== pkg.version)
  throw new Error('As versões em app.json e package.json precisam coincidir.');
const network = manifest.permissions?.find((item) => item.name === 'network');
const whitelist = network?.whitelist ?? [];
if (!whitelist.length) throw new Error('app.json precisa da whitelist de rede.');

/**
 * O build copia `public/data` para `dist/data`, mas o app busca as manchetes no endpoint remoto
 * (whitelisted). O snapshot local é só para desenvolvimento e fallback; dentro do `.ehpk` ele
 * levaria milhares de URLs de veículos e anúncios para a revisão do Even Hub.
 */
rmSync(join(root, 'dist', 'data'), { recursive: true, force: true });
rmSync(join(root, 'dist', '.DS_Store'), { force: true });

const distAudit = auditBundleUrls(join(root, 'dist'), whitelist);
if (distAudit.unexpected.length) {
  console.error(
    'O pacote cita URLs fora da whitelist de rede:\n' +
      describeUnexpected(distAudit.unexpected) +
      '\nInclua a origem em app.json (se o app a acessa) ou remova a referência.',
  );
  process.exit(1);
}
console.log(
  `URLs do build conferidas: ${distAudit.literals.length} namespace(s) de biblioteca; ` +
    `${whitelist.length} origem(ns) permitida(s).`,
);
if (checkOnly) {
  console.log('Checagem concluída; pacote não gerado.');
  process.exit(0);
}

const output = join(root, `alemdospontos-${manifest.version}.ehpk`);
const cli = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'evenhub.cmd' : 'evenhub');
if (!existsSync(cli)) throw new Error('evenhub não encontrado em node_modules/.bin.');
const packed = spawnSync(
  cli,
  [
    'pack',
    join(root, 'app.json'),
    join(root, 'dist'),
    '-o',
    output,
    '--sdk-ver',
    manifest.min_sdk_version,
  ],
  { cwd: root, stdio: 'inherit' },
);
if (packed.status !== 0) process.exit(packed.status ?? 1);
if (!existsSync(output) || statSync(output).size < 1)
  throw new Error('A CLI não gerou um pacote válido.');

// O .ehpk é um contêiner próprio do Even Hub, sem listagem simples; a conferência de URLs é
// feita no `dist`, que é exatamente o que a CLI empacota além do manifesto validado.
console.log(`Pacote criado: ${output} (${statSync(output).size} bytes).`);
console.log('URLs conferidas no dist; envie com evenhub upload.');
