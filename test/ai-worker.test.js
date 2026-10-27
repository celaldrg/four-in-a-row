import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, PLAYER_ONE, PLAYER_TWO, createBoard, dropDisc } from '../src/board.js';

// Stand-in for the worker's global scope: collects posted replies, delivers requests.
const listeners = [];
const replies = [];
globalThis.self = {
  addEventListener(type, listener) {
    if (type === 'message') listeners.push(listener);
  },
  postMessage(message) {
    replies.push(message);
  },
};
await import('../src/ai-worker.js');

function send(data) {
  for (const listener of listeners) listener({ data });
}

function boardFrom(columns) {
  let board = createBoard();
  columns.forEach((col, index) => {
    board = dropDisc(board, col, index % 2 === 0 ? PLAYER_ONE : PLAYER_TWO).board;
  });
  return board;
}

test('the worker answers every request with its id and a legal column', () => {
  send({ type: 'init', seed: 7 });
  send({ type: 'move', id: 1, board: createBoard(), player: PLAYER_ONE, level: 'easy' });
  send({ type: 'move', id: 2, board: boardFrom([3]), player: PLAYER_TWO, level: 'medium' });
  assert.deepEqual(
    replies.map((reply) => reply.id),
    [1, 2],
  );
  for (const reply of replies) {
    assert.ok(Number.isInteger(reply.column) && reply.column >= 0 && reply.column < COLS, JSON.stringify(reply));
    for (const field of ['score', 'depth', 'nodes']) assert.equal(typeof reply[field], 'number', field);
  }
});

test('the worker blocks a line of three', () => {
  replies.length = 0;
  // Player one has three in the bottom row (columns 0-2); player two must take column 3.
  send({ type: 'move', id: 3, board: boardFrom([0, 6, 1, 6, 2]), player: PLAYER_TWO, level: 'medium' });
  assert.deepEqual(
    replies.map(({ id, column }) => ({ id, column })),
    [{ id: 3, column: 3 }],
  );
});
