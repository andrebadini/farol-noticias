import assert from 'node:assert/strict';
import test from 'node:test';
import { HOME_NEXT, clampHomeIndex, itemAt, nextItems, progressBar, progressOf } from '../src/lib/home-window.ts';

test('clamp do cursor vai de -1 (Menu do topo) até o tamanho do feed (Menu do fim)', () => {
  assert.equal(clampHomeIndex(-5, 10), -1);
  assert.equal(clampHomeIndex(-1, 10), -1);
  assert.equal(clampHomeIndex(0, 10), 0);
  assert.equal(clampHomeIndex(10, 10), 10);
  assert.equal(clampHomeIndex(99, 10), 10);
  assert.equal(clampHomeIndex(3, 0), 0);
  assert.equal(clampHomeIndex(Number.NaN, 10), 0);
});

test('o foco é notícia ou Menu (topo e fim)', () => {
  assert.deepEqual(itemAt(-1, 10), { kind: 'menu' });
  assert.deepEqual(itemAt(0, 10), { kind: 'article', index: 0 });
  assert.deepEqual(itemAt(9, 10), { kind: 'article', index: 9 });
  assert.deepEqual(itemAt(10, 10), { kind: 'menu' });
  assert.deepEqual(itemAt(0, 0), { kind: 'menu' });
});

test('"A seguir" mostra as próximas, depois a linha Menu e depois vazio', () => {
  assert.equal(HOME_NEXT, 2);
  assert.deepEqual(nextItems(0, 10), [{ kind: 'article', index: 1 }, { kind: 'article', index: 2 }]);
  assert.deepEqual(nextItems(-1, 10), [{ kind: 'article', index: 0 }, { kind: 'article', index: 1 }]);
  assert.deepEqual(nextItems(8, 10), [{ kind: 'article', index: 9 }, { kind: 'menu' }]);
  assert.deepEqual(nextItems(9, 10), [{ kind: 'menu' }, { kind: 'empty' }]);
  assert.deepEqual(nextItems(10, 10), [{ kind: 'empty' }, { kind: 'empty' }]);
});

test('Menu final fica alcançável em feeds de qualquer tamanho', () => {
  for (const length of [0, 1, 2, 3, 4, 545]) {
    const index = clampHomeIndex(length + 50, length);
    assert.equal(index, length);
    assert.equal(itemAt(index, length).kind, 'menu');
  }
});

test('progresso do rodapé: Menu de cima é 0 e o de baixo é o total', () => {
  assert.deepEqual(progressOf(-1, 545), { position: 0, total: 545 });
  assert.deepEqual(progressOf(4, 545), { position: 5, total: 545 });
  assert.deepEqual(progressOf(545, 545), { position: 545, total: 545 });
  assert.deepEqual(progressOf(0, 0), { position: 0, total: 0 });
});

test('barra de progresso em texto', () => {
  assert.equal(progressBar(0, 545), '────────');
  assert.equal(progressBar(1, 545), '━───────');
  assert.equal(progressBar(272, 545), '━━━━────');
  assert.equal(progressBar(545, 545), '━━━━━━━━');
  assert.equal(progressBar(3, 0), '────────');
});
