/**
 * Page controller: connects the game (game.js), the match rules (match.js), the SVG
 * board, the AI worker and the page controls, and shows every text in the chosen
 * language. The `?demo` query loads a fixed mid-game position for the README screenshot.
 */
import { PLAYER_ONE, PLAYER_TWO, landingRow } from './board.js';
import { createGame, createDemoGame } from './game.js';
import { createBoardView } from './board-view.js';
import { createAiClient } from './ai-client.js';
import { controlKeepsKey, keyAction } from './keyboard.js';
import { DEFAULT_LANGUAGE, normalizeLanguage, otherLanguage, translate } from './i18n.js';
import { load, save } from './storage.js';
import { DEFAULT_SETTINGS, normalizeSettings, summaryKeys } from './settings.js';
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
} from './match.js';

/** Shortest pause before the computer's disc appears, so its reply never feels instant. */
const COMPUTER_DELAY_MS = 450;
const DEMO = new URLSearchParams(window.location.search).has('demo');
const DEMO_SCORE = Object.freeze({ [HUMAN]: 2, [COMPUTER]: 1 });
const DEMO_CURSOR = 3;

const byId = (id) => document.getElementById(id);
const ui = {
  newGame: byId('new-game'),
  lang: byId('lang'),
  undo: byId('undo'),
  board: byId('board'),
  status: byId('status'),
  statusText: byId('status-text'),
  announcer: byId('announcer'),
  settings: byId('settings'),
  levelGroup: byId('group-level'),
  firstGroup: byId('group-first'),
  panel: byId('panel'),
  toggle: byId('settings-toggle'),
  summary: byId('settings-summary'),
  cards: { [PLAYER_ONE]: byId('card-1'), [PLAYER_TWO]: byId('card-2') },
};

// The demo ignores saved preferences so the screenshot always looks the same.
let lang = DEMO ? DEFAULT_LANGUAGE : normalizeLanguage(load('lang', DEFAULT_LANGUAGE));
let settings = DEMO ? { ...DEFAULT_SETTINGS } : normalizeSettings(load('settings', null));
let gameIndex = 0;
let game = DEMO ? createDemoGame() : createGame({ firstPlayer: firstPlayer(settings, gameIndex) });
let score = DEMO ? { ...DEMO_SCORE } : createScore();
/** Column under the mouse, finger or keyboard cursor; null while none is shown. */
let cursor = DEMO ? DEMO_CURSOR : null;
let thinking = false;
let aiFailed = false;
/** Grows on every state change, so a computer move computed for an older state is dropped. */
let requestId = 0;
let ai = null;

const view = createBoardView(ui.board, { onAim: aim, onSelect: dropForPerson });

function t(key, params) {
  return translate(lang, key, params);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function announce(text) {
  ui.announcer.textContent = text;
}

/** Writes the static texts marked with data-i18n, data-i18n-label and data-i18n-title. */
function applyLanguage() {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll('[data-i18n-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nLabel));
  }
  for (const element of document.querySelectorAll('[data-i18n-title]')) element.title = t(element.dataset.i18nTitle);
}

function renderPreview(state = game.getState()) {
  const shown = cursor !== null && isHumanTurn(settings, state);
  view.setPreview(shown ? { col: cursor, row: landingRow(state.board, cursor), player: state.current } : null);
}

function renderScore(state) {
  for (const player of [PLAYER_ONE, PLAYER_TWO]) {
    const card = ui.cards[player];
    card.querySelector('.score-name').textContent = t(playerNameKey(settings, player));
    card.querySelector('.score-value').textContent = String(score[player]);
    card.classList.toggle('is-active', state.status === 'playing' ? state.current === player : state.winner === player);
    card.classList.toggle('is-thinking', thinking && player === COMPUTER);
  }
}

function renderStatus(state) {
  ui.statusText.textContent = t(aiFailed ? 'aiError' : statusKey(settings, state));
  const tone = state.status === 'won' ? state.winner : state.current;
  ui.status.dataset.tone = state.status === 'draw' ? 'draw' : String(tone);
  ui.status.classList.toggle('is-over', state.status !== 'playing');
}

function renderSettings() {
  for (const input of ui.settings.querySelectorAll('input[type="radio"]')) {
    input.checked = settings[input.name] === input.value;
  }
  ui.levelGroup.disabled = settings.mode !== 'ai';
  ui.firstGroup.disabled = settings.mode !== 'ai';
  ui.summary.textContent = summaryKeys(settings)
    .map((key) => t(key))
    .join(' · ');
}

/** Redraws everything; only the disc of `dropped` (the move just played) is animated. */
function render(dropped = null) {
  const state = game.getState();
  view.render(state, dropped);
  renderPreview(state);
  renderScore(state);
  renderStatus(state);
  renderSettings();
  ui.undo.disabled = !canUndo(settings, state);
  ui.newGame.classList.toggle('is-attention', state.status !== 'playing');
}

/** After any change of the game: cancels a pending computer move, redraws, and lets the computer move when due. */
function proceed(dropped = null) {
  const id = ++requestId;
  const state = game.getState();
  thinking = isComputerTurn(settings, state);
  render(dropped);
  if (thinking) requestComputerMove(state, id);
}

function requestComputerMove(state, id) {
  ai ??= createAiClient(randomSeed());
  const reply = ai.chooseMove(state.board, state.current, settings.level);
  Promise.all([reply, wait(COMPUTER_DELAY_MS)]).then(
    ([result]) => {
      if (id === requestId) play(result.column);
    },
    () => {
      if (id !== requestId) return;
      thinking = false;
      aiFailed = true;
      render();
    },
  );
}

/** Drops a disc for the player to move; a full column flashes instead. */
function play(col) {
  const result = game.move(col);
  if (!result.ok) {
    if (result.reason === 'column-full') {
      view.rejectColumn(col);
      announce(t('columnFull', { column: col + 1 }));
    }
    return;
  }
  const { move, state } = result;
  score = tally(score, state);
  announce(t('moveAnnounce', { name: t(playerNameKey(settings, move.player)), column: move.col + 1 }));
  proceed(move);
}

function dropForPerson(col) {
  if (isHumanTurn(settings, game.getState())) play(col);
}

function aim(col) {
  if (col === cursor) return;
  cursor = col;
  renderPreview();
}

function undo() {
  const before = game.getState();
  if (!canUndo(settings, before)) return;
  takeBack(game, settings);
  score = tally(score, before, -1);
  announce(t('undone'));
  proceed();
}

function startGame(index) {
  gameIndex = index;
  aiFailed = false;
  game = createGame({ firstPlayer: firstPlayer(settings, index) });
  proceed();
}

function changeSetting(name, value) {
  settings = normalizeSettings({ ...settings, [name]: value });
  save('settings', settings);
  if (name === 'level') {
    render();
  } else if (name === 'mode') {
    score = createScore();
    startGame(0);
  } else {
    startGame(gameIndex + 1);
  }
}

function toggleLanguage() {
  lang = otherLanguage(lang);
  save('lang', lang);
  // The last announcement is in the old language.
  announce('');
  applyLanguage();
  render();
}

function toggleSettings() {
  const open = ui.toggle.getAttribute('aria-expanded') !== 'true';
  ui.toggle.setAttribute('aria-expanded', String(open));
  ui.panel.classList.toggle('is-collapsed', !open);
}

/** The focused control that may keep a key for itself (see controlKeepsKey), or null. */
function focusedControl(target) {
  if (!(target instanceof Element)) return null;
  if (target.closest('input')) return 'radio';
  return target.closest('button:not(:disabled), a') ? 'button' : null;
}

function onKeyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (controlKeepsKey(focusedControl(event.target), event.key)) return;
  const action = keyAction(event.key, cursor);
  if (action === null) return;
  event.preventDefault();
  if (event.repeat && action.type !== 'aim') return;
  if (action.type === 'aim') {
    aim(action.col);
  } else if (action.type === 'drop') {
    aim(action.col);
    dropForPerson(action.col);
  } else if (action.type === 'undo') {
    undo();
  } else {
    startGame(gameIndex + 1);
  }
}

/**
 * Runs `action` when `button` is clicked. After a mouse or touch click the keyboard goes
 * back to the board, so Enter and Space drop a disc instead of pressing the button again;
 * a button pressed from the keyboard (click detail 0) keeps the focus.
 */
function onPress(button, action) {
  button.addEventListener('click', (event) => {
    action();
    if (event.detail > 0) ui.board.focus({ preventScroll: true });
  });
}

onPress(ui.newGame, () => startGame(gameIndex + 1));
onPress(ui.undo, undo);
onPress(ui.lang, toggleLanguage);
onPress(ui.toggle, toggleSettings);
ui.settings.addEventListener('change', (event) => changeSetting(event.target.name, event.target.value));
// A setting picked with the mouse or a finger hands the keyboard back to the board, as onPress
// does for buttons; one picked from the keyboard keeps the focus in its radio group.
let pickedByPointer = false;
ui.settings.addEventListener('pointerdown', () => { pickedByPointer = true; });
ui.settings.addEventListener('keydown', () => { pickedByPointer = false; });
ui.settings.addEventListener('click', () => {
  if (pickedByPointer) ui.board.focus({ preventScroll: true });
});
document.addEventListener('keydown', onKeyDown);

applyLanguage();
proceed();
// Draw the first state without transitions (reading the layout applies the styles now);
// only later changes animate.
document.body.getBoundingClientRect();
document.documentElement.classList.remove('is-starting');
