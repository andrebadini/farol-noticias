import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * URLs que aparecem no pacote só como identificadores de padrões — o app nunca as acessa. São os
 * namespaces de SVG/MathML do React DOM. Qualquer outra URL fora da whitelist faz o empacotamento
 * falhar; `https://react.dev/errors/` do React é removido por `scripts/bundle-hygiene.mjs`.
 */
export const LIBRARY_URL_LITERALS = [
  { pattern: /^http:\/\/www\.w3\.org\//, why: 'namespace XML/SVG/MathML (React DOM)' },
];

const SCANNED = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.css',
  '.json',
  '.svg',
  '.txt',
  '.xml',
  '.map',
]);
const URL_TEXT = /(?:https?|wss?):\/\/[^\s"'`<>()\\]+/g;

/** URLs escritas nos arquivos do pacote (sem repetição), em ordem. */
export function bundleUrls(dir) {
  const found = new Set();
  const walk = (path) => {
    for (const name of readdirSync(path).sort()) {
      const file = join(path, name);
      if (statSync(file).isDirectory()) walk(file);
      else if (SCANNED.has(extname(name).toLowerCase()))
        for (const match of readFileSync(file, 'utf8').matchAll(URL_TEXT))
          found.add(match[0].replace(/[.,;:]+$/, ''));
    }
  };
  walk(dir);
  return [...found];
}

/**
 * Separa as URLs do pacote: as da whitelist (permitidas), os textos conhecidos de bibliotecas
 * (`literals`) e o resto (`unexpected`), que precisa sair do código ou entrar na whitelist.
 */
export function auditBundleUrls(dir, whitelist) {
  const allowed = new Set(whitelist);
  const literals = [];
  const unexpected = [];
  for (const url of bundleUrls(dir)) {
    let origin;
    try {
      origin = new URL(url).origin;
    } catch {
      origin = undefined;
    }
    if (origin && allowed.has(origin)) continue;
    const known = LIBRARY_URL_LITERALS.find((item) => item.pattern.test(url));
    if (known) literals.push({ url, why: known.why });
    else unexpected.push(url);
  }
  return { literals, unexpected };
}

/** Lista legível para a mensagem de erro do empacotamento. */
export function describeUnexpected(urls) {
  return urls.map((url) => `  • ${url}`).join('\n');
}
