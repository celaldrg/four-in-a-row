/**
 * Seeded pseudo-random numbers (mulberry32). The same seed always yields the same
 * sequence, which keeps tests and the AI's "easy" level reproducible.
 */

/**
 * Creates a seeded random number generator.
 * @param {number} seed Any number; only its low 32 bits are used.
 * @returns {() => number} A function returning floats in [0, 1).
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws a random integer in [0, n).
 * @param {() => number} rng Generator from createRng.
 * @param {number} n Exclusive upper bound, a positive integer.
 * @returns {number}
 */
export function randomInt(rng, n) {
  return Math.floor(rng() * n);
}
