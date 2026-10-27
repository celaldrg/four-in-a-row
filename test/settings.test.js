import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, LEVEL_NAMES, MODES, STARTERS, normalizeSettings, summaryKeys } from '../src/settings.js';
import { LEVELS } from '../src/ai.js';
import { STRINGS } from '../src/i18n.js';

test('the level names match the AI levels', () => {
  assert.deepEqual([...LEVEL_NAMES].sort(), Object.keys(LEVELS).sort());
});

test('missing or broken saved settings fall back to the defaults', () => {
  for (const raw of [null, undefined, 'hard', 42, [], {}]) {
    assert.deepEqual(normalizeSettings(raw), DEFAULT_SETTINGS);
  }
});

test('valid fields are kept and invalid ones replaced one by one', () => {
  assert.deepEqual(normalizeSettings({ mode: 'pvp', level: 'hard', first: 'ai' }), {
    mode: 'pvp',
    level: 'hard',
    first: 'ai',
  });
  assert.deepEqual(normalizeSettings({ mode: 'online', level: 'easy', first: 'nobody', extra: true }), {
    mode: DEFAULT_SETTINGS.mode,
    level: 'easy',
    first: DEFAULT_SETTINGS.first,
  });
});

test('the defaults are valid and cannot be changed by accident', () => {
  assert.ok(MODES.includes(DEFAULT_SETTINGS.mode));
  assert.ok(LEVEL_NAMES.includes(DEFAULT_SETTINGS.level));
  assert.ok(STARTERS.includes(DEFAULT_SETTINGS.first));
  assert.ok(Object.isFrozen(DEFAULT_SETTINGS));
});

test('the summary names mode, level and starter against the computer', () => {
  assert.deepEqual(summaryKeys({ mode: 'ai', level: 'easy', first: 'human' }), ['modeAi', 'levelEasy', 'startsHuman']);
  assert.deepEqual(summaryKeys({ mode: 'ai', level: 'hard', first: 'ai' }), ['modeAi', 'levelHard', 'startsAi']);
  assert.deepEqual(summaryKeys({ mode: 'pvp', level: 'hard', first: 'ai' }), ['modePvp']);
});

test('every summary key has a translation', () => {
  for (const mode of MODES) {
    for (const level of LEVEL_NAMES) {
      for (const first of STARTERS) {
        for (const key of summaryKeys({ mode, level, first })) assert.ok(Object.hasOwn(STRINGS.en, key), key);
      }
    }
  }
});
