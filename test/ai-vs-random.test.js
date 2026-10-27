// "Done" criterion: at a fixed search depth the AI never loses to a random opponent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAi } from '../src/ai.js';
import { createGame } from '../src/game.js';
import { PLAYER_ONE, PLAYER_TWO, otherPlayer, validColumns } from '../src/board.js';
import { createRng, randomInt } from '../src/rng.js';

const GAMES_PER_SIDE = 100;
const DEPTH = 6;

/** Plays one game between the depth-limited AI and a seeded random mover; returns the winner. */
function playGame(aiPlayer, seed) {
  const rng = createRng(seed);
  const ai = createAi({ ttBits: 16 });
  const game = createGame();
  let state = game.getState();
  while (state.status === 'playing') {
    const columns = validColumns(state.board);
    const column =
      state.current === aiPlayer
        ? ai.search(state.board, state.current, { depth: DEPTH }).column
        : columns[randomInt(rng, columns.length)];
    const result = game.move(column);
    assert.ok(result.ok, `illegal move ${column} in game ${seed}`);
    state = result.state;
  }
  return state.winner;
}

for (const aiPlayer of [PLAYER_ONE, PLAYER_TWO]) {
  const role = aiPlayer === PLAYER_ONE ? 'first' : 'second';
  test(`depth-${DEPTH} AI moving ${role} never loses ${GAMES_PER_SIDE} seeded games against random moves`, (t) => {
    let wins = 0;
    for (let game = 0; game < GAMES_PER_SIDE; game++) {
      const seed = aiPlayer * 10_000 + game;
      const winner = playGame(aiPlayer, seed);
      assert.notEqual(winner, otherPlayer(aiPlayer), `lost the game with seed ${seed}`);
      if (winner === aiPlayer) wins++;
    }
    t.diagnostic(`wins ${wins}, draws ${GAMES_PER_SIDE - wins}, losses 0`);
  });
}
