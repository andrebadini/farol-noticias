import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { rewriteModule } from './bundle-hygiene.mjs';
import { auditBundleUrls } from './bundle-urls.mjs';

test('tira o link react.dev das mensagens de erro do React DOM', () => {
  const file = fileURLToPath(
    new URL('../node_modules/react-dom/cjs/react-dom-client.production.js', import.meta.url),
  );
  const code = readFileSync(file, 'utf8');
  const next = rewriteModule(file, code);
  assert.ok(next);
  assert.ok(!next.includes('react.dev'));
  assert.ok(next.includes('Minified React error #'));
});

test('não mexe em módulos que não são de biblioteca tratada', () => {
  assert.equal(rewriteModule('/tmp/src/App.tsx', 'export const a = 1;'), null);
});

test('aponta URL fora da whitelist e aceita a origem permitida e o namespace W3C', () => {
  const dir = mkdtempSync(join(tmpdir(), 'alemdospontos-urls-'));
  try {
    writeFileSync(
      join(dir, 'index.js'),
      'const a="https://react.dev/errors/";' +
        'const b="https://andrebadini.github.io/farol-noticias/data";' +
        'const c="http://www.w3.org/2000/svg";',
    );
    const audit = auditBundleUrls(dir, ['https://andrebadini.github.io']);
    assert.deepEqual(audit.unexpected, ['https://react.dev/errors/']);
    assert.equal(audit.literals.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
