import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS,
  ROWS,
  EMPTY,
  PLAYER_ONE,
  PLAYER_TWO,
  createBoard,
  getCell,
  landingRow,
  validColumns,
  dropDisc,
  otherPlayer,
  winningCells,
  isFull,
} from '../src/board.js';

/** Asks winningCells about every cell; returns the owner and cells of the first line found (bottom-left first), or null. */
function findWinner(board) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const line = winningCells(board, row, col);
      if (line.length > 0) return { player: getCell(board, row, col), cells: line };
    }
  }
  return null;
}

/** Builds a board from rows drawn top (row 5) to bottom (row 0); X is player one, O player two. */
function parse(...rows) {
  assert.equal(rows.length, ROWS);
  const board = createBoard();
  rows.forEach((line, i) => {
    assert.equal(line.length, COLS);
    [...line].forEach((symbol, col) => {
      board[(ROWS - 1 - i) * COLS + col] = '.XO'.indexOf(symbol);
    });
  });
  return board;
}

/** Turns [row, col] pairs into cells sorted the way winningCells sorts them. */
function cells(...pairs) {
  return pairs.map(([row, col]) => ({ row, col })).sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Drops discs for alternating players, starting with player one. */
function play(...columns) {
  let board = createBoard();
  columns.forEach((col, i) => {
    board = dropDisc(board, col, i % 2 === 0 ? PLAYER_ONE : PLAYER_TWO).board;
  });
  return board;
}

test('a new board is empty', () => {
  const board = createBoard();
  assert.equal(board.length, ROWS * COLS);
  assert.ok(board.every((cell) => cell === EMPTY));
  assert.deepEqual(validColumns(board), [0, 1, 2, 3, 4, 5, 6]);
});

test('discs fall to the lowest free cell and stack upwards', () => {
  const first = dropDisc(createBoard(), 3, PLAYER_ONE);
  assert.equal(first.row, 0);
  const second = dropDisc(first.board, 3, PLAYER_TWO);
  assert.equal(second.row, 1);
  assert.equal(getCell(second.board, 0, 3), PLAYER_ONE);
  assert.equal(getCell(second.board, 1, 3), PLAYER_TWO);
  assert.equal(landingRow(second.board, 3), 2);
});

test('dropping a disc leaves the original board untouched', () => {
  const board = createBoard();
  dropDisc(board, 0, PLAYER_ONE);
  assert.ok(board.every((cell) => cell === EMPTY));
});

test('a full column rejects further discs', () => {
  const board = play(2, 2, 2, 2, 2, 2);
  assert.equal(landingRow(board, 2), -1);
  assert.equal(dropDisc(board, 2, PLAYER_ONE), null);
  assert.deepEqual(validColumns(board), [0, 1, 3, 4, 5, 6]);
});

test('columns outside the board are rejected', () => {
  for (const col of [-1, COLS, 2.5, Number.NaN, '3', undefined]) {
    assert.equal(landingRow(createBoard(), col), -1, `column ${col}`);
    assert.equal(dropDisc(createBoard(), col, PLAYER_ONE), null, `column ${col}`);
  }
});

test('otherPlayer swaps the two players', () => {
  assert.equal(otherPlayer(PLAYER_ONE), PLAYER_TWO);
  assert.equal(otherPlayer(PLAYER_TWO), PLAYER_ONE);
});

const LINES = [
  {
    name: 'horizontal line on the bottom-left edge',
    player: PLAYER_ONE,
    board: parse('.......', '.......', '.......', '.......', 'OOO....', 'XXXX...'),
    line: cells([0, 0], [0, 1], [0, 2], [0, 3]),
  },
  {
    name: 'horizontal line on the top-right edge',
    player: PLAYER_ONE,
    board: parse('...XXXX', '...OOXO', '...XXOX', '...OOXO', '...XXOX', '...OOXO'),
    line: cells([5, 3], [5, 4], [5, 5], [5, 6]),
  },
  {
    name: 'vertical line in the left column',
    player: PLAYER_TWO,
    board: parse('.......', '.......', 'O......', 'O......', 'OX.....', 'OXX....'),
    line: cells([0, 0], [1, 0], [2, 0], [3, 0]),
  },
  {
    name: 'vertical line reaching the top of the right column',
    player: PLAYER_ONE,
    board: parse('......X', '......X', '......X', '......X', '......O', '......O'),
    line: cells([2, 6], [3, 6], [4, 6], [5, 6]),
  },
  {
    name: 'rising diagonal from the bottom-left corner',
    player: PLAYER_TWO,
    board: parse('.......', '.......', '...O...', '..OX...', '.OXX...', 'OXXO...'),
    line: cells([0, 0], [1, 1], [2, 2], [3, 3]),
  },
  {
    name: 'rising diagonal into the top-right corner',
    player: PLAYER_ONE,
    board: parse('......X', '.....XX', '....XXO', '...XOXO', '...OXOX', '...OXOX'),
    line: cells([2, 3], [3, 4], [4, 5], [5, 6]),
  },
  {
    name: 'falling diagonal from the top-left corner',
    player: PLAYER_TWO,
    board: parse('O......', 'XO.....', 'OXO....', 'OXOO...', 'XOXO...', 'XOXO...'),
    line: cells([5, 0], [4, 1], [3, 2], [2, 3]),
  },
  {
    name: 'falling diagonal into the bottom-right corner',
    player: PLAYER_ONE,
    board: parse('.......', '.......', '...X...', '...XX..', '...OXX.', '...OXOX'),
    line: cells([3, 3], [2, 4], [1, 5], [0, 6]),
  },
];

for (const { name, player, board, line } of LINES) {
  test(`detects a ${name}`, () => {
    for (const { row, col } of line) {
      assert.deepEqual(winningCells(board, row, col), line, `from cell ${row},${col}`);
    }
    assert.deepEqual(findWinner(board), { player, cells: line });
  });
}

test('filling the gap in the middle of a line wins', () => {
  const board = parse('.......', '.......', '.......', '.......', '.......', 'XX.XOOO');
  const { board: next, row } = dropDisc(board, 2, PLAYER_ONE);
  assert.deepEqual(winningCells(next, row, 2), cells([0, 0], [0, 1], [0, 2], [0, 3]));
});

test('a line of five returns all five cells', () => {
  const board = parse('.......', '.......', '.......', '.......', 'OOOO...', 'XXXXX..');
  assert.deepEqual(winningCells(board, 0, 2), cells([0, 0], [0, 1], [0, 2], [0, 3], [0, 4]));
});

test('two lines through the same disc are both returned', () => {
  const board = parse('.......', '.......', '...X...', '...X...', '...X...', 'XXXXOOO');
  const expected = cells([0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]);
  assert.deepEqual(winningCells(board, 0, 3), expected);
});

test('three in a row, interrupted lines and empty cells do not win', () => {
  const three = parse('.......', '.......', '.......', '.......', 'OOO....', 'XXX....');
  const broken = parse('.......', '.......', '.......', '.......', '...O...', 'XXXOXXX');
  assert.equal(findWinner(three), null);
  assert.equal(findWinner(broken), null);
  assert.deepEqual(winningCells(three, 3, 3), []);
});

test('lines do not wrap from the end of one row to the start of the next', () => {
  // Both boards hold four X discs at consecutive indices of the flat array.
  const endOfRow = parse('.......', '.......', '.......', '.......', 'X......', 'OOO.XXX');
  const startOfRow = parse('.......', '.......', '.......', '.......', 'XXX....', 'OOO...X');
  assert.equal(findWinner(endOfRow), null);
  assert.equal(findWinner(startOfRow), null);
});

test('a full board without a line is a draw', () => {
  const board = parse('OOXOXOX', 'OOOXXOO', 'OXXXOXX', 'XOOOXXX', 'XXXOOXO', 'XOXXOOO');
  assert.ok(isFull(board));
  assert.equal(findWinner(board), null);
  assert.deepEqual(validColumns(board), []);
});

test('a board with one empty cell is not full', () => {
  const board = parse('OOXOXO.', 'OOOXXOO', 'OXXXOXX', 'XOOOXXX', 'XXXOOXO', 'XOXXOOO');
  assert.equal(isFull(board), false);
  assert.deepEqual(validColumns(board), [6]);
});
