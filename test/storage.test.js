import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, save } from '../src/storage.js';

/** In-memory stand-in for localStorage. */
function memoryStore() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

/** A storage that refuses every access, like a browser with site data blocked. */
const blockedStore = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('values round-trip as JSON under a game-specific prefix', () => {
  const store = memoryStore();
  assert.equal(save('settings', { mode: 'pvp', level: 'hard' }, store), true);
  assert.deepEqual([...store.items.keys()], ['four-in-a-row:settings']);
  assert.deepEqual(load('settings', null, store), { mode: 'pvp', level: 'hard' });
  save('lang', 'tr', store);
  assert.equal(load('lang', 'en', store), 'tr');
});

test('a missing value returns the fallback', () => {
  assert.equal(load('lang', 'en', memoryStore()), 'en');
});

test('a corrupted value returns the fallback', () => {
  const store = memoryStore();
  store.setItem('four-in-a-row:settings', '{not json');
  assert.equal(load('settings', 'fallback', store), 'fallback');
});

test('blocked storage never throws', () => {
  assert.equal(load('lang', 'en', blockedStore), 'en');
  assert.equal(save('lang', 'tr', blockedStore), false);
});
