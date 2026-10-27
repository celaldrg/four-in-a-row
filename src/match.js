/**
 * Match rules on top of game.js: which side the computer plays, who starts each game,
 * what Undo takes back, the score and the status line. Pure functions over game states,
 * so they are unit tested without a browser.
 */
import { PLAYER_ONE, PLAYER_TWO } from './board.js';

/**
 * @typedef {import('./settings.js').Settings} Settings
 * @typedef {import('./game.js').GameState} GameState
 * @typedef {ReturnType<typeof import('./game.js').createGame>} Game
 * @typedef {{ [player: number]: number }} Score Wins per player.
 */

/** Against the computer the person always plays PLAYER_ONE and the computer PLAYER_TWO. */
export const HUMAN = PLAYER_ONE;
export const COMPUTER = PLAYER_TWO;

/**
 * The player who moves first in a game.
 * @param {Settings} settings
 * @param {number} gameIndex 0 for the first game of the session, then 1, 2, ...
 * @returns {number} Against the computer the chosen side; between two people the
 *   starting player alternates from game to game.
 */
export function firstPlayer(settings, gameIndex) {
  if (settings.mode === 'ai') return settings.first === 'ai' ? COMPUTER : HUMAN;
  return gameIndex % 2 === 0 ? PLAYER_ONE : PLAYER_TWO;
}

/**
 * @param {Settings} settings
 * @param {GameState} state
 * @returns {boolean} Whether the computer has to move now.
 */
export function isComputerTurn(settings, state) {
  return settings.mode === 'ai' && state.status === 'playing' && state.current === COMPUTER;
}

/**
 * @param {Settings} settings
 * @param {GameState} state
 * @returns {boolean} Whether a person may drop a disc now.
 */
export function isHumanTurn(settings, state) {
  return state.status === 'playing' && !isComputerTurn(settings, state);
}

/**
 * @param {Settings} settings
 * @param {GameState} state
 * @returns {boolean} Whether Undo has something to take back: against the computer the
 *   person must have moved, between two people any move counts.
 */
export function canUndo(settings, state) {
  if (settings.mode === 'ai') return state.moves.some((move) => move.player === HUMAN);
  return state.moves.length > 0;
}

/**
 * Takes back one turn: against the computer the person's last move together with the
 * computer's reply, so it is the person's turn again; otherwise the last move.
 * @param {Game} game
 * @param {Settings} settings
 * @returns {number} How many moves were removed.
 */
export function takeBack(game, settings) {
  if (settings.mode === 'ai') return game.undoTurn(HUMAN);
  return game.undo() === null ? 0 : 1;
}

/**
 * @returns {Score} A score of 0 : 0.
 */
export function createScore() {
  return { [PLAYER_ONE]: 0, [PLAYER_TWO]: 0 };
}

/**
 * Counts a finished game's winner (step 1) or removes that win again (step -1) when the
 * winning move is undone. Draws and running games leave the score unchanged.
 * @param {Score} score
 * @param {GameState} state
 * @param {1 | -1} [step]
 * @returns {Score} A new score object.
 */
export function tally(score, state, step = 1) {
  if (state.status !== 'won') return score;
  return { ...score, [state.winner]: score[state.winner] + step };
}

/**
 * @param {Settings} settings
 * @param {number} player
 * @returns {string} i18n key of the player's name.
 */
export function playerNameKey(settings, player) {
  if (settings.mode === 'ai') return player === HUMAN ? 'you' : 'computer';
  return player === PLAYER_ONE ? 'playerOne' : 'playerTwo';
}

/**
 * @param {Settings} settings
 * @param {GameState} state
 * @returns {string} i18n key of the status line: whose turn it is or how the game ended.
 */
export function statusKey(settings, state) {
  if (state.status === 'draw') return 'draw';
  const vsComputer = settings.mode === 'ai';
  if (state.status === 'won') {
    if (vsComputer) return state.winner === HUMAN ? 'youWin' : 'computerWins';
    return state.winner === PLAYER_ONE ? 'playerOneWins' : 'playerTwoWins';
  }
  if (vsComputer) return state.current === HUMAN ? 'yourTurn' : 'computerThinking';
  return state.current === PLAYER_ONE ? 'playerOneTurn' : 'playerTwoTurn';
}
