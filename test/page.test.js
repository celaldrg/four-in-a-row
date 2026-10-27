import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { STRINGS } from '../src/i18n.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const main = read('src/main.js');

/** [key, static text] for every element with data-i18n. */
function i18nTexts() {
  return [...html.matchAll(/<\w+[^>]*\sdata-i18n="(\w+)"[^>]*>([^<]*)</g)].map(([, key, text]) => [key, text]);
}

test('every translated element starts with its English text', () => {
  const texts = i18nTexts();
  assert.ok(texts.length > 20);
  for (const [key, text] of texts) assert.equal(text, STRINGS.en[key], key);
});

test('translated labels and titles exist and start in English', () => {
  for (const [attribute, name] of [
    ['aria-label', 'label'],
    ['title', 'title'],
  ]) {
    const tags = [...html.matchAll(new RegExp(`<[^>]*\\sdata-i18n-${name}="(\\w+)"[^>]*>`, 'g'))];
    assert.ok(tags.length > 0, name);
    for (const [tag, key] of tags) {
      assert.ok(Object.hasOwn(STRINGS.en, key), key);
      assert.ok(tag.includes(`${attribute}="${STRINGS.en[key]}"`), tag);
    }
  }
});

test('every element the controller looks up exists once', () => {
  const ids = [...main.matchAll(/byId\('([\w-]+)'\)/g)].map(([, id]) => id);
  assert.ok(ids.length > 10);
  for (const id of ids) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
  }
});

test('the page head has the metadata for sharing', () => {
  assert.match(html, /^<!doctype html>\n<html lang="en"/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.match(html, /<title>Four in a Row<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{50,}">/);
  assert.match(html, /<meta property="og:title" content="Four in a Row">/);
  assert.match(html, /<meta property="og:description" content="[^"]{30,}">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/celaldrg\.github\.io\/four-in-a-row\/">/);
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/celaldrg\.github\.io\/four-in-a-row\/docs\/screenshot\.png">/,
  );
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.match(html, /<script type="module" src="src\/main\.js"><\/script>/);
});

test('shipped code never builds HTML from strings, evaluates code or logs', () => {
  const forbidden = /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|console\.log/;
  const files = readdirSync(new URL('../src/', import.meta.url)).filter((name) => name.endsWith('.js'));
  assert.ok(files.length >= 10);
  for (const name of files) assert.doesNotMatch(read(`src/${name}`), forbidden, name);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/, 'no inline scripts');
});
