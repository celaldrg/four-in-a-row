/**
 * Computer opponent: negamax with alpha-beta pruning, centre-first move ordering, the
 * window-based evaluation of position.js and a transposition table. The module touches
 * no DOM, so it runs in Node tests and inside a module Web Worker alike.
 */
import { COLS, ROWS, validColumns, otherPlayer } from './board.js';
import { Position, CENTRE_FIRST } from './position.js';
import { createRng, randomInt } from './rng.js';

const CELL_COUNT = COLS * ROWS;
/** Score of a won game, larger than any heuristic evaluation. */
const WIN_SCORE = 1_000_000;
const SCORE_LIMIT = 2 * WIN_SCORE;
const EXACT = 1;
const LOWER_BOUND = 2;
const UPPER_BOUND = 3;
/** The clock is read once per this many nodes (a power of two). */
const CLOCK_INTERVAL = 1024;

/**
 * Difficulty presets: search depth, chance of a random move (easy only) and time budget.
 * Hard deepens iteratively and keeps the deepest search that finished in time.
 */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ depth: 2, randomness: 0.3 }),
  medium: Object.freeze({ depth: 5 }),
  hard: Object.freeze({ depth: 10, timeLimitMs: 1000 }),
});

/**
 * @typedef {object} SearchResult
 * @property {number} column Chosen column, or -1 when the game is already over.
 * @property {number} score Evaluation for the side to move; at least 1e6 means a forced
 *   win, at most -1e6 a forced loss.
 * @property {number} depth Deepest search depth that completed (0 for the opening move
 *   and when the game is over).
 * @property {number} nodes Positions visited.
 */

/**
 * @typedef {object} SearchOptions
 * @property {number} [depth] Maximum depth in plies (default 5).
 * @property {number} [timeLimitMs] Time budget; depth 1 always completes (default none).
 * @property {() => number} [now] Clock in milliseconds (default performance.now).
 */

/**
 * Creates a computer player. It keeps its transposition table between calls, so create
 * one per Web Worker (or test) and reuse it for every move.
 * @param {{ seed?: number, ttBits?: number }} [options] `seed` drives the easy level's
 *   random moves; `ttBits` is log2 of the transposition table size (2^20 entries = 11 MB).
 * @returns {{
 *   chooseMove: (board: number[], player: number, options?: { level?: string, now?: () => number }) => SearchResult,
 *   search: (board: number[], player: number, options?: SearchOptions) => SearchResult,
 * }}
 */
export function createAi({ seed = 1, ttBits = 20 } = {}) {
  const searcher = new Searcher(ttBits);
  const rng = createRng(seed);
  return {
    chooseMove: (board, player, options) => chooseMove(searcher, rng, board, player, options),
    search: (board, player, options) => searcher.search(board, player, options),
  };
}

/** Applies a level preset: easy sometimes swaps the best move for a random one, never a win. */
function chooseMove(searcher, rng, board, player, { level = 'medium', now } = {}) {
  if (!Object.hasOwn(LEVELS, level)) throw new RangeError(`Unknown level: ${level}`);
  const { depth, timeLimitMs, randomness = 0 } = LEVELS[level];
  const result = searcher.search(board, player, { depth, timeLimitMs, now });
  if (result.column === -1 || result.score >= WIN_SCORE || rng() >= randomness) return result;
  const columns = validColumns(board);
  return { ...result, column: columns[randomInt(rng, columns.length)] };
}

/** Score of a win completed when the board holds `discs` discs: sooner wins score higher. */
function winScore(discs) {
  return WIN_SCORE + CELL_COUNT - discs;
}

function defaultClock() {
  return performance.now();
}

/** Moves `column` to the front of list[offset .. offset + count), keeping the others' order. */
function promote(list, offset, count, column) {
  for (let i = offset + 1; i < offset + count; i++) {
    if (list[i] === column) {
      list.copyWithin(offset + 1, offset, i);
      list[offset] = column;
      return;
    }
  }
}

/**
 * Candidate moves at the root: the safe columns, or when every move loses, a block of an
 * immediate threat (it looks natural), or failing that any legal column.
 */
function rootMoves(position) {
  const safe = new Int8Array(COLS);
  const count = position.safeColumns(safe, 0);
  if (count > 0) return Array.from(safe.subarray(0, count));
  const legal = CENTRE_FIRST.filter((col) => position.canPlay(col));
  const opponent = otherPlayer(position.player);
  const blocks = legal.filter((col) => position.completesLine(position.landingCell(col), opponent));
  return blocks.length > 0 ? blocks : legal;
}

function boundFlag(score, alpha, beta) {
  if (score <= alpha) return UPPER_BOUND;
  if (score >= beta) return LOWER_BOUND;
  return EXACT;
}

/** Search state: the position, a move buffer per ply and the transposition table. */
class Searcher {
  constructor(ttBits) {
    const size = 2 ** ttBits;
    this.position = new Position();
    this.moveBuffer = new Int8Array((CELL_COUNT + 1) * COLS);
    this.ttMask = size - 1;
    this.ttCheck = new Int32Array(size);
    this.ttValue = new Int32Array(size);
    this.ttDepth = new Int8Array(size);
    this.ttFlag = new Uint8Array(size);
    this.ttMove = new Int8Array(size);
    this.nodes = 0;
    this.deadline = Infinity;
    this.aborted = false;
    this.now = defaultClock;
  }

  /**
   * Iterative deepening search for the side to move.
   * @param {number[]} board
   * @param {number} player
   * @param {SearchOptions} [options]
   * @returns {SearchResult}
   */
  search(board, player, { depth = LEVELS.medium.depth, timeLimitMs = Infinity, now = defaultClock } = {}) {
    const position = this.position;
    position.load(board, player);
    this.nodes = 0;
    this.aborted = false;
    this.now = now;
    if (position.isFull() || position.hasCompletedLine()) return { column: -1, score: 0, depth: 0, nodes: 0 };
    // The game is solved: the centre is the strongest first move, so it needs no search.
    if (position.moveCount === 0) return { column: CENTRE_FIRST[0], score: 0, depth: 0, nodes: 0 };
    const win = position.winningColumn();
    if (win !== -1) return { column: win, score: winScore(position.moveCount + 1), depth: 1, nodes: 1 };

    const deadline = now() + timeLimitMs;
    const moves = rootMoves(position);
    let best = null;
    for (let d = 1; d <= Math.max(1, depth); d++) {
      this.deadline = d === 1 ? Infinity : deadline;
      const result = this.searchRoot(moves, d);
      if (result === null) break;
      best = { ...result, depth: d };
      promote(moves, 0, moves.length, result.column);
      if (moves.length === 1 || Math.abs(result.score) >= WIN_SCORE) break;
    }
    return { ...best, nodes: this.nodes };
  }

  /** Searches every root move to `depth`; null when the time budget ran out. */
  searchRoot(moves, depth) {
    const position = this.position;
    let best = { column: moves[0], score: -SCORE_LIMIT };
    for (const col of moves) {
      position.play(col);
      const score = -this.negamax(depth - 1, -SCORE_LIMIT, -best.score);
      position.undo(col);
      if (this.aborted) return null;
      if (score > best.score) best = { column: col, score };
    }
    return best;
  }

  /** Fail-soft negamax: the value of the position for the side to move. */
  negamax(depth, alpha, beta) {
    const position = this.position;
    if (this.tick()) return 0;
    if (position.isFull()) return 0;
    if (position.winningColumn() !== -1) return winScore(position.moveCount + 1);
    if (depth === 0) return position.evaluate();

    const offset = position.moveCount * COLS;
    const count = position.safeColumns(this.moveBuffer, offset);
    if (count === 0) return -winScore(position.moveCount + 2);

    const slot = position.hashLo & this.ttMask;
    if (this.ttFlag[slot] !== 0 && this.ttCheck[slot] === position.hashHi) {
      const cutoff = this.tableCutoff(slot, depth, alpha, beta);
      if (cutoff !== null) return cutoff;
      promote(this.moveBuffer, offset, count, this.ttMove[slot]);
    }

    let best = -SCORE_LIMIT;
    let bestColumn = this.moveBuffer[offset];
    for (let i = 0; i < count; i++) {
      const col = this.moveBuffer[offset + i];
      position.play(col);
      const score = -this.negamax(depth - 1, -beta, -Math.max(alpha, best));
      position.undo(col);
      if (this.aborted) return 0;
      if (score > best) {
        best = score;
        bestColumn = col;
        if (best >= beta) break;
      }
    }
    this.store(slot, depth, best, boundFlag(best, alpha, beta), bestColumn);
    return best;
  }

  /** A stored value that settles this node at the current window, or null. */
  tableCutoff(slot, depth, alpha, beta) {
    if (this.ttDepth[slot] < depth) return null;
    const value = this.ttValue[slot];
    const flag = this.ttFlag[slot];
    if (flag === EXACT) return value;
    if (flag === LOWER_BOUND && value >= beta) return value;
    if (flag === UPPER_BOUND && value <= alpha) return value;
    return null;
  }

  store(slot, depth, value, flag, column) {
    this.ttCheck[slot] = this.position.hashHi;
    this.ttValue[slot] = value;
    this.ttDepth[slot] = depth;
    this.ttFlag[slot] = flag;
    this.ttMove[slot] = column;
  }

  /** Counts a node and reports whether the time budget is used up. */
  tick() {
    this.nodes++;
    if ((this.nodes & (CLOCK_INTERVAL - 1)) === 0 && this.now() > this.deadline) this.aborted = true;
    return this.aborted;
  }
}
