import assert from 'node:assert/strict';
import test from 'node:test';
import { doubleTapAction } from '../src/lib/gestures.ts';

test('duplo toque na página raiz abre o diálogo de saída (shutDownPageContainer(1))', () => {
  assert.equal(doubleTapAction('home'), 'exit-dialog');
});

test('duplo toque fora da raiz continua navegando', () => {
  assert.equal(doubleTapAction('article'), 'actions');
  for (const screen of ['actions', 'sources', 'saved', 'help']) {
    assert.equal(doubleTapAction(screen), 'home');
  }
});
