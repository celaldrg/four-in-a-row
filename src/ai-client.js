/**
 * Main-thread side of the AI worker (src/ai-worker.js): sends positions to the worker and
 * hands its answers back as promises.
 */

/**
 * Starts the AI worker.
 * @param {number} seed Seed for the easy level's random moves.
 * @returns {{
 *   chooseMove: (board: number[], player: number, level: string) => Promise<import('./ai.js').SearchResult>,
 * }} `chooseMove` rejects when the worker cannot run.
 */
export function createAiClient(seed) {
  const worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
  const pending = new Map();
  let failure = null;
  let lastId = 0;

  worker.addEventListener('message', ({ data }) => {
    pending.get(data.id)?.resolve(data);
    pending.delete(data.id);
  });
  worker.addEventListener('error', (event) => {
    event.preventDefault();
    failure = new Error(event.message || 'The AI worker failed.');
    for (const { reject } of pending.values()) reject(failure);
    pending.clear();
  });
  worker.postMessage({ type: 'init', seed });

  function chooseMove(board, player, level) {
    if (failure !== null) return Promise.reject(failure);
    const id = ++lastId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ type: 'move', id, board, player, level });
    });
  }

  return { chooseMove };
}
