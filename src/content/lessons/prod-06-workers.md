---
id: prod-workers
track: prod
title: Case study: cash-out on the main thread
summary: A 400 ms calculation runs on every price tick and scrolling turns to sludge. Move it to a Web Worker — with request IDs, cancellation, timeouts and a pool.
---

> **INCIDENT — "The cash-out screen janks."** The cash-out panel re-prices ~300 open positions on every odds tick (correlated markets, a few thousand simulated paths each). Profile: a single **400 ms long task** per update, 3–5 times a second. Scrolling and typing stutter; INP p75 = **780 ms**. The maths can't be made 10× faster — but it doesn't need to run on the UI thread.

## Workers in one minute

A **Web Worker** runs JavaScript on a **separate thread** with its own global scope (no DOM). You talk to it with `postMessage`; data is **copied** using the *structured clone* algorithm (or **transferred** for `ArrayBuffer`s — zero-copy, but the sender loses access; or shared with `SharedArrayBuffer`).

**Worth it when** the task is CPU-bound and > ~50 ms: parsing/normalising huge payloads, big sorts/diffs, crypto/hashing, image/audio processing, simulations. **Not worth it** for small tasks — serialising the arguments and result can cost more than the work.

**Costs & gotchas**
- Structured clone of a big object graph blocks the *sender* while it copies. Send **compact** data (typed arrays, ids) and transfer buffers.
- Startup takes a few ms and memory — reuse workers (a **pool**), don't spawn one per call.
- **A worker only reads its inbox between tasks.** If it's in a synchronous 400 ms loop it cannot see a "cancel" message. Long jobs must be **chunked/yielding**, or check a shared flag.
- Errors don't bubble by themselves. `worker.onerror` and rejected handler promises must be **turned into messages**.
- **Leaks:** a worker lives until you `terminate()` it.

## `postMessage` is not an API — build one

Raw messages have no return values. The standard layer is **RPC over `postMessage`**:

```
client → worker   { id: 7, type: 'call', method: 'price', args: [...] }
worker → client   { id: 7, type: 'result', result: ... }
                  { id: 7, type: 'error',  error: { name, message } }
client → worker   { id: 7, type: 'cancel' }
```

Key design points (each is a bug if you skip it):

1. **Correlation ids** so concurrent calls match their answers, out of order.
2. **Cancellation** — the client stops waiting *and* tells the worker; the worker aborts cooperatively and **suppresses** the reply. Late replies for cancelled ids are ignored.
3. **Timeouts** — a hung worker must not hang your UI.
4. **Termination** rejects everything pending (don't leave promises dangling) and refuses new calls.
5. **Backpressure / latest-wins** — if calls arrive faster than they finish (ticks every 100 ms, jobs take 400 ms) don't queue them all: cancel the stale one and keep only the latest. (You built `latest()` earlier.)
6. A **pool** of N workers bounds concurrency to the core count instead of spawning unbounded work.

[Comlink](https://github.com/GoogleChromeLabs/comlink) is this pattern packaged with Proxy sugar.

## Related tools

- `scheduler.yield()` / time slicing — for work that must touch the DOM or share state.
- `OffscreenCanvas` — render in a worker.
- **SharedWorker** — one worker shared by all tabs of an origin (a natural home for a single WebSocket).
- **Service Worker** — network proxy/cache/push; a different job.

## Testing without real workers

Real workers need a browser. Everything above is *protocol logic*, so we test it against **fake ports**: `createFakePorts()` gives you two entangled `MessagePort`-like objects with async delivery, exactly like `new MessageChannel()`.

%% exercise prod-worker-client | Worker RPC client | 4 | js | js | createWorkerClient | 40
Build `createWorkerClient(port, { timeoutMs = 0 } = {})`. `port` has `postMessage(data)` and an assignable `onmessage(event)` (`event.data` is the message). Return `{ call(method, args, { signal } = {}), terminate() }`.

**Protocol** (client → worker): `{ id, type: 'call', method, args }` and `{ id, type: 'cancel' }`. Worker → client: `{ id, type: 'result', result }` or `{ id, type: 'error', error: { name, message } }`.

- `call` returns a promise. Ids are unique and increase from `1`.
- Responses are matched by `id`, in any order; unknown ids are ignored.
- An `error` response rejects with an `Error` whose `name` and `message` come from the payload.
- **Abort:** if `signal` aborts while pending, reject with an error named `AbortError`, post `{ id, type: 'cancel' }`, and ignore any late response. A signal that is **already aborted** rejects immediately and posts **nothing**.
- **Timeout:** with `timeoutMs > 0`, reject after that long with an error named `TimeoutError` (message `Call "<method>" timed out after <ms>ms`) and post a cancel.
- Settled calls release their timer and abort listener.
- `terminate()` rejects every pending call with `Error('Worker terminated')`, calls `port.close?.()`, and any later `call` rejects immediately with the same error.

%% starter
```js
export function createWorkerClient(port, { timeoutMs = 0 } = {}) {
  // your code
}
```

%% tests
```js
function setup(options) {
  jest.useFakeTimers();
  const [clientPort, workerPort] = createFakePorts();
  const received = [];
  workerPort.onmessage = (e) => received.push(e.data);
  const client = createWorkerClient(clientPort, options);
  const reply = async (msg) => { workerPort.postMessage(msg); await flushPromises(); };
  return { client, received, reply, clientPort, workerPort };
}

describe('createWorkerClient — calls', () => {
  it('posts a call message and resolves with the result', async () => {
    const { client, received, reply } = setup();
    const p = client.call('price', [1, 2]);
    await flushPromises();
    expect(received).toEqual([{ id: 1, type: 'call', method: 'price', args: [1, 2] }]);
    await reply({ id: 1, type: 'result', result: 42 });
    await expect(p).resolves.toBe(42);
  });

  it('defaults args to an empty array', async () => {
    const { client, received } = setup();
    client.call('ping');
    await flushPromises();
    expect(received[0].args).toEqual([]);
  });

  it('uses unique increasing ids and matches out-of-order responses', async () => {
    const { client, received, reply } = setup();
    const a = client.call('a'), b = client.call('b'), c = client.call('c');
    await flushPromises();
    expect(received.map((m) => m.id)).toEqual([1, 2, 3]);
    await reply({ id: 3, type: 'result', result: 'C' });
    await reply({ id: 1, type: 'result', result: 'A' });
    await reply({ id: 2, type: 'result', result: 'B' });
    await expect(Promise.all([a, b, c])).resolves.toEqual(['A', 'B', 'C']);
  });

  it('rejects with an Error carrying the worker error name and message', async () => {
    const { client, reply } = setup();
    const p = client.call('boom');
    const assertion = expect(p).rejects.toMatchObject({ name: 'RangeError', message: 'bad input' });
    await reply({ id: 1, type: 'error', error: { name: 'RangeError', message: 'bad input' } });
    await assertion;
    await p.catch((e) => expect(e).toBeInstanceOf(Error));
  });

  it('ignores responses for unknown ids and duplicate responses', async () => {
    const { client, reply } = setup();
    const p = client.call('x');
    await reply({ id: 99, type: 'result', result: 'stray' });
    await reply({ id: 1, type: 'result', result: 'first' });
    await reply({ id: 1, type: 'result', result: 'second' });
    await expect(p).resolves.toBe('first');
  });
});

describe('createWorkerClient — cancellation & timeouts', () => {
  it('aborting rejects with AbortError, posts a cancel, and ignores the late response', async () => {
    const { client, received, reply } = setup();
    const controller = new AbortController();
    const p = client.call('slow', [], { signal: controller.signal });
    const assertion = expect(p).rejects.toMatchObject({ name: 'AbortError' });
    await flushPromises();
    controller.abort();
    await assertion;
    await flushPromises();
    expect(received.at(-1)).toEqual({ id: 1, type: 'cancel' });
    await reply({ id: 1, type: 'result', result: 'late' });
  });

  it('an already-aborted signal rejects immediately and posts nothing', async () => {
    const { client, received } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(client.call('x', [], { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await flushPromises();
    expect(received).toEqual([]);
  });

  it('times out with a TimeoutError and cancels the worker-side job', async () => {
    const { client, received } = setup({ timeoutMs: 1000 });
    const p = client.call('hung');
    const assertion = expect(p).rejects.toMatchObject({ name: 'TimeoutError', message: 'Call "hung" timed out after 1000ms' });
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
    await flushPromises();
    expect(received.at(-1)).toEqual({ id: 1, type: 'cancel' });
  });

  it('does not time out calls that complete in time, and clears their timers', async () => {
    const { client, reply } = setup({ timeoutMs: 1000 });
    const p = client.call('fast');
    await reply({ id: 1, type: 'result', result: 'ok' });
    await expect(p).resolves.toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('removes its abort listener once the call settles', async () => {
    const { client, reply } = setup();
    const controller = new AbortController();
    const add = jest.spyOn(controller.signal, 'addEventListener');
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const p = client.call('x', [], { signal: controller.signal });
    await reply({ id: 1, type: 'result', result: 1 });
    await p;
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('createWorkerClient — terminate', () => {
  it('rejects every pending call and closes the port', async () => {
    const { client, clientPort } = setup();
    const a = client.call('a'), b = client.call('b');
    const checks = Promise.all([expect(a).rejects.toThrow('Worker terminated'), expect(b).rejects.toThrow('Worker terminated')]);
    client.terminate();
    await checks;
    expect(clientPort.closed).toBe(true);
  });

  it('rejects new calls after termination and posts nothing', async () => {
    const { client, received } = setup();
    client.terminate();
    await expect(client.call('x')).rejects.toThrow('Worker terminated');
    await flushPromises();
    expect(received).toEqual([]);
  });

  it('clears timers of pending calls on terminate', async () => {
    const { client } = setup({ timeoutMs: 5000 });
    const p = client.call('x');
    const assertion = expect(p).rejects.toThrow('Worker terminated');
    client.terminate();
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('is safe to terminate twice', () => {
    const { client } = setup();
    client.terminate();
    expect(() => client.terminate()).not.toThrow();
  });
});
```

%% hints
- `pending = new Map<id, { resolve, reject, cleanup }>()`. `cleanup()` clears the timeout and removes the abort listener; every settle path calls it and deletes the entry.
- `port.onmessage = (e) => { const entry = pending.get(e.data.id); if (!entry) return; … }` gives you "ignore unknown ids" and "ignore duplicates" for free once you delete on settle.
- Create errors with a helper: `const e = new Error(msg); e.name = 'AbortError'`.
- For `terminate()`: copy the entries, clear the map, then reject each.

%% solution
```js
function makeError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function createWorkerClient(port, { timeoutMs = 0 } = {}) {
  let nextId = 1;
  let terminated = false;
  const pending = new Map();

  port.onmessage = (event) => {
    const msg = event.data;
    const entry = pending.get(msg?.id);
    if (!entry) return;
    pending.delete(msg.id);
    entry.cleanup();
    if (msg.type === 'result') entry.resolve(msg.result);
    else if (msg.type === 'error') entry.reject(makeError(msg.error?.name ?? 'Error', msg.error?.message ?? 'Worker error'));
  };

  return {
    call(method, args = [], { signal } = {}) {
      if (terminated) return Promise.reject(new Error('Worker terminated'));
      if (signal?.aborted) return Promise.reject(makeError('AbortError', 'Call aborted'));

      return new Promise((resolve, reject) => {
        const id = nextId++;
        let timer;
        let onAbort;

        const cleanup = () => {
          clearTimeout(timer);
          if (signal && onAbort) signal.removeEventListener('abort', onAbort);
        };
        const fail = (error) => {
          if (!pending.has(id)) return;
          pending.delete(id);
          cleanup();
          port.postMessage({ id, type: 'cancel' });
          reject(error);
        };

        pending.set(id, { resolve, reject, cleanup });

        if (signal) {
          onAbort = () => fail(makeError('AbortError', 'Call aborted'));
          signal.addEventListener('abort', onAbort);
        }
        if (timeoutMs > 0) {
          timer = setTimeout(() => fail(makeError('TimeoutError', `Call "${method}" timed out after ${timeoutMs}ms`)), timeoutMs);
        }

        port.postMessage({ id, type: 'call', method, args });
      });
    },
    terminate() {
      if (terminated) return;
      terminated = true;
      const entries = [...pending.values()];
      pending.clear();
      for (const entry of entries) {
        entry.cleanup();
        entry.reject(new Error('Worker terminated'));
      }
      port.close?.();
    },
  };
}
```

%% exercise prod-worker-server | Worker RPC server | 3 | js | js | createWorkerServer | 30
The other end of the protocol: the code that runs *inside* the worker. Build `createWorkerServer(port, handlers)`.

`handlers` maps method names to functions `(args, { signal }) => result | Promise<result>`.

- On `{ id, type: 'call', method, args }`: run the handler and post `{ id, type: 'result', result }`. If the method is unknown post `{ id, type: 'error', error: { name: 'Error', message: 'Unknown method "<method>"' } }`.
- If the handler throws or rejects, post `{ id, type: 'error', error: { name, message } }` (use the error's `name`/`message`).
- Each call receives its own `AbortSignal`. On `{ id, type: 'cancel' }` abort that call's signal. **A cancelled call never posts a response** (neither result nor error), even if the handler finishes anyway.
- Exactly **one** response per call. Unknown or finished ids in `cancel` are ignored. Malformed messages are ignored.
- Handlers for different calls run **concurrently**.
- Return `{ close() }`, which aborts every in-flight call, suppresses their responses, and detaches the port handler.

%% starter
```js
export function createWorkerServer(port, handlers) {
  // your code
}
```

%% tests
```js
function setup(handlers) {
  const [clientPort, serverPort] = createFakePorts();
  const responses = [];
  clientPort.onmessage = (e) => responses.push(e.data);
  const server = createWorkerServer(serverPort, handlers);
  const send = async (msg) => { clientPort.postMessage(msg); await flushPromises(); };
  return { server, responses, send };
}
const call = (id, method, args = []) => ({ id, type: 'call', method, args });

describe('createWorkerServer', () => {
  it('runs a sync handler and posts the result', async () => {
    const { responses, send } = setup({ add: ([a, b]) => a + b });
    await send(call(1, 'add', [2, 3]));
    expect(responses).toEqual([{ id: 1, type: 'result', result: 5 }]);
  });

  it('awaits async handlers', async () => {
    const { responses, send } = setup({ later: async ([x]) => { await Promise.resolve(); return x * 2; } });
    await send(call(1, 'later', [21]));
    expect(responses).toEqual([{ id: 1, type: 'result', result: 42 }]);
  });

  it('reports unknown methods', async () => {
    const { responses, send } = setup({});
    await send(call(7, 'nope'));
    expect(responses).toEqual([{ id: 7, type: 'error', error: { name: 'Error', message: 'Unknown method "nope"' } }]);
  });

  it('turns thrown and rejected errors into error responses', async () => {
    const { responses, send } = setup({
      sync: () => { throw new RangeError('too big'); },
      async: async () => { throw new TypeError('bad type'); },
    });
    await send(call(1, 'sync'));
    await send(call(2, 'async'));
    expect(responses).toEqual([
      { id: 1, type: 'error', error: { name: 'RangeError', message: 'too big' } },
      { id: 2, type: 'error', error: { name: 'TypeError', message: 'bad type' } },
    ]);
  });

  it('passes an AbortSignal and aborts it on cancel', async () => {
    let seenSignal;
    let finish;
    const { send } = setup({ slow: (args, { signal }) => { seenSignal = signal; return new Promise((r) => { finish = r; }); } });
    await send(call(1, 'slow'));
    expect(seenSignal.aborted).toBe(false);
    await send({ id: 1, type: 'cancel' });
    expect(seenSignal.aborted).toBe(true);
    finish('too late');
  });

  it('never responds to a cancelled call, even if the handler completes', async () => {
    let finish;
    const { responses, send } = setup({ slow: () => new Promise((r) => { finish = r; }) });
    await send(call(1, 'slow'));
    await send({ id: 1, type: 'cancel' });
    finish('result nobody wants');
    await flushPromises();
    expect(responses).toEqual([]);
  });

  it('suppresses errors from cancelled calls too', async () => {
    let fail;
    const { responses, send } = setup({ slow: () => new Promise((_, rej) => { fail = rej; }) });
    await send(call(1, 'slow'));
    await send({ id: 1, type: 'cancel' });
    fail(new Error('aborted'));
    await flushPromises();
    expect(responses).toEqual([]);
  });

  it('runs calls concurrently and answers each once', async () => {
    const resolvers = {};
    const { responses, send } = setup({ job: ([name]) => new Promise((r) => { resolvers[name] = r; }) });
    await send(call(1, 'job', ['a']));
    await send(call(2, 'job', ['b']));
    resolvers.b('B');
    await flushPromises();
    resolvers.a('A');
    await flushPromises();
    expect(responses).toEqual([
      { id: 2, type: 'result', result: 'B' },
      { id: 1, type: 'result', result: 'A' },
    ]);
  });

  it('cancelling one call does not affect others', async () => {
    const resolvers = {};
    const { responses, send } = setup({ job: ([name]) => new Promise((r) => { resolvers[name] = r; }) });
    await send(call(1, 'job', ['a']));
    await send(call(2, 'job', ['b']));
    await send({ id: 1, type: 'cancel' });
    resolvers.a('A'); resolvers.b('B');
    await flushPromises();
    expect(responses).toEqual([{ id: 2, type: 'result', result: 'B' }]);
  });

  it('ignores cancels for unknown or finished ids and malformed messages', async () => {
    const { responses, send } = setup({ ok: () => 'fine' });
    await send({ id: 99, type: 'cancel' });
    await send(call(1, 'ok'));
    await send({ id: 1, type: 'cancel' });
    await send({ hello: 'world' });
    await send(null);
    expect(responses).toEqual([{ id: 1, type: 'result', result: 'fine' }]);
  });

  it('close() aborts in-flight calls and silences their responses', async () => {
    let seenSignal, finish;
    const { server, responses, send } = setup({ slow: (a, { signal }) => { seenSignal = signal; return new Promise((r) => { finish = r; }); } });
    await send(call(1, 'slow'));
    server.close();
    expect(seenSignal.aborted).toBe(true);
    finish('x');
    await flushPromises();
    expect(responses).toEqual([]);
  });

  it('stops handling messages after close()', async () => {
    const handler = jest.fn(() => 1);
    const { server, responses, send } = setup({ h: handler });
    server.close();
    await send(call(1, 'h'));
    expect(handler).not.toHaveBeenCalled();
    expect(responses).toEqual([]);
  });

  it('does not treat inherited object properties as handlers', async () => {
    const { responses, send } = setup({});
    await send(call(1, 'constructor'));
    expect(responses[0].error.message).toBe('Unknown method "constructor"');
  });
});
```

%% hints
- `inFlight = new Map<id, AbortController>()`. Add on call, delete on settle or cancel.
- After a cancel, remember it: delete the controller from the map, and check `controller.signal.aborted` (or `inFlight.get(id) === controller`) *before* posting any response.
- `Promise.resolve().then(() => handler(args, { signal }))` turns a sync throw into a rejection so one code path handles both.
- Use `Object.hasOwn(handlers, method)` to reject inherited names like `constructor`.

%% solution
```js
export function createWorkerServer(port, handlers) {
  const inFlight = new Map();
  let closed = false;

  const respond = (message) => port.postMessage(message);

  port.onmessage = (event) => {
    if (closed) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'cancel') {
      const controller = inFlight.get(msg.id);
      if (controller) {
        inFlight.delete(msg.id);
        controller.abort();
      }
      return;
    }

    if (msg.type !== 'call') return;
    const { id, method, args = [] } = msg;

    if (!Object.hasOwn(handlers, method)) {
      respond({ id, type: 'error', error: { name: 'Error', message: `Unknown method "${method}"` } });
      return;
    }

    const controller = new AbortController();
    inFlight.set(id, controller);

    Promise.resolve()
      .then(() => handlers[method](args, { signal: controller.signal }))
      .then(
        (result) => {
          if (inFlight.get(id) !== controller) return;
          inFlight.delete(id);
          respond({ id, type: 'result', result });
        },
        (error) => {
          if (inFlight.get(id) !== controller) return;
          inFlight.delete(id);
          respond({ id, type: 'error', error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) } });
        },
      );
  };

  return {
    close() {
      closed = true;
      for (const controller of inFlight.values()) controller.abort();
      inFlight.clear();
      port.onmessage = null;
    },
  };
}
```

%% exercise prod-worker-pool | Worker pool with a queue | 3 | js | js | createWorkerPool | 30
Spawning a worker per call is wasteful. Build `createWorkerPool(createWorker, size)`.

`createWorker()` returns a client with `call(method, args, options)` → `Promise` and `terminate()` (like the client you wrote). The pool creates `size` clients **lazily** (only when work needs them, never more than `size`).

- `pool.call(method, args, options)` runs on an **idle** client; if all are busy the job waits in a **FIFO queue**. Each client runs **one job at a time**.
- When a job settles (success **or** failure), the client takes the next queued job. One job failing must not affect the others.
- `pool.stats()` → `{ workers, busy, idle, queued }`.
- `pool.terminate()` terminates every client, **rejects all queued jobs** with `Error('Pool terminated')`, and makes later `call`s reject the same way. Jobs already running are rejected by the client's own `terminate()`.
- Arguments (`args`, `options`) are passed through unchanged.

%% starter
```js
export function createWorkerPool(createWorker, size) {
  // your code
}
```

%% tests
```js
function fakeFactory() {
  const workers = [];
  const createWorker = jest.fn(() => {
    const w = { jobs: [], terminated: false };
    w.call = jest.fn((method, args, options) => new Promise((resolve, reject) => {
      w.jobs.push({ method, args, options, resolve, reject });
    }));
    w.terminate = jest.fn(() => { w.terminated = true; });
    workers.push(w);
    return w;
  });
  return { createWorker, workers };
}

describe('createWorkerPool', () => {
  it('creates workers lazily', () => {
    const { createWorker } = fakeFactory();
    const pool = createWorkerPool(createWorker, 3);
    expect(createWorker).not.toHaveBeenCalled();
    expect(pool.stats()).toEqual({ workers: 0, busy: 0, idle: 0, queued: 0 });
  });

  it('runs a job on a worker and resolves with its result', async () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 2);
    const p = pool.call('price', [1, 2], { signal: 'sig' });
    expect(workers[0].call).toHaveBeenCalledWith('price', [1, 2], { signal: 'sig' });
    workers[0].jobs[0].resolve(99);
    await expect(p).resolves.toBe(99);
  });

  it('spreads concurrent jobs over workers up to size', () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 2);
    pool.call('a'); pool.call('b'); pool.call('c');
    expect(workers).toHaveLength(2);
    expect(pool.stats()).toEqual({ workers: 2, busy: 2, idle: 0, queued: 1 });
  });

  it('runs at most one job per worker', () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 1);
    pool.call('a'); pool.call('b');
    expect(workers[0].call).toHaveBeenCalledTimes(1);
  });

  it('starts the next queued job (FIFO) when a worker frees up', async () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 1);
    const a = pool.call('a'), b = pool.call('b'), c = pool.call('c');
    workers[0].jobs[0].resolve('A');
    await a;
    expect(workers[0].call.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    workers[0].jobs[1].resolve('B');
    await b;
    expect(workers[0].call.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']);
    workers[0].jobs[2].resolve('C');
    await expect(c).resolves.toBe('C');
    expect(pool.stats()).toEqual({ workers: 1, busy: 0, idle: 1, queued: 0 });
  });

  it('reuses an idle worker before creating a new one', async () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 3);
    const a = pool.call('a');
    workers[0].jobs[0].resolve(1);
    await a;
    pool.call('b');
    expect(workers).toHaveLength(1);
    expect(workers[0].call).toHaveBeenCalledTimes(2);
  });

  it('a failing job rejects only its own promise and frees the worker', async () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 1);
    const a = pool.call('a'), b = pool.call('b');
    const failure = expect(a).rejects.toThrow('boom');
    workers[0].jobs[0].reject(new Error('boom'));
    await failure;
    await Promise.resolve();
    expect(workers[0].call).toHaveBeenCalledTimes(2);
    workers[0].jobs[1].resolve('B');
    await expect(b).resolves.toBe('B');
  });

  it('terminate() terminates workers and rejects queued jobs', async () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 1);
    pool.call('running').catch(() => {});
    const queued = pool.call('queued');
    const assertion = expect(queued).rejects.toThrow('Pool terminated');
    pool.terminate();
    await assertion;
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects calls after terminate()', async () => {
    const { createWorker } = fakeFactory();
    const pool = createWorkerPool(createWorker, 2);
    pool.terminate();
    await expect(pool.call('x')).rejects.toThrow('Pool terminated');
    expect(createWorker).not.toHaveBeenCalled();
  });

  it('does not start queued jobs after terminate() when a running job settles', async () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 1);
    const running = pool.call('running');
    const queued = pool.call('queued');
    queued.catch(() => {});
    pool.terminate();
    workers[0].jobs[0].resolve('done');
    await running;
    await Promise.resolve();
    expect(workers[0].call).toHaveBeenCalledTimes(1);
  });

  it('handles a burst of 1000 jobs on 4 workers in order', async () => {
    const { createWorker, workers } = fakeFactory();
    const pool = createWorkerPool(createWorker, 4);
    const results = Array.from({ length: 1000 }, (_, i) => pool.call('job', [i]));
    expect(workers).toHaveLength(4);
    let done = 0;
    while (done < 1000) {
      for (const w of workers) {
        const job = w.jobs.find((j) => !j.done);
        if (job) { job.done = true; job.resolve(job.args[0] * 2); done++; }
      }
      await Promise.resolve();
    }
    await expect(Promise.all(results)).resolves.toEqual(Array.from({ length: 1000 }, (_, i) => i * 2));
  });
});
```

%% hints
- State: `clients` (array of `{ client, busy }`), `queue` (array of jobs `{ method, args, options, resolve, reject }`), `terminated`.
- `dispatch()`: while the queue is non-empty, find an idle client — or create one if `clients.length < size` — and start the head job on it.
- `run(entry, job)`: mark busy, `entry.client.call(...)`, then in `finally` mark idle and call `dispatch()` again.
- Use an index pointer or `shift()`; either is fine at this scale.
- After `terminate()`, `dispatch()` must do nothing.

%% solution
```js
export function createWorkerPool(createWorker, size) {
  const clients = [];
  const queue = [];
  let terminated = false;

  function dispatch() {
    while (!terminated && queue.length > 0) {
      let entry = clients.find((c) => !c.busy);
      if (!entry && clients.length < size) {
        entry = { client: createWorker(), busy: false };
        clients.push(entry);
      }
      if (!entry) return;
      run(entry, queue.shift());
    }
  }

  function run(entry, job) {
    entry.busy = true;
    let promise;
    try {
      promise = Promise.resolve(entry.client.call(job.method, job.args, job.options));
    } catch (err) {
      promise = Promise.reject(err);
    }
    // Free the worker and start the next job *before* resolving the caller, so it never observes an idle-but-unused worker.
    const release = () => {
      entry.busy = false;
      dispatch();
    };
    promise.then(
      (value) => {
        release();
        job.resolve(value);
      },
      (error) => {
        release();
        job.reject(error);
      },
    );
  }

  return {
    call(method, args, options) {
      if (terminated) return Promise.reject(new Error('Pool terminated'));
      return new Promise((resolve, reject) => {
        queue.push({ method, args, options, resolve, reject });
        dispatch();
      });
    },
    stats() {
      const busy = clients.filter((c) => c.busy).length;
      return { workers: clients.length, busy, idle: clients.length - busy, queued: queue.length };
    },
    terminate() {
      if (terminated) return;
      terminated = true;
      for (const { client } of clients) client.terminate();
      for (const job of queue.splice(0)) job.reject(new Error('Pool terminated'));
    },
  };
}
```
