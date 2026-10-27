/**
 * SVG view of the board: a frame with 42 holes drawn over the discs, drops with a small
 * bounce, the column preview and the pulsing winning line. It only draws and reports
 * pointer input; the rules live in board.js and game.js. The SVG scales with its
 * container, so it stays sharp at any devicePixelRatio.
 */
import { COLS, ROWS, EMPTY, PLAYER_ONE, PLAYER_TWO } from './board.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Geometry in SVG user units. Row 0 is drawn at the bottom, like in board.js. */
const CELL = 100;
const HOLE_R = 38;
const DISC_R = 36;
const FRAME_PAD = 14;
const FRAME_RADIUS = 26;
/** Strip above the frame where the next disc hovers; drops start there. */
const LANE = 108;
const LANE_Y = -FRAME_PAD - LANE / 2;
/** viewBox; style.css sizes the board container with the same aspect ratio (728 / 736). */
const VIEW_X = -FRAME_PAD;
const VIEW_Y = -FRAME_PAD - LANE;
const VIEW_W = COLS * CELL + 2 * FRAME_PAD;
const VIEW_H = ROWS * CELL + 2 * FRAME_PAD + LANE;
/** A pointer released farther than this (CSS px) outside the board cancels the drop. */
const RELEASE_MARGIN = 48;

const CELLS = Array.from({ length: ROWS * COLS }, (_, index) => ({
  index,
  row: Math.floor(index / COLS),
  col: index % COLS,
}));

const centreX = (col) => col * CELL + CELL / 2;
const centreY = (row) => (ROWS - 1 - row) * CELL + CELL / 2;

/** Creates an SVG element with attributes and children. */
function svgElement(tag, attributes = {}, children = []) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  element.append(...children);
  return element;
}

function gradientStop(offset, color) {
  return svgElement('stop', { offset, 'stop-color': color });
}

/** Glossy disc shading: a light spot top left fading to a dark rim. */
function discGradient(id, [light, mid, base, edge]) {
  return svgElement('radialGradient', { id, cx: '38%', cy: '32%', r: '72%' }, [
    gradientStop(0, light),
    gradientStop(0.3, mid),
    gradientStop(0.75, base),
    gradientStop(1, edge),
  ]);
}

function createDefs() {
  return svgElement('defs', {}, [
    discGradient('fiar-p1', ['#ffe4e6', '#fb7185', '#e11d48', '#9f1239']),
    discGradient('fiar-p2', ['#ccfbf1', '#5eead4', '#14b8a6', '#115e59']),
    svgElement('radialGradient', { id: 'fiar-hole', cx: '50%', cy: '30%', r: '70%' }, [
      gradientStop(0, '#16213a'),
      gradientStop(1, '#060a14'),
    ]),
    svgElement('linearGradient', { id: 'fiar-frame', x1: 0, y1: 0, x2: 0, y2: 1 }, [
      gradientStop(0, '#2e3f5c'),
      gradientStop(1, '#1b2538'),
    ]),
  ]);
}

/** Outline of the frame plus one circle per hole; with fill-rule evenodd the circles are cut out. */
function framePath() {
  const x = -FRAME_PAD;
  const y = -FRAME_PAD;
  const w = COLS * CELL + 2 * FRAME_PAD;
  const h = ROWS * CELL + 2 * FRAME_PAD;
  const r = FRAME_RADIUS;
  const outline =
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}` +
    `A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  const holes = CELLS.map(({ row, col }) => {
    const left = centreX(col) - HOLE_R;
    return `M${left} ${centreY(row)}a${HOLE_R} ${HOLE_R} 0 1 0 ${2 * HOLE_R} 0a${HOLE_R} ${HOLE_R} 0 1 0 ${-2 * HOLE_R} 0Z`;
  });
  return outline + holes.join('');
}

/** One circle per cell, e.g. the dark hole backs or the shaded rims. */
function circlePerCell(className) {
  return svgElement(
    'g',
    { class: className },
    CELLS.map(({ row, col }) => svgElement('circle', { cx: centreX(col), cy: centreY(row), r: HOLE_R })),
  );
}

/** A full-height pill over one column, moved sideways with a CSS transform. */
function columnBand(className) {
  const inset = 8;
  return svgElement('rect', {
    class: className,
    x: inset,
    y: -FRAME_PAD + 6,
    width: CELL - 2 * inset,
    height: ROWS * CELL + 2 * FRAME_PAD - 12,
    rx: CELL / 2 - inset,
  });
}

/**
 * A disc: the outer group is placed on the board, the middle one falls and bounces,
 * the inner one pulses when the disc is part of the winning line.
 */
function createDisc(player) {
  const body = svgElement('g', { class: 'disc-body' }, [
    svgElement('circle', { class: 'disc-face', r: DISC_R }),
    svgElement('circle', { class: 'disc-ring', r: Math.round(DISC_R * 0.64) }),
    svgElement('circle', { class: 'disc-mark', r: 7 }),
  ]);
  return svgElement('g', { class: `disc p${player}` }, [svgElement('g', { class: 'disc-drop' }, [body])]);
}

function setPlayerClass(element, player) {
  element.classList.toggle('p1', player === PLAYER_ONE);
  element.classList.toggle('p2', player === PLAYER_TWO);
}

/**
 * @typedef {{ col: number, row: number, player: number }} Preview Column under the
 *   cursor, its landing row (-1 when full) and the player about to move.
 */

/**
 * Draws the board inside `host` and reports pointer input.
 * @param {HTMLElement} host Empty container; it should keep the 728 / 736 aspect ratio.
 * @param {{ onAim: (col: number | null) => void, onSelect: (col: number) => void }} handlers
 *   `onAim` follows the hovered or touched column (null when the pointer leaves);
 *   `onSelect` fires when a click or touch is released over a column.
 * @returns {{
 *   render: (state: import('./game.js').GameState, dropped?: import('./game.js').Move | null) => void,
 *   setPreview: (preview: Preview | null) => void,
 *   rejectColumn: (col: number) => void,
 * }}
 */
export function createBoardView(host, { onAim, onSelect }) {
  const root = svgElement('svg', {
    class: 'board-svg',
    viewBox: `${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`,
    'aria-hidden': 'true',
  });
  const discLayer = svgElement('g', { class: 'discs' });
  const highlight = columnBand('column-highlight is-hidden');
  const flash = columnBand('column-flash');
  const ghost = svgElement('circle', { class: 'ghost is-hidden', r: HOLE_R - 8 });
  const preview = createDisc(PLAYER_ONE);
  preview.classList.add('preview', 'is-hidden');
  // Start the overlays on the centre column so their first appearance does not slide in from a corner.
  const centre = Math.floor(COLS / 2);
  preview.style.transform = `translate(${centreX(centre)}px, ${LANE_Y}px)`;
  ghost.style.transform = `translate(${centreX(centre)}px, ${centreY(0)}px)`;
  highlight.style.transform = flash.style.transform = `translateX(${centre * CELL}px)`;

  root.append(
    createDefs(),
    circlePerCell('holes'),
    discLayer,
    svgElement('path', { class: 'frame', d: framePath(), 'fill-rule': 'evenodd' }),
    circlePerCell('rims'),
    highlight,
    flash,
    ghost,
    preview,
  );
  host.append(root);

  /** Disc element per cell index, or null for an empty cell. */
  const discs = CELLS.map(() => null);

  function startDrop(disc, row) {
    const distance = centreY(row) - LANE_Y;
    const duration = Math.round(140 + 115 * Math.sqrt(distance / CELL));
    const drop = disc.querySelector('.disc-drop');
    drop.style.setProperty('--from', `${-distance}px`);
    drop.style.setProperty('--duration', `${duration}ms`);
    drop.classList.add('is-dropping');
    root.style.setProperty('--win-delay', `${duration}ms`);
  }

  function syncCell({ index, row, col }, player, dropped) {
    const current = discs[index];
    if (current !== null && current.dataset.player === String(player)) return;
    current?.remove();
    discs[index] = null;
    if (player === EMPTY) return;
    const disc = createDisc(player);
    disc.dataset.player = String(player);
    disc.setAttribute('transform', `translate(${centreX(col)} ${centreY(row)})`);
    if (dropped !== null && dropped.row === row && dropped.col === col) startDrop(disc, row);
    discLayer.append(disc);
    discs[index] = disc;
  }

  function markMoves(state) {
    const last = state.moves.at(-1);
    const lastIndex = last === undefined ? -1 : last.row * COLS + last.col;
    const winning = new Set(state.winCells.map(({ row, col }) => row * COLS + col));
    discs.forEach((disc, index) => {
      disc?.classList.toggle('is-last', index === lastIndex);
      disc?.classList.toggle('is-win', winning.has(index));
    });
    root.classList.toggle('is-won', state.status === 'won');
  }

  /** Brings the discs in line with `state`; only the disc of `dropped` is animated. */
  function render(state, dropped = null) {
    for (const cell of CELLS) syncCell(cell, state.board[cell.index], dropped);
    markMoves(state);
  }

  /** Shows the hovering disc, the column band and the landing ring, or hides them (null). */
  function setPreview(next) {
    const shown = next !== null;
    highlight.classList.toggle('is-hidden', !shown);
    preview.classList.toggle('is-hidden', !shown);
    ghost.classList.toggle('is-hidden', !shown || next.row < 0);
    if (!shown) return;
    const x = centreX(next.col);
    highlight.style.transform = `translateX(${next.col * CELL}px)`;
    preview.style.transform = `translate(${x}px, ${LANE_Y}px)`;
    setPlayerClass(preview, next.player);
    setPlayerClass(ghost, next.player);
    if (next.row >= 0) ghost.style.transform = `translate(${x}px, ${centreY(next.row)}px)`;
  }

  /** Flashes a column red, e.g. after a drop into a full column; with reduced motion it shows and hides without fading. */
  function rejectColumn(col) {
    flash.style.transform = `translateX(${col * CELL}px)`;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: reduced ? 'step-end' : 'ease-out' });
  }

  function columnAt(event) {
    const box = root.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * VIEW_W + VIEW_X;
    return Math.min(COLS - 1, Math.max(0, Math.floor(x / CELL)));
  }

  function isNearBoard(event) {
    const box = root.getBoundingClientRect();
    return (
      event.clientX > box.left - RELEASE_MARGIN &&
      event.clientX < box.right + RELEASE_MARGIN &&
      event.clientY > box.top - RELEASE_MARGIN &&
      event.clientY < box.bottom + RELEASE_MARGIN
    );
  }

  // Mouse and pen aim by hovering; a touch aims while the finger is down and drops on release.
  let activePointer = null;
  root.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    activePointer = event.pointerId;
    root.setPointerCapture(event.pointerId);
    onAim(columnAt(event));
  });
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' && event.pointerId !== activePointer) return;
    onAim(columnAt(event));
  });
  root.addEventListener('pointerup', (event) => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    if (isNearBoard(event)) onSelect(columnAt(event));
    if (event.pointerType === 'touch') onAim(null);
  });
  root.addEventListener('pointercancel', () => {
    activePointer = null;
    onAim(null);
  });
  root.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch' && activePointer === null) onAim(null);
  });

  return { render, setPreview, rejectColumn };
}
