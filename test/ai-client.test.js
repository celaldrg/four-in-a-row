import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Records what the client sends and lets the test answer or fail like a real worker. */
class FakeWorker {
  static last = null;

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.sent = [];
    this.listeners = { message: [], error: [] };
    FakeWorker.last = this;
  }

  addEventListener(type, listener) {
    this.listeners[type].push(listener);
  }

  postMessage(message) {
    this.sent.push(message);
  }

  reply(data) {
    for (const listener of this.listeners.message) listener({ data });
  }

  fail(message) {
    const event = {
      message,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const listener of this.listeners.error) listener(event);
    return event;
  }
}

globalThis.Worker = FakeWorker;
const { createAiClient } = await import('../src/ai-client.js');

test('starts a module worker and sends the seed first', () => {
  createAiClient(42);
  const worker = FakeWorker.last;
  assert.ok(String(worker.url).endsWith('/src/ai-worker.js'), String(worker.url));
  assert.deepEqual(worker.options, { type: 'module' });
  assert.deepEqual(worker.sent, [{ type: 'init', seed: 42 }]);
});

test('answers reach the request with the same id, in any order', async () => {
  const client = createAiClient(1);
  const worker = FakeWorker.last;
  const first = client.chooseMove([0], 1, 'easy');
  const second = client.chooseMove([0], 2, 'hard');
  assert.deepEqual(
    worker.sent.slice(1).map(({ type, id, player, level }) => ({ type, id, player, level })),
    [
      { type: 'move', id: 1, player: 1, level: 'easy' },
      { type: 'move', id: 2, player: 2, level: 'hard' },
    ],
  );
  worker.reply({ id: 2, column: 5 });
  worker.reply({ id: 1, column: 3 });
  assert.equal((await first).column, 3);
  assert.equal((await second).column, 5);
});

test('a worker error rejects waiting and later requests', async () => {
  const client = createAiClient(1);
  const worker = FakeWorker.last;
  const waiting = client.chooseMove([0], 1, 'medium');
  const event = worker.fail('SyntaxError: import not supported');
  assert.equal(event.defaultPrevented, true);
  await assert.rejects(waiting, /import not supported/);
  await assert.rejects(client.chooseMove([0], 1, 'medium'), /import not supported/);
});
