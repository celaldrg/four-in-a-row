/**
 * Game options chosen on the page. Values read back from storage may be missing,
 * outdated or edited by hand, so they always pass through normalizeSettings first.
 */

/**
 * @typedef {object} Settings
 * @property {'ai' | 'pvp'} mode Against the computer, or two people on one device.
 * @property {'easy' | 'medium' | 'hard'} level Strength of the computer (LEVELS in ai.js).
 * @property {'human' | 'ai'} first Who moves first against the computer.
 */

/** Against the computer, or two players on one device. */
export const MODES = Object.freeze(['ai', 'pvp']);
/** The level names of LEVELS in ai.js; a test keeps both lists in sync. */
export const LEVEL_NAMES = Object.freeze(['easy', 'medium', 'hard']);
/** Who moves first against the computer. */
export const STARTERS = Object.freeze(['human', 'ai']);

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({ mode: 'ai', level: 'medium', first: 'human' });

const LEVEL_KEYS = Object.freeze({ easy: 'levelEasy', medium: 'levelMedium', hard: 'levelHard' });
const STARTER_KEYS = Object.freeze({ human: 'startsHuman', ai: 'startsAi' });

/**
 * Builds valid settings, keeping each field of `raw` that is valid and taking the
 * default for every other one.
 * @param {unknown} raw For example the parsed value from storage.
 * @returns {Settings}
 */
export function normalizeSettings(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  return {
    mode: pick(MODES, source.mode, DEFAULT_SETTINGS.mode),
    level: pick(LEVEL_NAMES, source.level, DEFAULT_SETTINGS.level),
    first: pick(STARTERS, source.first, DEFAULT_SETTINGS.first),
  };
}

function pick(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * The i18n keys that summarise the settings, shown joined as "vs Computer · Medium · You start".
 * @param {Settings} settings
 * @returns {string[]}
 */
export function summaryKeys(settings) {
  if (settings.mode === 'pvp') return ['modePvp'];
  return ['modeAi', LEVEL_KEYS[settings.level], STARTER_KEYS[settings.first]];
}
