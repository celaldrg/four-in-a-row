import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlKeepsKey, keyAction } from '../src/keyboard.js';

test('digits 1 to 7 drop in that column', () => {
  for (let digit = 1; digit <= 7; digit++) {
    assert.deepEqual(keyAction(String(digit), null), { type: 'drop', col: digit - 1 });
    assert.deepEqual(keyAction(String(digit), 6), { type: 'drop', col: digit - 1 });
  }
});

test('other digits and unknown keys do nothing', () => {
  for (const key of ['0', '8', '9', 'a', 'Tab', 'Escape', 'F1', 'ArrowUp', 'Shift', '']) {
    assert.equal(keyAction(key, 3), null, key);
  }
});

test('the arrows move the cursor and stop at the edges', () => {
  assert.deepEqual(keyAction('ArrowLeft', 3), { type: 'aim', col: 2 });
  assert.deepEqual(keyAction('ArrowRight', 3), { type: 'aim', col: 4 });
  assert.deepEqual(keyAction('ArrowLeft', 0), { type: 'aim', col: 0 });
  assert.deepEqual(keyAction('ArrowRight', 6), { type: 'aim', col: 6 });
});

test('the first arrow press shows the cursor on the centre column', () => {
  assert.deepEqual(keyAction('ArrowLeft', null), { type: 'aim', col: 3 });
  assert.deepEqual(keyAction('ArrowRight', null), { type: 'aim', col: 3 });
});

test('Enter, Space and the down arrow drop at the cursor', () => {
  for (const key of ['Enter', ' ', 'ArrowDown']) {
    assert.deepEqual(keyAction(key, 5), { type: 'drop', col: 5 }, key);
    assert.deepEqual(keyAction(key, null), { type: 'aim', col: 3 }, `${key} without a cursor only shows it`);
  }
});

test('U undoes and N starts a new game in either case', () => {
  assert.deepEqual(keyAction('u', null), { type: 'undo' });
  assert.deepEqual(keyAction('U', 2), { type: 'undo' });
  assert.deepEqual(keyAction('n', null), { type: 'new' });
  assert.deepEqual(keyAction('N', 2), { type: 'new' });
});

test('a focused button keeps Enter and Space but lets the arrows and digits reach the board', () => {
  for (const key of ['Enter', ' ']) assert.equal(controlKeepsKey('button', key), true, key);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowDown', '4', 'u', 'N']) {
    assert.equal(controlKeepsKey('button', key), false, key);
  }
});

test('a focused radio button also keeps the arrows', () => {
  for (const key of ['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    assert.equal(controlKeepsKey('radio', key), true, key);
  }
  for (const key of ['1', '7', 'u', 'n']) assert.equal(controlKeepsKey('radio', key), false, key);
});

test('with the board or nothing focused every key goes to the game', () => {
  for (const key of ['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowDown', '3', 'u']) {
    assert.equal(controlKeepsKey(null, key), false, key);
  }
});
