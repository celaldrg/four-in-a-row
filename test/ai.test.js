import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAi, LEVELS } from '../src/ai.js';
import { Position } from '../src/position.js';
import { createGame } from '../src/game.js';
import { COLS, PLAYER_ONE, PLAYER_TWO, createBoard, validColumns } from '../src/board.js';
import { createRng, randomInt } from '../src/rng.js';

const WIN = 1_000_000;
const LEVEL_NAMES = Object.keys(LEVELS);
/** A clock that never advances, so timed searches are deterministic. */
const frozenClock = () => 0;

/** Board and side to move after replaying `moves` (player one starts). */
function position(...moves) {
  const { board, current } = createGame({ moves }).getState();
  return { board, player: current };
}

/** A position after 4 to 23 random moves in which nobody has won yet. */
function randomPosition(seed) {
  const rng = createRng(seed);
  const game = createGame();
  const length = 4 + randomInt(rng, 20);
  for (let i = 0; i < length; i++) {
    const columns = validColumns(game.getState().board);
    if (game.move(columns[randomInt(rng, columns.length)]).state.status !== 'playing') {
      game.undo();
      break;
    }
  }
  return position(...game.getState().moves.map((played) => played.col));
}

/** Score of a win completed with `discs` discs on the board, as the engine scores it. */
function winScore(discs) {
  return WIN + 42 - discs;
}

/** Plain negamax without pruning, move filtering or tables: the engine's reference. */
function minimax(reference, depth) {
  if (reference.isFull()) return 0;
  if (reference.winningColumn() !== -1) return winScore(reference.moveCount + 1);
  if (depth === 0) return reference.evaluate();
  let best = -Infinity;
  for (let col = 0; col < COLS; col++) {
    if (!reference.canPlay(col)) continue;
    reference.play(col);
    best = Math.max(best, -minimax(reference, depth - 1));
    reference.undo(col);
  }
  return best;
}

/** Columns from the centre outwards: the order speeds up alphaBeta but never changes its result. */
const REFERENCE_ORDER = [3, 2, 4, 1, 5, 0, 6];

/**
 * Plain fail-soft alpha-beta without move filtering or tables. With the default full
 * window it returns exactly the minimax value, fast enough for depth 9.
 */
function alphaBeta(reference, depth, alpha = -Infinity, beta = Infinity) {
  if (reference.isFull()) return 0;
  if (reference.winningColumn() !== -1) return winScore(reference.moveCount + 1);
  if (depth === 0) return reference.evaluate();
  let best = -Infinity;
  for (const col of REFERENCE_ORDER) {
    if (!reference.canPlay(col)) continue;
    reference.play(col);
    best = Math.max(best, -alphaBeta(reference, depth - 1, -beta, -Math.max(alpha, best)));
    reference.undo(col);
    if (best >= beta) break;
  }
  return best;
}

/**
 * Asserts that `ai` searching to `depth` picks a move worth the best value according to
 * `value` (an exact reference search) and, if it completed that depth, reports that value.
 */
function assertExact(ai, { board, player }, depth, value, where) {
  const result = ai.search(board, player, { depth });
  const reference = new Position();
  reference.load(board, player);
  const best = value(reference, depth);
  reference.play(result.column);
  const chosen = reference.hasCompletedLine() ? winScore(reference.moveCount) : -value(reference, depth - 1);
  // === rather than assert.equal: a score of -0 equals 0 here.
  assert.ok(chosen === best, `${where}: column ${result.column} scores ${chosen}, best is ${best}`);
  if (result.depth === depth) assert.ok(result.score === best, `${where}: score ${result.score}, best ${best}`);
}

function smallAi(seed = 1) {
  return createAi({ seed, ttBits: 16 });
}

/** Columns chosen at every level and at fixed depths 1 to 6. */
function allChoices({ board, player }) {
  const byLevel = LEVEL_NAMES.map((level) => smallAi().chooseMove(board, player, { level, now: frozenClock }).column);
  const byDepth = [1, 2, 3, 4, 5, 6].map((depth) => smallAi().search(board, player, { depth }).column);
  return [...byLevel, ...byDepth];
}

test('levels follow the specification', () => {
  assert.equal(LEVELS.easy.depth, 2);
  assert.ok(LEVELS.easy.randomness > 0 && LEVELS.easy.randomness < 1);
  assert.equal(LEVELS.medium.depth, 5);
  assert.equal(LEVELS.hard.depth, 10);
  assert.equal(LEVELS.hard.timeLimitMs, 1000);
});

test('takes an immediate horizontal win at every level and depth', () => {
  const game = position(0, 0, 1, 1, 2, 2);
  for (const column of allChoices(game)) assert.equal(column, 3);
  assert.ok(smallAi().search(game.board, game.player).score >= WIN);
});

test('takes an immediate vertical win as player two', () => {
  const game = position(0, 3, 1, 3, 0, 3, 6);
  assert.equal(game.player, PLAYER_TWO);
  for (const column of allChoices(game)) assert.equal(column, 3);
});

test('takes an immediate diagonal win', () => {
  const game = position(0, 1, 1, 3, 2, 2, 2, 4, 3, 3);
  for (const column of allChoices(game)) assert.equal(column, 3);
});

test('blocks an immediate horizontal threat', () => {
  const { board, player } = position(0, 6, 1, 6, 2);
  for (const level of ['medium', 'hard']) {
    assert.equal(smallAi().chooseMove(board, player, { level, now: frozenClock }).column, 3, level);
  }
  for (const depth of [1, 2, 3, 4, 5, 6]) {
    assert.equal(smallAi().search(board, player, { depth }).column, 3, `depth ${depth}`);
  }
});

test('blocks an immediate vertical threat', () => {
  const { board, player } = position(3, 0, 3, 1, 3);
  for (const depth of [1, 2, 5, 6]) {
    assert.equal(smallAi().search(board, player, { depth }).column, 3, `depth ${depth}`);
  }
});

test('prefers its own win over blocking the opponent', () => {
  const game = position(0, 4, 0, 5, 0, 6);
  for (const column of allChoices(game)) assert.equal(column, 0);
});

test('never drops a disc right under an opponent threat', () => {
  // Player two owns row 1 of columns 0-2, so filling row 0 of column 3 would lose.
  const { board, player } = position(0, 2, 1, 0, 6, 1, 5, 2);
  for (const depth of [1, 2, 3, 4, 5, 6]) {
    assert.notEqual(smallAi().search(board, player, { depth }).column, 3, `depth ${depth}`);
  }
});

test('facing two threats it still blocks one and reports the loss', () => {
  // Player two threatens both row 0 of column 3 and row 3 of column 1.
  const { board, player } = position(0, 1, 0, 1, 2, 1, 2, 4, 4, 5, 5, 6);
  const result = smallAi().search(board, player, { depth: 6 });
  assert.ok([1, 3].includes(result.column), `column ${result.column}`);
  assert.ok(result.score <= -WIN);
});

test('returns column -1 once the game is over', () => {
  const won = position(0, 0, 1, 1, 2, 2, 3);
  assert.equal(smallAi().search(won.board, won.player).column, -1);
  const full = createGame({
    moves: [
      0, 1, 1, 1, 1, 1, 2, 4, 3, 6, 2, 6, 0, 2, 6, 1, 2, 5, 6, 2, 0, 0, 2, 0, 5, 4, 4, 3, 5, 3, 3, 4, 5,
      6, 6, 5, 3, 0, 4, 3, 4, 5,
    ],
  }).getState();
  assert.equal(full.status, 'draw');
  assert.equal(smallAi().search(full.board, full.current).column, -1);
});

test('opens in the centre column', () => {
  for (const level of ['medium', 'hard']) {
    assert.equal(smallAi().chooseMove(createBoard(), PLAYER_ONE, { level }).column, 3, level);
  }
  assert.equal(smallAi().search(createBoard(), PLAYER_TWO, { depth: 6 }).column, 3);
});

test('searching leaves the input board untouched', () => {
  const { board, player } = position(3, 3, 2, 4, 4, 2);
  const copy = board.slice();
  smallAi().search(board, player, { depth: 6 });
  assert.deepEqual(board, copy);
});

test('agrees with plain minimax on random positions', () => {
  // One AI per position, so the table also carries results from depth to depth.
  for (let seed = 1; seed <= 40; seed++) {
    const game = randomPosition(seed);
    const ai = smallAi();
    for (const depth of [1, 2, 3, 4, 5]) {
      assertExact(ai, game, depth, minimax, `seed ${seed}, depth ${depth}`);
    }
  }
});

test('agrees with a table-free alpha-beta search at depth 9', () => {
  // Deep searches reach many positions through several move orders: this is where a
  // wrong transposition-table bound would change the result.
  for (let seed = 1; seed <= 200; seed++) {
    assertExact(smallAi(), randomPosition(seed), 9, alphaBeta, `seed ${seed}`);
  }
});

test('repeated searches with one AI give the same answer', () => {
  const { board, player } = position(3, 3, 2, 4, 4, 2, 3, 3);
  const ai = smallAi();
  const first = ai.search(board, player, { depth: 6 });
  const second = ai.search(board, player, { depth: 6 });
  assert.equal(second.column, first.column);
  assert.equal(second.score, first.score);
});

test('hard deepens to depth 10 when time allows', () => {
  const { board, player } = position(3);
  const result = smallAi().chooseMove(board, player, { level: 'hard', now: frozenClock });
  assert.equal(result.depth, 10);
});

test('hard stops when its time budget runs out and keeps the last finished depth', () => {
  let time = 0;
  const fastClock = () => (time += 400); // every clock read costs 400 ms
  const { board, player } = position(3, 3, 2, 4);
  const result = smallAi().chooseMove(board, player, { level: 'hard', now: fastClock });
  assert.ok(result.depth >= 1 && result.depth < LEVELS.hard.depth, `depth ${result.depth}`);
  assert.ok(validColumns(board).includes(result.column));
});

test('easy is reproducible for a seed and varies between seeds', () => {
  const board = createBoard();
  const run = (seed) => {
    const ai = smallAi(seed);
    return Array.from({ length: 10 }, () => ai.chooseMove(board, PLAYER_ONE, { level: 'easy' }).column);
  };
  assert.deepEqual(run(5), run(5));
  const columns = new Set([1, 2, 3, 4, 5].flatMap(run));
  assert.ok(columns.size > 1, 'easy should sometimes leave the best move');
  assert.ok([...columns].every((col) => col >= 0 && col < 7));
});

test('easy never misses an immediate win', () => {
  const { board, player } = position(0, 0, 1, 1, 2, 2);
  for (let seed = 1; seed <= 50; seed++) {
    assert.equal(smallAi(seed).chooseMove(board, player, { level: 'easy' }).column, 3, `seed ${seed}`);
  }
});

test('unknown levels are rejected', () => {
  assert.throws(() => smallAi().chooseMove(createBoard(), PLAYER_ONE, { level: 'expert' }), RangeError);
  assert.throws(() => smallAi().chooseMove(createBoard(), PLAYER_ONE, { level: 'toString' }), RangeError);
});
