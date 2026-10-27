/**
 * Module Web Worker that runs the computer player off the main thread, so the page stays
 * responsive while the hard level searches for up to a second.
 *
 * Messages in:  { type: 'init', seed } once, then { type: 'move', id, board, player, level }.
 * Messages out: { id, column, score, depth, nodes } for every 'move' message.
 */
import { createAi } from './ai.js';

/** One AI per worker, so its transposition table carries over from move to move. */
let ai = null;

self.addEventListener('message', ({ data }) => {
  if (data.type === 'init') {
    ai = createAi({ seed: data.seed });
    return;
  }
  const result = ai.chooseMove(data.board, data.player, { level: data.level });
  self.postMessage({ id: data.id, ...result });
});
