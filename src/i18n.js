/**
 * Every user-facing string in English and Turkish. Pure data plus lookup helpers, so the
 * tests can check that both languages define the same keys and placeholders.
 * Placeholders are written {name} and filled by translate().
 */

/** Supported language codes. */
export const LANGUAGES = Object.freeze(['en', 'tr']);
/** Language shown until the player picks another one. */
export const DEFAULT_LANGUAGE = 'en';

const EN = {
  title: 'Four in a Row',
  newGame: 'New game',
  undo: 'Undo',
  langToggle: 'TR',
  langToggleTitle: 'Switch to Turkish',
  scoreLabel: 'Score',
  you: 'You',
  computer: 'Computer',
  playerOne: 'Player 1',
  playerTwo: 'Player 2',
  yourTurn: 'Your turn',
  computerThinking: 'Computer is thinking…',
  playerOneTurn: "Player 1's turn",
  playerTwoTurn: "Player 2's turn",
  youWin: 'You win!',
  computerWins: 'The computer wins',
  playerOneWins: 'Player 1 wins!',
  playerTwoWins: 'Player 2 wins!',
  draw: "It's a draw",
  aiError: 'The computer player could not start.',
  moveAnnounce: '{name}: column {column}',
  columnFull: 'Column {column} is full',
  undone: 'Move taken back',
  boardLabel:
    'Game board with 7 columns. Press 1 to 7 to drop a disc, or choose a column with the arrow keys and press Enter.',
  settingsTitle: 'Game settings',
  modeLabel: 'Mode',
  modeAi: 'vs Computer',
  modePvp: '2 players',
  levelLabel: 'Level',
  levelEasy: 'Easy',
  levelMedium: 'Medium',
  levelHard: 'Hard',
  firstLabel: 'First move',
  firstHuman: 'You',
  firstAi: 'Computer',
  startsHuman: 'You start',
  startsAi: 'Computer starts',
  howTitle: 'How to play',
  howRules: 'Take turns dropping discs. Line up four of your colour across, down or diagonally.',
  howPointer: 'Click or tap a column. On touch screens, slide to aim and lift to drop.',
  keysTitle: 'Keyboard',
  keyDrop: 'drop in that column',
  keyAim: 'choose a column',
  keyConfirm: 'drop in the chosen column',
  keyUndo: 'undo',
  keyNew: 'new game',
  source: 'Source on GitHub',
};

const TR = {
  title: 'Dört Taş',
  newGame: 'Yeni oyun',
  undo: 'Geri al',
  langToggle: 'EN',
  langToggleTitle: 'İngilizceye geç',
  scoreLabel: 'Skor',
  you: 'Sen',
  computer: 'Bilgisayar',
  playerOne: 'Oyuncu 1',
  playerTwo: 'Oyuncu 2',
  yourTurn: 'Sıra sende',
  computerThinking: 'Bilgisayar düşünüyor…',
  playerOneTurn: "Sıra Oyuncu 1'de",
  playerTwoTurn: "Sıra Oyuncu 2'de",
  youWin: 'Kazandın!',
  computerWins: 'Bilgisayar kazandı',
  playerOneWins: 'Oyuncu 1 kazandı!',
  playerTwoWins: 'Oyuncu 2 kazandı!',
  draw: 'Berabere',
  aiError: 'Bilgisayar oyuncusu başlatılamadı.',
  moveAnnounce: '{name}: {column}. sütun',
  columnFull: '{column}. sütun dolu',
  undone: 'Hamle geri alındı',
  boardLabel:
    "Yedi sütunlu oyun tahtası. Taş bırakmak için 1-7 tuşlarına bas ya da ok tuşlarıyla bir sütun seçip Enter'a bas.",
  settingsTitle: 'Oyun ayarları',
  modeLabel: 'Mod',
  modeAi: 'Bilgisayara karşı',
  modePvp: 'İki oyuncu',
  levelLabel: 'Seviye',
  levelEasy: 'Kolay',
  levelMedium: 'Orta',
  levelHard: 'Zor',
  firstLabel: 'İlk hamle',
  firstHuman: 'Sen',
  firstAi: 'Bilgisayar',
  startsHuman: 'Sen başlarsın',
  startsAi: 'Bilgisayar başlar',
  howTitle: 'Nasıl oynanır',
  howRules: 'Sırayla taş bırakın. Kendi renginden dört taşı yatay, dikey ya da çapraz dizen kazanır.',
  howPointer: 'Bir sütuna tıkla ya da dokun. Dokunmatik ekranda kaydırarak sütun seç, parmağını kaldırınca taş düşer.',
  keysTitle: 'Klavye',
  keyDrop: 'o sütuna taş bırak',
  keyAim: 'sütun seç',
  keyConfirm: 'seçili sütuna bırak',
  keyUndo: 'geri al',
  keyNew: 'yeni oyun',
  source: "Kaynak kod GitHub'da",
};

/** String tables by language code. */
export const STRINGS = Object.freeze({ en: Object.freeze(EN), tr: Object.freeze(TR) });

/**
 * Turns any value into a supported language code.
 * @param {unknown} value For example a value read back from storage.
 * @returns {string} `value` when it is supported, otherwise DEFAULT_LANGUAGE.
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

/**
 * The language the toggle button switches to.
 * @param {string} lang Current language code.
 * @returns {string}
 */
export function otherLanguage(lang) {
  return lang === 'tr' ? 'en' : 'tr';
}

/**
 * Looks up a string and fills its placeholders.
 * @param {string} lang Language code; unknown codes use English.
 * @param {string} key Key of STRINGS.en.
 * @param {Record<string, string | number>} [params] Values for the {placeholders}.
 * @returns {string} The translation, the English text when the key is missing in `lang`,
 *   or the key itself when it is unknown.
 */
export function translate(lang, key, params = {}) {
  const template = STRINGS[normalizeLanguage(lang)][key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}
