/**
 * Incrementally updated position used by the AI search. Every play and undo keeps the
 * disc counts of all 69 four-cell windows, a heuristic score and a Zobrist hash in sync,
 * so the search never rescans the board. Cells use the same `row * COLS + col` layout
 * as board.js.
 */
import { COLS, ROWS, WIN_LENGTH, EMPTY, PLAYER_ONE, PLAYER_TWO, otherPlayer } from './board.js';
import { createRng, randomInt } from './rng.js';

const CELL_COUNT = COLS * ROWS;

/** Columns from the centre outwards, the order in which the search tries moves. */
export const CENTRE_FIRST = Object.freeze(
  Array.from({ length: COLS }, (_, col) => col).sort(
    (a, b) => Math.abs(2 * a - (COLS - 1)) - Math.abs(2 * b - (COLS - 1)) || a - b,
  ),
);

/**
 * A window's state is encoded as `ones * BASE + twos`, where ones and twos count the
 * discs of each player inside it. STEP is what one disc of a player adds to the code;
 * THREAT is the code of a window holding three discs of a player and one empty cell.
 */
const BASE = WIN_LENGTH + 1;
const STEP = [0, BASE, 1];
const THREAT = [0, (WIN_LENGTH - 1) * BASE, WIN_LENGTH - 1];
const COMPLETE = [0, WIN_LENGTH * BASE, WIN_LENGTH];

/**
 * Value of a window with n discs of one player and none of the other. A completed
 * window is never evaluated: the search stops at the move that completes it.
 */
const WEIGHTS = [0, 2, 6, 20, 0];

const WINDOWS = buildWindows();
const WINDOW_COUNT = WINDOWS.length / WIN_LENGTH;
const { starts: WINDOW_START, list: WINDOW_LIST } = indexWindowsByCell();
const WINDOW_SCORE = buildWindowScores();

const keyRng = createRng(0x2f6b7c1d);
const randomKey = () => randomInt(keyRng, 2 ** 32) | 0;
const DISC_KEYS_LO = Int32Array.from({ length: 2 * CELL_COUNT }, randomKey);
const DISC_KEYS_HI = Int32Array.from({ length: 2 * CELL_COUNT }, randomKey);
const SIDE_KEY_LO = randomKey();
const SIDE_KEY_HI = randomKey();

/** Lists the cells of every straight run of WIN_LENGTH cells, WIN_LENGTH entries per run. */
function buildWindows() {
  const cells = [];
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      for (const [rowStep, colStep] of directions) {
        const lastRow = row + rowStep * (WIN_LENGTH - 1);
        const lastCol = col + colStep * (WIN_LENGTH - 1);
        if (lastRow >= ROWS || lastCol < 0 || lastCol >= COLS) continue;
        for (let k = 0; k < WIN_LENGTH; k++) {
          cells.push((row + rowStep * k) * COLS + col + colStep * k);
        }
      }
    }
  }
  return Int8Array.from(cells);
}

/** For each cell, the windows containing it: list[starts[cell]] .. list[starts[cell + 1] - 1]. */
function indexWindowsByCell() {
  const perCell = Array.from({ length: CELL_COUNT }, () => []);
  WINDOWS.forEach((cell, i) => perCell[cell].push(Math.floor(i / WIN_LENGTH)));
  const starts = new Int16Array(CELL_COUNT + 1);
  perCell.forEach((windows, cell) => {
    starts[cell + 1] = starts[cell] + windows.length;
  });
  return { starts, list: Int16Array.from(perCell.flat()) };
}

/** Heuristic value of every window code, from player one's point of view. */
function buildWindowScores() {
  const scores = new Int32Array(BASE * BASE);
  for (let ones = 0; ones <= WIN_LENGTH; ones++) {
    for (let twos = 0; ones + twos <= WIN_LENGTH; twos++) {
      if (ones === 0 || twos === 0) scores[ones * BASE + twos] = WEIGHTS[ones] - WEIGHTS[twos];
    }
  }
  return scores;
}

/** Mutable search position; see the module comment. */
export class Position {
  constructor() {
    this.heights = new Int8Array(COLS);
    this.codes = new Uint8Array(WINDOW_COUNT);
    /** Side to move. */
    this.player = PLAYER_ONE;
    this.moveCount = 0;
    /** Heuristic score from player one's point of view. */
    this.score = 0;
    this.hashLo = 0;
    this.hashHi = 0;
  }

  /**
   * Replaces the position with a board in the board.js format.
   * @param {number[]} board A board reached by legal drops (no floating discs).
   * @param {number} player Side to move.
   */
  load(board, player) {
    this.heights.fill(0);
    this.codes.fill(0);
    this.moveCount = 0;
    this.score = 0;
    this.hashLo = 0;
    this.hashHi = 0;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (board[cell] === EMPTY) continue;
      this.heights[cell % COLS]++;
      this.moveCount++;
      this.updateWindows(cell, board[cell], STEP[board[cell]]);
    }
    this.player = player;
    if (player === PLAYER_TWO) this.toggleSide();
  }

  /**
   * @param {number} col
   * @returns {boolean} Whether the column still has room.
   */
  canPlay(col) {
    return this.heights[col] < ROWS;
  }

  /**
   * @param {number} col A column with room.
   * @returns {number} The cell a disc dropped into `col` would occupy.
   */
  landingCell(col) {
    return this.heights[col] * COLS + col;
  }

  /** @returns {boolean} Whether every cell is occupied. */
  isFull() {
    return this.moveCount === CELL_COUNT;
  }

  /** @returns {boolean} Whether some line is already complete (the game is over). */
  hasCompletedLine() {
    return this.codes.some((code) => code === COMPLETE[PLAYER_ONE] || code === COMPLETE[PLAYER_TWO]);
  }

  /**
   * @param {number} cell An empty cell.
   * @param {number} player
   * @returns {boolean} Whether `player` would complete a line by taking `cell`.
   */
  completesLine(cell, player) {
    const threat = THREAT[player];
    for (let i = WINDOW_START[cell]; i < WINDOW_START[cell + 1]; i++) {
      if (this.codes[WINDOW_LIST[i]] === threat) return true;
    }
    return false;
  }

  /** @returns {number} A column where the side to move wins at once (centre first), or -1. */
  winningColumn() {
    for (let i = 0; i < COLS; i++) {
      const col = CENTRE_FIRST[i];
      if (this.canPlay(col) && this.completesLine(this.landingCell(col), this.player)) return col;
    }
    return -1;
  }

  /**
   * Writes the columns after which the opponent cannot win at once into `out`, centre
   * first. Meant for positions where the side to move has no winning column itself.
   * @param {Int8Array | number[]} out
   * @param {number} offset Index of the first slot to write.
   * @returns {number} How many columns were written; 0 means every move loses.
   */
  safeColumns(out, offset) {
    const opponent = otherPlayer(this.player);
    const forced = this.forcedColumn(opponent);
    if (forced === -2) return 0;
    if (forced !== -1) {
      if (this.opensCellAbove(forced, opponent)) return 0;
      out[offset] = forced;
      return 1;
    }
    let count = 0;
    for (let i = 0; i < COLS; i++) {
      const col = CENTRE_FIRST[i];
      if (this.canPlay(col) && !this.opensCellAbove(col, opponent)) out[offset + count++] = col;
    }
    return count;
  }

  /**
   * The column the side to move must block: -1 when the opponent has no immediate win,
   * -2 when it has two or more (they cannot all be blocked).
   */
  forcedColumn(opponent) {
    let forced = -1;
    for (let i = 0; i < COLS; i++) {
      const col = CENTRE_FIRST[i];
      if (this.canPlay(col) && this.completesLine(this.landingCell(col), opponent)) {
        if (forced !== -1) return -2;
        forced = col;
      }
    }
    return forced;
  }

  /** Whether playing `col` lets `opponent` win by dropping on top of that disc. */
  opensCellAbove(col, opponent) {
    const rowAbove = this.heights[col] + 1;
    return rowAbove < ROWS && this.completesLine(rowAbove * COLS + col, opponent);
  }

  /**
   * Drops a disc of the side to move and passes the turn.
   * @param {number} col A column with room.
   */
  play(col) {
    const cell = this.landingCell(col);
    this.heights[col]++;
    this.moveCount++;
    this.updateWindows(cell, this.player, STEP[this.player]);
    this.player = otherPlayer(this.player);
    this.toggleSide();
  }

  /**
   * Takes back the last disc, which must have been played in `col`.
   * @param {number} col
   */
  undo(col) {
    this.toggleSide();
    this.player = otherPlayer(this.player);
    this.heights[col]--;
    this.moveCount--;
    this.updateWindows(this.landingCell(col), this.player, -STEP[this.player]);
  }

  /** @returns {number} Heuristic score from the side to move's point of view. */
  evaluate() {
    return this.player === PLAYER_ONE ? this.score : -this.score;
  }

  /** Adds (positive step) or removes (negative step) a disc of `player` at `cell`. */
  updateWindows(cell, player, step) {
    for (let i = WINDOW_START[cell]; i < WINDOW_START[cell + 1]; i++) {
      const index = WINDOW_LIST[i];
      const code = this.codes[index];
      this.score += WINDOW_SCORE[code + step] - WINDOW_SCORE[code];
      this.codes[index] = code + step;
    }
    const key = (player - 1) * CELL_COUNT + cell;
    this.hashLo ^= DISC_KEYS_LO[key];
    this.hashHi ^= DISC_KEYS_HI[key];
  }

  toggleSide() {
    this.hashLo ^= SIDE_KEY_LO;
    this.hashHi ^= SIDE_KEY_HI;
  }
}
