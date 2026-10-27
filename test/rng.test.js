import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomInt } from '../src/rng.js';

const take = (rng, count) => Array.from({ length: count }, () => rng());

test('the same seed always yields the same sequence', () => {
  assert.deepEqual(take(createRng(42), 20), take(createRng(42), 20));
});

test('different seeds yield different sequences', () => {
  assert.notDeepEqual(take(createRng(1), 20), take(createRng(2), 20));
});

test('values stay in [0, 1)', () => {
  for (const value of take(createRng(7), 10_000)) {
    assert.ok(value >= 0 && value < 1, `out of range: ${value}`);
  }
});

test('randomInt covers every integer below the bound and nothing else', () => {
  const rng = createRng(3);
  const seen = new Set();
  for (let i = 0; i < 2_000; i++) {
    const value = randomInt(rng, 7);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 7, `out of range: ${value}`);
    seen.add(value);
  }
  assert.equal(seen.size, 7);
});
