/**
 * localStorage access that never throws. Private browsing, blocked cookies or a full
 * quota turn reads into the fallback value and writes into no-ops, so the game keeps
 * working without saved preferences. Keys are prefixed because every game on
 * celaldrg.github.io shares one origin and therefore one storage area.
 */

const PREFIX = 'four-in-a-row:';

/**
 * Reads a JSON value.
 * @param {string} key Key without the prefix.
 * @param {*} fallback Returned when nothing usable is stored or storage is unavailable.
 * @param {Pick<Storage, 'getItem'>} [store] Storage to read (default: localStorage).
 * @returns {*} The parsed value or `fallback`.
 */
export function load(key, fallback, store) {
  try {
    const raw = (store ?? globalThis.localStorage).getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Writes a JSON value.
 * @param {string} key Key without the prefix.
 * @param {*} value Any JSON-serialisable value.
 * @param {Pick<Storage, 'setItem'>} [store] Storage to write (default: localStorage).
 * @returns {boolean} Whether the value was stored.
 */
export function save(key, value, store) {
  try {
    (store ?? globalThis.localStorage).setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
