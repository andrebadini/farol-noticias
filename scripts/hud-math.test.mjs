import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RING_STEPS,
  SPLASH_FRAME_COUNT,
  remainingMinutes,
  ringStep,
  spinnerIndex,
  splashDecision,
  splashIndex,
} from '../src/lib/hud-math.ts';

test('a abertura escolhe o quadro pelo relógio e fica em laço de 12 quadros no máximo', () => {
  assert.equal(splashIndex(0), 0);
  assert.equal(splashIndex(260), 1);
  assert.equal(splashIndex(990), 3);
  assert.equal(splashIndex(1000), 4);
  const seen = new Set();
  for (let ms = 0; ms < 20_000; ms += 7) {
    const index = splashIndex(ms);
    assert.ok(index >= 0 && index < SPLASH_FRAME_COUNT);
    seen.add(index);
  }
  assert.equal(seen.size, SPLASH_FRAME_COUNT);
  // link lento: pular quadros, não acumular — o índice só depende do tempo
  assert.equal(splashIndex(5000), splashIndex(5000 + 1600));
  assert.equal(splashIndex(-10), 0);
});

test('o spinner gira 8 quadros a ~4 por segundo', () => {
  assert.equal(spinnerIndex(0), 0);
  assert.equal(spinnerIndex(260), 1);
  assert.equal(spinnerIndex(2000), 0);
  assert.equal(spinnerIndex(1750), 7);
});

test('o anel quantiza em 16 passos; 16 só quando completo', () => {
  assert.equal(RING_STEPS, 16);
  assert.equal(ringStep(0), 0);
  assert.equal(ringStep(Number.NaN), 0);
  assert.equal(ringStep(0.001), 1);
  assert.equal(ringStep(0.5), 8);
  assert.equal(ringStep(0.99), 15);
  assert.equal(ringStep(1), 16);
  assert.equal(ringStep(3), 16);
});

test('a abertura sai com feed + 1,6 s, ou após 6 s de qualquer jeito', () => {
  assert.equal(splashDecision(500, 100), 'wait');
  assert.equal(splashDecision(1600, 0), 'wait');
  assert.equal(splashDecision(1600, 100), 'leave');
  assert.equal(splashDecision(5999, 0), 'wait');
  assert.equal(splashDecision(6000, 0), 'leave');
});

test('minutos restantes de leitura', () => {
  assert.equal(remainingMinutes(10, 0, 10), 9);
  assert.equal(remainingMinutes(10, 4, 10), 5);
  assert.equal(remainingMinutes(10, 9, 10), 0);
  assert.equal(remainingMinutes(2, 0, 10), 2);
  assert.equal(remainingMinutes(1, 0, 1), 0);
});
