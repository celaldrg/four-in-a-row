import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Position, CENTRE_FIRST } from '../src/position.js';
import { COLS, EMPTY, PLAYER_ONE, PLAYER_TWO, createBoard, dropDisc, otherPlayer, validColumns } from '../src/board.js';
import { createRng, randomInt } from '../src/rng.js';

function loaded(board, player = PLAYER_ONE) {
  const position = new Position();
  position.load(board, player);
  return position;
}

/** Plays random legal moves from an empty board; returns the boards after each move. */
function randomBoards(seed, count) {
  const rng = createRng(seed);
  const boards = [];
  let board = createBoard();
  for (let i = 0; i < count; i++) {
    const columns = validColumns(board);
    board = dropDisc(board, columns[randomInt(rng, columns.length)], i % 2 === 0 ? PLAYER_ONE : PLAYER_TWO).board;
    boards.push(board);
  }
  return boards;
}

const mirror = (board) => board.map((_, i) => board[i - (i % COLS) + (COLS - 1 - (i % COLS))]);
const swapColours = (board) => board.map((cell) => (cell === EMPTY ? EMPTY : otherPlayer(cell)));

function snapshot(position) {
  return {
    heights: [...position.heights],
    codes: [...position.codes],
    player: position.player,
    moveCount: position.moveCount,
    score: position.score,
    hashLo: position.hashLo,
    hashHi: position.hashHi,
  };
}

test('moves are tried from the centre outwards', () => {
  assert.deepEqual([...CENTRE_FIRST], [3, 2, 4, 1, 5, 0, 6]);
});

test('an empty board evaluates to zero', () => {
  assert.equal(loaded(createBoard()).score, 0);
  assert.equal(loaded(createBoard()).evaluate(), 0);
});

test('a centre disc is worth more than an edge disc', () => {
  const centre = loaded(dropDisc(createBoard(), 3, PLAYER_ONE).board, PLAYER_TWO);
  const edge = loaded(dropDisc(createBoard(), 0, PLAYER_ONE).board, PLAYER_TWO);
  assert.ok(centre.score > edge.score && edge.score > 0);
  assert.equal(centre.evaluate(), -centre.score, 'player two sees the score negated');
});

test('the evaluation is symmetric under mirroring and colour swapping', () => {
  for (const board of randomBoards(11, 30)) {
    const score = loaded(board).score;
    assert.equal(loaded(mirror(board)).score, score);
    assert.equal(loaded(swapColours(board)).score, -score);
  }
});

test('play and undo keep counts, score and hash in step with a fresh load', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = createRng(seed);
    const position = loaded(createBoard());
    const start = snapshot(position);
    const played = [];
    let board = createBoard();
    while (validColumns(board).length > 0) {
      const columns = validColumns(board);
      const col = columns[randomInt(rng, columns.length)];
      board = dropDisc(board, col, position.player).board;
      position.play(col);
      played.push(col);
      assert.deepEqual(snapshot(position), snapshot(loaded(board, position.player)));
    }
    while (played.length > 0) position.undo(played.pop());
    assert.deepEqual(snapshot(position), start);
  }
});

test('the side to move is part of the hash', () => {
  const board = dropDisc(createBoard(), 3, PLAYER_ONE).board;
  assert.notEqual(loaded(board, PLAYER_ONE).hashLo, loaded(board, PLAYER_TWO).hashLo);
});

test('winning and blocking columns are recognised', () => {
  // Player one has three on the bottom row; player two has two discs in column 6.
  let board = createBoard();
  for (const [col, player] of [[0, 1], [6, 2], [1, 1], [6, 2], [2, 1]]) {
    board = dropDisc(board, col, player).board;
  }
  assert.equal(loaded(board, PLAYER_ONE).winningColumn(), 3);
  const defender = loaded(board, PLAYER_TWO);
  assert.equal(defender.winningColumn(), -1);
  const safe = new Int8Array(COLS);
  assert.equal(defender.safeColumns(safe, 0), 1);
  assert.equal(safe[0], 3);
});

test('a move under an opponent threat is not safe', () => {
  // Player two threatens row 1 of column 3, so player one must not fill row 0 there.
  let board = createBoard();
  for (const [col, player] of [[0, 1], [2, 2], [1, 1], [0, 2], [6, 1], [1, 2], [5, 1], [2, 2]]) {
    board = dropDisc(board, col, player).board;
  }
  const position = loaded(board, PLAYER_ONE);
  const safe = new Int8Array(COLS);
  const count = position.safeColumns(safe, 0);
  assert.deepEqual([...safe.subarray(0, count)], [2, 4, 1, 5, 0, 6]);
});
