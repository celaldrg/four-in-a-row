import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createDemoGame } from '../src/game.js';
import { COLS, ROWS, EMPTY, PLAYER_ONE, PLAYER_TWO, getCell, landingRow, winningCells } from '../src/board.js';

/** 42 moves that fill the board without ever completing a line (player one starts). */
const DRAW_MOVES = [
  0, 1, 1, 1, 1, 1, 2, 4, 3, 6, 2, 6, 0, 2, 6, 1, 2, 5, 6, 2, 0, 0, 2, 0, 5, 4, 4, 3, 5, 3, 3, 4, 5, 6,
  6, 5, 3, 0, 4, 3, 4, 5,
];

/** Empty cells where `player` would complete a line, with whether they can be played now. */
function threats(board, player) {
  const found = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (getCell(board, row, col) !== EMPTY) continue;
      const next = board.slice();
      next[row * COLS + col] = player;
      if (winningCells(next, row, col).length > 0) {
        found.push({ row, col, playable: landingRow(board, col) === row });
      }
    }
  }
  return found;
}

test('a new game is empty with player one to move', () => {
  const state = createGame().getState();
  assert.ok(state.board.every((cell) => cell === EMPTY));
  assert.equal(state.current, PLAYER_ONE);
  assert.equal(state.firstPlayer, PLAYER_ONE);
  assert.equal(state.status, 'playing');
  assert.equal(state.winner, EMPTY);
  assert.deepEqual(state.moves, []);
  assert.deepEqual(state.winCells, []);
});

test('player two can be chosen to start', () => {
  const game = createGame({ firstPlayer: PLAYER_TWO });
  assert.equal(game.getState().current, PLAYER_TWO);
  const result = game.move(3);
  assert.equal(result.move.player, PLAYER_TWO);
  assert.equal(result.state.current, PLAYER_ONE);
});

test('moves alternate between players and are recorded', () => {
  const game = createGame();
  const first = game.move(3);
  assert.deepEqual(first, { ok: true, move: { col: 3, row: 0, player: PLAYER_ONE }, state: game.getState() });
  game.move(3);
  const state = game.getState();
  assert.deepEqual(state.moves, [
    { col: 3, row: 0, player: PLAYER_ONE },
    { col: 3, row: 1, player: PLAYER_TWO },
  ]);
  assert.equal(getCell(state.board, 1, 3), PLAYER_TWO);
  assert.equal(state.current, PLAYER_ONE);
});

test('a full column rejects the move and keeps the turn', () => {
  const game = createGame({ moves: [0, 0, 0, 0, 0, 0] });
  assert.deepEqual(game.move(0), { ok: false, reason: 'column-full' });
  const state = game.getState();
  assert.equal(state.moves.length, 6);
  assert.equal(state.current, PLAYER_ONE);
});

test('columns outside the board are rejected', () => {
  const game = createGame();
  for (const col of [-1, COLS, 1.5, '2', null]) {
    assert.deepEqual(game.move(col), { ok: false, reason: 'invalid-column' }, `column ${col}`);
  }
  assert.equal(game.getState().moves.length, 0);
});

test('four in a row wins and ends the game', () => {
  const game = createGame({ moves: [0, 0, 1, 1, 2, 2] });
  const result = game.move(3);
  assert.equal(result.state.status, 'won');
  assert.equal(result.state.winner, PLAYER_ONE);
  assert.deepEqual(result.state.winCells, [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
  ]);
  assert.deepEqual(game.move(4), { ok: false, reason: 'game-over' });
});

test('player two can win too', () => {
  const game = createGame({ moves: [0, 3, 1, 3, 0, 3, 6, 3] });
  const state = game.getState();
  assert.equal(state.status, 'won');
  assert.equal(state.winner, PLAYER_TWO);
  assert.equal(state.winCells.length, 4);
});

test('a full board without a line is a draw', () => {
  const game = createGame({ moves: DRAW_MOVES.slice(0, -1) });
  assert.equal(game.getState().status, 'playing');
  const result = game.move(DRAW_MOVES[DRAW_MOVES.length - 1]);
  assert.equal(result.state.status, 'draw');
  assert.equal(result.state.winner, EMPTY);
  assert.deepEqual(result.state.winCells, []);
  assert.deepEqual(game.move(0), { ok: false, reason: 'game-over' });
});

test('undo takes back the last move', () => {
  const game = createGame({ moves: [3, 4] });
  assert.deepEqual(game.undo(), { col: 4, row: 0, player: PLAYER_TWO });
  const state = game.getState();
  assert.equal(state.current, PLAYER_TWO);
  assert.equal(getCell(state.board, 0, 4), EMPTY);
  assert.equal(getCell(state.board, 0, 3), PLAYER_ONE);
  assert.equal(state.moves.length, 1);
});

test('undo on an empty game does nothing', () => {
  const game = createGame();
  assert.equal(game.undo(), null);
  assert.equal(game.getState().current, PLAYER_ONE);
});

test('undo after a win resumes the game', () => {
  const game = createGame({ moves: [0, 0, 1, 1, 2, 2, 3] });
  game.undo();
  const state = game.getState();
  assert.equal(state.status, 'playing');
  assert.equal(state.winner, EMPTY);
  assert.deepEqual(state.winCells, []);
  assert.equal(state.current, PLAYER_ONE);
  assert.equal(game.move(3).state.status, 'won');
});

test("undoTurn removes a player's last move and everything after it", () => {
  const afterReply = createGame({ moves: [3, 4, 2, 5] });
  assert.equal(afterReply.undoTurn(PLAYER_ONE), 2);
  assert.deepEqual(
    afterReply.getState().moves.map((played) => played.col),
    [3, 4],
  );
  assert.equal(afterReply.getState().current, PLAYER_ONE);

  const beforeReply = createGame({ moves: [3, 4, 2] });
  assert.equal(beforeReply.undoTurn(PLAYER_ONE), 1);
  assert.equal(beforeReply.getState().current, PLAYER_ONE);

  const notMovedYet = createGame({ firstPlayer: PLAYER_TWO, moves: [3] });
  assert.equal(notMovedYet.undoTurn(PLAYER_ONE), 0);
  assert.equal(notMovedYet.getState().moves.length, 1);
});

test('getState returns a copy the caller cannot use to change the game', () => {
  const game = createGame({ moves: [3] });
  const state = game.getState();
  state.board.fill(PLAYER_TWO);
  state.moves[0].col = 6;
  assert.equal(getCell(game.getState().board, 0, 0), EMPTY);
  assert.equal(game.getState().moves[0].col, 3);
});

test('a move history can be replayed', () => {
  const manual = createGame();
  for (const col of [3, 3, 4, 2]) manual.move(col);
  assert.deepEqual(createGame({ moves: [3, 3, 4, 2] }).getState(), manual.getState());
});

test('replaying an illegal history throws', () => {
  assert.throws(() => createGame({ moves: [0, 0, 0, 0, 0, 0, 0] }), /Illegal move/);
  assert.throws(() => createGame({ moves: [0, 0, 1, 1, 2, 2, 3, 3] }), /Illegal move/);
});

test('the demo is a mid-game position where both players have hidden threats', () => {
  const state = createDemoGame().getState();
  assert.equal(state.status, 'playing');
  assert.equal(state.current, PLAYER_ONE);
  assert.equal(state.moves.length, 16);
  assert.deepEqual(threats(state.board, PLAYER_ONE), [
    { row: 3, col: 5, playable: false },
    { row: 4, col: 2, playable: false },
  ]);
  assert.deepEqual(threats(state.board, PLAYER_TWO), [
    { row: 3, col: 2, playable: false },
    { row: 4, col: 5, playable: false },
  ]);
  assert.deepEqual(createDemoGame().getState(), state);
});
