import assert from 'node:assert/strict';
import test from 'node:test';
import { HOME_ROWS, clampHomeIndex, pageStartOf, slotItem } from '../src/lib/home-window.ts';

test('clamp do cursor vai de -1 (menu do topo) até o tamanho do feed (linha Menu)', () => {
  assert.equal(clampHomeIndex(-5, 10), -1);
  assert.equal(clampHomeIndex(-1, 10), -1);
  assert.equal(clampHomeIndex(0, 10), 0);
  assert.equal(clampHomeIndex(10, 10), 10);
  assert.equal(clampHomeIndex(99, 10), 10);
  assert.equal(clampHomeIndex(3, 0), 0);
  assert.equal(clampHomeIndex(Number.NaN, 10), 0);
});

test('a página é um bloco de 3 e o menu do topo fica na página 0', () => {
  assert.equal(HOME_ROWS, 3);
  assert.equal(pageStartOf(-1), 0);
  assert.equal(pageStartOf(0), 0);
  assert.equal(pageStartOf(2), 0);
  assert.equal(pageStartOf(3), 3);
  assert.equal(pageStartOf(5), 3);
  assert.equal(pageStartOf(545), 543);
});

test('slots mostram notícia, a linha Menu logo após a última e depois vazio', () => {
  assert.deepEqual(slotItem(0, 1, 10), { kind: 'article', index: 1 });
  assert.deepEqual(slotItem(9, 0, 10), { kind: 'article', index: 9 });
  assert.deepEqual(slotItem(9, 1, 10), { kind: 'menu' });
  assert.deepEqual(slotItem(9, 2, 10), { kind: 'empty' });
});

test('menu final fica alcançável em feeds de qualquer tamanho', () => {
  for (const length of [0, 1, 2, 3, 4, 545]) {
    const index = clampHomeIndex(length + 50, length);
    assert.equal(index, length);
    const start = pageStartOf(index);
    const kinds = [0, 1, 2].map((slot) => slotItem(start, slot, length).kind);
    assert.ok(kinds.includes('menu'), `length ${length}`);
  }
});

test('feed vazio mostra só a linha Menu', () => {
  assert.deepEqual(slotItem(0, 0, 0), { kind: 'menu' });
  assert.deepEqual(slotItem(0, 1, 0), { kind: 'empty' });
});
