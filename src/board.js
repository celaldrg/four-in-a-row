/**
 * Rules of Four in a Row on a 7 x 6 grid: discs fall to the lowest free cell of a column
 * and four of one colour in a straight line wins.
 *
 * A board is a flat array of ROWS * COLS cells indexed `row * COLS + col`; row 0 is the
 * bottom row. Each cell holds EMPTY, PLAYER_ONE or PLAYER_TWO. Boards are never mutated:
 * functions that change one return a new array.
 */

export const COLS = 7;
export const ROWS = 6;
export const WIN_LENGTH = 4;
export const EMPTY = 0;
export const PLAYER_ONE = 1;
export const PLAYER_TWO = 2;

/** Line directions as [rowStep, colStep]: horizontal, vertical and both diagonals. */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** @typedef {{ row: number, col: number }} Cell */

/**
 * Creates an empty board.
 * @returns {number[]}
 */
export function createBoard() {
  return new Array(ROWS * COLS).fill(EMPTY);
}

/**
 * Reads one cell.
 * @param {number[]} board
 * @param {number} row Row index, 0 is the bottom row.
 * @param {number} col Column index, 0 is the left column.
 * @returns {number} EMPTY, PLAYER_ONE or PLAYER_TWO.
 */
export function getCell(board, row, col) {
  return board[row * COLS + col];
}

/**
 * Finds the row a disc dropped into `col` would land on.
 * @param {number[]} board
 * @param {number} col
 * @returns {number} The landing row, or -1 when the column is full or does not exist.
 */
export function landingRow(board, col) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let row = 0; row < ROWS; row++) {
    if (getCell(board, row, col) === EMPTY) return row;
  }
  return -1;
}

/**
 * Lists the columns that still accept a disc, left to right.
 * @param {number[]} board
 * @returns {number[]}
 */
export function validColumns(board) {
  const columns = [];
  for (let col = 0; col < COLS; col++) {
    if (landingRow(board, col) !== -1) columns.push(col);
  }
  return columns;
}

/**
 * Drops a disc into a column, leaving `board` untouched.
 * @param {number[]} board
 * @param {number} col
 * @param {number} player PLAYER_ONE or PLAYER_TWO.
 * @returns {{ board: number[], row: number } | null} The new board and the landing row,
 *   or null when the column is full or does not exist.
 */
export function dropDisc(board, col, player) {
  const row = landingRow(board, col);
  if (row === -1) return null;
  const next = board.slice();
  next[row * COLS + col] = player;
  return { board: next, row };
}

/**
 * Returns the opponent of a player.
 * @param {number} player PLAYER_ONE or PLAYER_TWO.
 * @returns {number}
 */
export function otherPlayer(player) {
  return player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
}

/**
 * Collects every line of at least WIN_LENGTH same-coloured discs passing through a cell.
 * @param {number[]} board
 * @param {number} row
 * @param {number} col
 * @returns {Cell[]} All cells of those lines, sorted bottom to top then left to right;
 *   empty when the cell is empty or not part of a winning line.
 */
export function winningCells(board, row, col) {
  const player = getCell(board, row, col);
  if (player === EMPTY) return [];
  const cells = [];
  for (const [rowStep, colStep] of DIRECTIONS) {
    const run = [
      ...collectRun(board, row, col, rowStep, colStep, player),
      ...collectRun(board, row, col, -rowStep, -colStep, player),
    ];
    if (run.length + 1 >= WIN_LENGTH) cells.push(...run);
  }
  if (cells.length === 0) return [];
  cells.push({ row, col });
  return cells.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Consecutive cells owned by `player` next to (row, col) in one direction, nearest first. */
function collectRun(board, row, col, rowStep, colStep, player) {
  const run = [];
  let r = row + rowStep;
  let c = col + colStep;
  while (isOnBoard(r, c) && getCell(board, r, c) === player) {
    run.push({ row: r, col: c });
    r += rowStep;
    c += colStep;
  }
  return run;
}

function isOnBoard(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

/**
 * Tells whether every cell is occupied.
 * @param {number[]} board
 * @returns {boolean}
 */
export function isFull(board) {
  return board.every((cell) => cell !== EMPTY);
}
