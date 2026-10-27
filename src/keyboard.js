/**
 * Keyboard controls as a pure mapping from KeyboardEvent.key to a game action:
 * 1-7 drop in that column, the left and right arrows move the column cursor, Enter,
 * Space or the down arrow drop at the cursor, U undoes and N starts a new game. A focused
 * button keeps Enter and Space, a focused radio button also keeps the arrows.
 */
import { COLS } from './board.js';

const CENTRE = Math.floor(COLS / 2);
/** Keys a focused button or link uses itself: they press it. */
const BUTTON_KEYS = new Set(['Enter', ' ']);
/** Keys a focused radio button uses itself: pressing it and moving to the next option. */
const RADIO_KEYS = new Set([...BUTTON_KEYS, 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/**
 * @typedef {{ type: 'drop', col: number }
 *   | { type: 'aim', col: number }
 *   | { type: 'undo' }
 *   | { type: 'new' }} KeyAction
 */

/**
 * @param {string} key KeyboardEvent.key.
 * @param {number | null} cursor Column under the cursor, or null while no cursor is shown.
 * @returns {KeyAction | null} The action, or null for keys the game does not use. Moving
 *   or dropping without a cursor first shows it on the centre column.
 */
export function keyAction(key, cursor) {
  const digit = key.length === 1 ? Number.parseInt(key, 10) : NaN;
  if (digit >= 1 && digit <= COLS) return { type: 'drop', col: digit - 1 };
  switch (key) {
    case 'ArrowLeft':
      return { type: 'aim', col: cursor === null ? CENTRE : Math.max(0, cursor - 1) };
    case 'ArrowRight':
      return { type: 'aim', col: cursor === null ? CENTRE : Math.min(COLS - 1, cursor + 1) };
    case 'Enter':
    case ' ':
    case 'ArrowDown':
      return cursor === null ? { type: 'aim', col: CENTRE } : { type: 'drop', col: cursor };
    case 'u':
    case 'U':
      return { type: 'undo' };
    case 'n':
    case 'N':
      return { type: 'new' };
    default:
      return null;
  }
}

/**
 * Tells whether a focused page control keeps a key for itself instead of the game.
 * @param {'button' | 'radio' | null} control The focused control (a link counts as a
 *   button), or null when the board or nothing has focus.
 * @param {string} key KeyboardEvent.key.
 * @returns {boolean} True for Enter and Space on a button, and also for the arrows on a
 *   radio button; the digits, U, N and the arrows on a button still reach the game.
 */
export function controlKeepsKey(control, key) {
  if (control === 'radio') return RADIO_KEYS.has(key);
  return control === 'button' && BUTTON_KEYS.has(key);
}
