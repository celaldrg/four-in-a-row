import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LANGUAGE, LANGUAGES, STRINGS, normalizeLanguage, otherLanguage, translate } from '../src/i18n.js';

const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();

test('English is the default and both languages have a table', () => {
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.deepEqual([...LANGUAGES].sort(), Object.keys(STRINGS).sort());
});

test('both languages define the same keys', () => {
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
});

test('every string is filled in and uses the same placeholders in both languages', () => {
  for (const key of Object.keys(STRINGS.en)) {
    for (const lang of LANGUAGES) {
      assert.equal(typeof STRINGS[lang][key], 'string', `${lang}.${key}`);
      assert.notEqual(STRINGS[lang][key].trim(), '', `${lang}.${key}`);
    }
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(STRINGS.en[key]), key);
  }
});

test('the language button shows the language it switches to', () => {
  assert.equal(translate('en', 'langToggle'), 'TR');
  assert.equal(translate('tr', 'langToggle'), 'EN');
  assert.equal(otherLanguage('en'), 'tr');
  assert.equal(otherLanguage('tr'), 'en');
});

test('translate fills placeholders', () => {
  assert.equal(translate('en', 'moveAnnounce', { name: 'You', column: 4 }), 'You: column 4');
  assert.equal(translate('tr', 'moveAnnounce', { name: 'Sen', column: 4 }), 'Sen: 4. sütun');
  assert.equal(translate('en', 'columnFull', { column: 7 }), 'Column 7 is full');
});

test('missing values keep their placeholder visible', () => {
  assert.equal(translate('en', 'columnFull'), 'Column {column} is full');
});

test('unknown languages use English and unknown keys show the key', () => {
  assert.equal(translate('de', 'newGame'), 'New game');
  assert.equal(translate('tr', 'newGame'), 'Yeni oyun');
  assert.equal(translate('en', 'noSuchKey'), 'noSuchKey');
});

test('saved language values are checked', () => {
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('en'), 'en');
  for (const value of ['TR', 'fr', '', null, undefined, 1, {}]) assert.equal(normalizeLanguage(value), 'en');
});

test('the tables cannot be changed at run time', () => {
  assert.ok(Object.isFrozen(STRINGS));
  assert.ok(Object.isFrozen(STRINGS.en));
  assert.ok(Object.isFrozen(STRINGS.tr));
});
