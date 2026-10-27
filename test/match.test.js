import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_ONE, PLAYER_TWO } from '../src/board.js';
import { createGame } from '../src/game.js';
import { STRINGS } from '../src/i18n.js';
import {
  COMPUTER,
  HUMAN,
  canUndo,
  createScore,
  firstPlayer,
  isComputerTurn,
  isHumanTurn,
  playerNameKey,
  statusKey,
  takeBack,
  tally,
} from '../src/match.js';

const VS_AI = { mode: 'ai', level: 'medium', first: 'human' };
const AI_FIRST = { mode: 'ai', level: 'medium', first: 'ai' };
const PVP = { mode: 'pvp', level: 'medium', first: 'human' };

/** Player one stacks four discs in column 0 while player two plays column 1. */
const VERTICAL_WIN = [0, 1, 0, 1, 0, 1, 0];
/** Fills the board without a line (from test/game.test.js). */
const DRAW_MOVES = [
  0, 1, 1, 1, 1, 1, 2, 4, 3, 6, 2, 6, 0, 2, 6, 1, 2, 5, 6, 2, 0, 0, 2, 0, 5, 4, 4, 3, 5, 3, 3, 4, 5, 6,
  6, 5, 3, 0, 4, 3, 4, 5,
];

test('the person plays player one against the computer', () => {
  assert.equal(HUMAN, PLAYER_ONE);
  assert.equal(COMPUTER, PLAYER_TWO);
});

test('against the computer the chosen side starts every game', () => {
  for (const index of [0, 1, 2, 7]) {
    assert.equal(firstPlayer(VS_AI, index), HUMAN);
    assert.equal(firstPlayer(AI_FIRST, index), COMPUTER);
  }
});

test('between two people the starting player alternates', () => {
  assert.deepEqual(
    [0, 1, 2, 3].map((index) => firstPlayer(PVP, index)),
    [PLAYER_ONE, PLAYER_TWO, PLAYER_ONE, PLAYER_TWO],
  );
});

test('the computer moves only on its own turn of a running game', () => {
  const game = createGame({ firstPlayer: COMPUTER });
  assert.equal(isComputerTurn(AI_FIRST, game.getState()), true);
  assert.equal(isHumanTurn(AI_FIRST, game.getState()), false);
  game.move(3);
  assert.equal(isComputerTurn(AI_FIRST, game.getState()), false);
  assert.equal(isHumanTurn(AI_FIRST, game.getState()), true);
});

test('two people take every turn themselves', () => {
  const game = createGame({ firstPlayer: PLAYER_TWO });
  assert.equal(isComputerTurn(PVP, game.getState()), false);
  assert.equal(isHumanTurn(PVP, game.getState()), true);
});

test('nobody moves after the game is over', () => {
  const state = createGame({ moves: VERTICAL_WIN }).getState();
  assert.equal(state.current, COMPUTER);
  assert.equal(isComputerTurn(VS_AI, state), false);
  assert.equal(isHumanTurn(VS_AI, state), false);
  assert.equal(isHumanTurn(PVP, state), false);
});

test('undo against the computer needs a move by the person', () => {
  const game = createGame({ firstPlayer: COMPUTER });
  assert.equal(canUndo(AI_FIRST, game.getState()), false);
  game.move(3);
  assert.equal(canUndo(AI_FIRST, game.getState()), false);
  game.move(3);
  assert.equal(canUndo(AI_FIRST, game.getState()), true);
});

test('undo between two people needs any move', () => {
  const game = createGame();
  assert.equal(canUndo(PVP, game.getState()), false);
  game.move(0);
  assert.equal(canUndo(PVP, game.getState()), true);
});

test('take back against the computer removes the reply too', () => {
  const game = createGame({ moves: [3, 4, 2, 5] });
  assert.equal(takeBack(game, VS_AI), 2);
  assert.deepEqual(
    game.getState().moves.map((move) => move.col),
    [3, 4],
  );
  assert.equal(game.getState().current, HUMAN);
});

test('take back while the computer is still thinking removes only your move', () => {
  const game = createGame({ moves: [3, 4, 2] });
  assert.equal(takeBack(game, VS_AI), 1);
  assert.equal(game.getState().moves.length, 2);
  assert.equal(game.getState().current, HUMAN);
});

test('take back between two people removes one move at a time', () => {
  const game = createGame({ moves: [3, 4] });
  assert.equal(takeBack(game, PVP), 1);
  assert.equal(game.getState().current, PLAYER_TWO);
  assert.equal(takeBack(game, PVP), 1);
  assert.equal(takeBack(game, PVP), 0);
});

test('the score counts wins and nothing else', () => {
  const start = createScore();
  assert.deepEqual(start, { [PLAYER_ONE]: 0, [PLAYER_TWO]: 0 });
  const won = createGame({ moves: VERTICAL_WIN }).getState();
  const after = tally(start, won);
  assert.deepEqual(after, { [PLAYER_ONE]: 1, [PLAYER_TWO]: 0 });
  assert.deepEqual(start, { [PLAYER_ONE]: 0, [PLAYER_TWO]: 0 }, 'tally returns a new object');
  assert.equal(tally(after, createGame({ moves: [3] }).getState()), after);
  assert.equal(tally(after, createGame({ moves: DRAW_MOVES }).getState()), after);
});

test('undoing a winning move removes the win from the score', () => {
  const won = createGame({ moves: VERTICAL_WIN }).getState();
  const score = tally(tally(createScore(), won), won);
  assert.deepEqual(tally(score, won, -1), { [PLAYER_ONE]: 1, [PLAYER_TWO]: 0 });
});

test('players are named after the mode', () => {
  assert.equal(playerNameKey(VS_AI, HUMAN), 'you');
  assert.equal(playerNameKey(VS_AI, COMPUTER), 'computer');
  assert.equal(playerNameKey(PVP, PLAYER_ONE), 'playerOne');
  assert.equal(playerNameKey(PVP, PLAYER_TWO), 'playerTwo');
});

test('the status line follows turns, wins and draws', () => {
  const fresh = createGame().getState();
  const aiTurn = createGame({ moves: [3] }).getState();
  const p1Wins = createGame({ moves: VERTICAL_WIN }).getState();
  const p2Wins = createGame({ moves: [6, ...VERTICAL_WIN.map((col) => col + 1)] }).getState();
  const draw = createGame({ moves: DRAW_MOVES }).getState();
  assert.equal(p2Wins.winner, PLAYER_TWO);
  assert.equal(draw.status, 'draw');

  assert.equal(statusKey(VS_AI, fresh), 'yourTurn');
  assert.equal(statusKey(VS_AI, aiTurn), 'computerThinking');
  assert.equal(statusKey(VS_AI, p1Wins), 'youWin');
  assert.equal(statusKey(VS_AI, p2Wins), 'computerWins');
  assert.equal(statusKey(VS_AI, draw), 'draw');
  assert.equal(statusKey(PVP, fresh), 'playerOneTurn');
  assert.equal(statusKey(PVP, aiTurn), 'playerTwoTurn');
  assert.equal(statusKey(PVP, p1Wins), 'playerOneWins');
  assert.equal(statusKey(PVP, p2Wins), 'playerTwoWins');
  assert.equal(statusKey(PVP, draw), 'draw');
});

test('every name and status key has a translation', () => {
  const keys = ['you', 'computer', 'playerOne', 'playerTwo', 'yourTurn', 'computerThinking', 'youWin'];
  keys.push('computerWins', 'playerOneTurn', 'playerTwoTurn', 'playerOneWins', 'playerTwoWins', 'draw');
  for (const key of keys) assert.ok(Object.hasOwn(STRINGS.en, key), key);
});
