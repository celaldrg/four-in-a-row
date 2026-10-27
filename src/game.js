/**
 * Game controller for Four in a Row: turn order, move history, undo, win and draw
 * detection. Pure logic with no DOM access; the UI reads snapshots via getState().
 */
import { COLS, EMPTY, PLAYER_ONE, createBoard, dropDisc, isFull, otherPlayer, winningCells } from './board.js';

/**
 * Column history behind the ?demo screenshot (player one starts). It ends in a pyramid
 * of 16 discs where each side has two diagonal threats that cannot be played yet:
 *
 *   . . . . . . .
 *   . . . . . . .
 *   . . . 1 2 . .
 *   . . . 2 1 . .
 *   . 2 2 1 2 1 .
 *   1 1 1 2 1 2 2
 *
 * test/game.test.js checks those properties.
 */
const DEMO_MOVES = Object.freeze([2, 3, 4, 5, 3, 6, 5, 4, 4, 3, 3, 4, 0, 2, 1, 1]);

/**
 * @typedef {import('./board.js').Cell} Cell
 * @typedef {{ col: number, row: number, player: number }} Move
 * @typedef {'playing' | 'won' | 'draw'} Status
 */

/**
 * @typedef {object} GameState
 * @property {number[]} board Flat board, see board.js.
 * @property {number} current Player to move (after a win: the loser).
 * @property {number} firstPlayer Player who made the first move.
 * @property {Move[]} moves Moves played so far, oldest first.
 * @property {Status} status
 * @property {number} winner Winning player, or EMPTY.
 * @property {Cell[]} winCells Cells of the winning line(s); empty unless status is 'won'.
 */

/**
 * @typedef {{ ok: true, move: Move, state: GameState }
 *   | { ok: false, reason: 'game-over' | 'invalid-column' | 'column-full' }} MoveResult
 */

/**
 * Creates a game.
 * @param {{ firstPlayer?: number, moves?: number[] }} [options] `firstPlayer` moves first
 *   (default PLAYER_ONE); `moves` is a column history to replay, e.g. a saved game.
 * @returns {{
 *   move: (col: number) => MoveResult,
 *   undo: () => Move | null,
 *   undoTurn: (player: number) => number,
 *   getState: () => GameState,
 * }}
 * @throws {Error} When `moves` contains an illegal move.
 */
export function createGame({ firstPlayer = PLAYER_ONE, moves = [] } = {}) {
  const history = [];
  let board = createBoard();
  let current = firstPlayer;
  let winCells = [];

  function status() {
    if (winCells.length > 0) return 'won';
    return isFull(board) ? 'draw' : 'playing';
  }

  /** @returns {GameState} A snapshot the caller may freely modify. */
  function getState() {
    const now = status();
    return {
      board: board.slice(),
      current,
      firstPlayer,
      moves: history.map((played) => ({ ...played })),
      status: now,
      winner: now === 'won' ? history[history.length - 1].player : EMPTY,
      winCells: winCells.map((cell) => ({ ...cell })),
    };
  }

  /**
   * Drops a disc for the player to move.
   * @param {number} col
   * @returns {MoveResult}
   */
  function move(col) {
    if (status() !== 'playing') return { ok: false, reason: 'game-over' };
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, reason: 'invalid-column' };
    const result = dropDisc(board, col, current);
    if (result === null) return { ok: false, reason: 'column-full' };
    const played = { col, row: result.row, player: current };
    history.push(played);
    board = result.board;
    winCells = winningCells(board, played.row, col);
    current = otherPlayer(current);
    return { ok: true, move: { ...played }, state: getState() };
  }

  /**
   * Takes back the last move.
   * @returns {Move | null} The removed move, or null when there was none.
   */
  function undo() {
    const last = history.pop();
    if (last === undefined) return null;
    board = history.reduce((next, played) => dropDisc(next, played.col, played.player).board, createBoard());
    current = last.player;
    winCells = [];
    return { ...last };
  }

  /**
   * Takes back `player`'s last move and every move after it, so it is that player's turn
   * again. Against the AI, `undoTurn(human)` also removes the AI's reply.
   * @param {number} player
   * @returns {number} How many moves were removed (0 when `player` has not moved yet).
   */
  function undoTurn(player) {
    if (!history.some((played) => played.player === player)) return 0;
    let removed = 0;
    let last;
    do {
      last = undo();
      removed++;
    } while (last.player !== player);
    return removed;
  }

  for (const col of moves) {
    if (!move(col).ok) throw new Error(`Illegal move in history: column ${col}`);
  }
  return { move, undo, undoTurn, getState };
}

/**
 * Builds the deterministic mid-game position shown by the ?demo URL (player one to move).
 * @returns {ReturnType<typeof createGame>}
 */
export function createDemoGame() {
  return createGame({ moves: DEMO_MOVES });
}
