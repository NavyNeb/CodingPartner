---
id: prod-workers
track: prod
title: Case study: cash-out on the main thread
summary: A 400 ms calculation runs on every price tick and scrolling turns to sludge. Move it to a Web Worker — with request ids, cancellation, timeouts and a pool.
---

> **INCIDENT — "The cash-out screen janks."** The cash-out panel re-prices ~300 open positions on every odds tick (correlated markets, a few thousand simulated paths each). Profile: a single **400 ms long task** per update, 3–5 times a second. Scrolling and typing stutter; INP p75 = **780 ms**. The maths can't be made 10× faster — but it doesn't need to run on the UI thread.

## The idea in one sentence

If a job is **heavy and independent of the screen**, run it on **another thread** (a Web Worker) and **talk to it with messages**, so the page stays responsive.

> **Analogy** The main thread is a **waiter** who must always be free to take your order. A worker is a **kitchen** in the back. The waiter hands over an **order slip with a number** (`id`), keeps serving other tables, and when the kitchen finishes, it sends the dish back with the **same number**. The waiter can also shout "**cancel order 7**" — but only a kitchen that glances at the order rail between tasks will hear it.

## Workers in one minute

A **Web Worker** runs JavaScript on a **separate thread** with its own global scope (no DOM). You talk to it with `postMessage`; data is **copied** using the *structured clone* algorithm (or **transferred** for `ArrayBuffer`s — zero-copy, but the sender loses access — or shared with `SharedArrayBuffer`).

**Worth it when** a task is CPU-bound and over ~50 ms: parsing/normalising huge payloads, big sorts/diffs, crypto/hashing, image/audio processing, simulations. **Not worth it** for small tasks — serialising the arguments and result can cost more than the work.

```js try
// postMessage copies data (structured clone): the receiver gets its OWN object.
const original = { odds: [2.1, 3.4], nested: { ok: true } };
const copy = structuredClone(original);

copy.odds.push(9.9);
console.log('original:', original.odds, '| copy:', copy.odds);
// Functions, DOM nodes and class instances with methods can't be cloned — send plain data.
```

**Costs and gotchas**

- Cloning a huge object graph **blocks the sender** while it copies. Send compact data (typed arrays, ids) and transfer buffers.
- Startup takes a few ms and memory — **reuse** workers (a *pool*), don't spawn one per call.
- **A worker only reads its inbox between tasks.** In a synchronous 400 ms loop it can't see a "cancel" message. Long jobs must be **chunked with yields**, or check a flag.
- Errors don't bubble by themselves; they must be **turned into messages**.
- **Leaks:** a worker lives until you `terminate()` it.

![A worker in one long synchronous loop cannot see cancel; a chunked job sees it between chunks](fig:cooperative-cancel "Cancellation in workers is cooperative: the job has to look.")

## `postMessage` is not an API — build one

Raw messages have no return values. The standard layer is **RPC over `postMessage`**:

```
client → worker   { id: 7, type: 'call', method: 'price', args: [...] }
worker → client   { id: 7, type: 'result', result: ... }
                  { id: 7, type: 'error',  error: { name, message } }
client → worker   { id: 7, type: 'cancel' }
```

![The main thread and worker exchange call, result, error and cancel messages matched by id](fig:worker-rpc "Correlation ids let many calls be in flight and answered out of order.")

Watch the client side keep track of calls:

```stepper Matching answers to questions by id
code:
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  port.postMessage({ id, type: 'call', method, args });
  // … later …
  port.onmessage = (e) => pending.get(e.data.id)?.resolve(e.data.result);
---
line: 1-3
say: **Call A** (`price`): give it id `1`, remember its `resolve`/`reject` functions in a `Map`, and send the message. The call returns a promise right away.
Pending calls: 1 (price)
Messages sent: { id: 1, call price }
Settled:
---
line: 1-3
say: **Call B** (`risk`) is started before A finishes: id `2`. Both are in flight at once.
Pending calls: 1 (price) | 2 (risk)
Messages sent: { id: 1, call price } | { id: 2, call risk }
---
line: 5
say: The worker answers **B first** (it was quicker). We look up id `2` in the map and resolve *that* promise. Order doesn't matter — ids match answers to questions.
Pending calls: 1 (price)
Settled: 2 (risk) ✓
---
line: 5
say: Now A's answer arrives and resolves promise `1`. Anything with an **unknown id** (already cancelled, timed out) is simply ignored.
Pending calls:
Settled: 2 (risk) ✓ | 1 (price) ✓
```

Design points — each is a bug if you skip it:

1. **Correlation ids** so concurrent calls match answers, even out of order.
2. **Cancellation** — the client stops waiting *and* tells the worker; the worker aborts cooperatively and **suppresses** the reply. Late replies for cancelled ids are ignored.
3. **Timeouts** — a hung worker must not hang your UI.
4. **Termination** rejects everything pending (never leave promises dangling) and refuses new calls.
5. **Latest-wins** — if calls arrive faster than they finish (ticks every 100 ms, jobs taking 400 ms), don't queue them all: cancel the stale one and keep the latest. (You built `latest()` earlier.)
6. A **pool** of N workers bounds concurrency to the number of cores instead of spawning unbounded work.

Here's the heart of it in a few lines, using two tiny fake "ports" so it runs right here:

```js try
// Two connected fake ports: a message posted on one arrives on the other, asynchronously.
function createPorts() {
  const a = { postMessage: (m) => queueMicrotask(() => b.onmessage?.({ data: m })) };
  const b = { postMessage: (m) => queueMicrotask(() => a.onmessage?.({ data: m })) };
  return [a, b];
}
const [clientPort, workerPort] = createPorts();

// "Worker" side: answer calls
workerPort.onmessage = ({ data }) => {
  if (data.type === 'call') workerPort.postMessage({ id: data.id, type: 'result', result: data.args[0] * 2 });
};

// Client side: ids + pending map
let nextId = 0;
const pending = new Map();
clientPort.onmessage = ({ data }) => { pending.get(data.id)?.(data.result); pending.delete(data.id); };
const call = (method, args) => new Promise((resolve) => {
  const id = ++nextId;
  pending.set(id, resolve);
  clientPort.postMessage({ id, type: 'call', method, args });
});

Promise.all([call('double', [21]), call('double', [5])]).then((r) => console.log('results:', r));
```

[Comlink](https://github.com/GoogleChromeLabs/comlink) is this same pattern wrapped in Proxy sugar.

## A pool: bounded concurrency

![A queue of jobs feeding two workers; when one finishes, it takes the next job](fig:pool-queue "Create workers lazily, never more than `size`; each runs one job at a time; queue the rest in FIFO order.")

## Related tools

- `scheduler.yield()` / time slicing — for work that must touch the DOM or share state.
- `OffscreenCanvas` — render in a worker.
- **SharedWorker** — one worker shared by all tabs of an origin (a natural home for a single WebSocket).
- **Service Worker** — a network proxy, cache and push handler; a different job.

## Testing without real workers

Real workers need a browser. But everything above is *protocol logic*, so we test it against **fake ports**: `createFakePorts()` gives you two entangled `MessagePort`-like objects with asynchronous delivery, just like `new MessageChannel()`.

## Quick check

```check
Q: Why are ids needed in worker messages?
A) To encrypt the messages
B) To match responses to calls when several are in flight, possibly out of order *
C) Workers require them
D) To limit the number of calls
Why: Messages have no return values. The id is the only link between a question and its answer.
---
Q: A worker is stuck in a 400 ms synchronous loop. What happens to a "cancel" message?
A) It is processed immediately
B) It kills the worker
C) It waits in the inbox until the loop finishes, unless the job yields/checks a flag *
D) It is lost forever
Why: A worker reads messages between tasks. Long jobs must be chunked or check a shared flag/signal.
---
Q: When is a Web Worker NOT worth using?
A) For CPU-heavy work over ~50ms
B) For parsing big payloads
C) For image processing
D) For tiny tasks where copying the data costs more than the work *
Why: Messages are copied (structured clone). For small jobs the overhead exceeds the gain.
---
Q: What should happen to pending calls when you `terminate()` the worker?
A) They stay pending forever
B) They are rejected, and later calls are refused *
C) They are retried
D) They resolve with `undefined`
Why: Dangling promises hide bugs. Reject them all and refuse new work.
---
Q: Why use a pool instead of creating a worker for each call?
A) Workers can't be created more than once
B) Pools are required by the spec
C) Startup costs time and memory; a pool reuses workers and caps concurrency *
D) It makes messages smaller
Why: Reusing a fixed number of workers avoids constant startup cost and runaway parallelism.
```

## Recap

- Move **heavy, independent** work to a **Worker**; talk with `postMessage` (data is **copied**; buffers can be **transferred**).
- Build **RPC**: ids, result/error messages, **cancellation**, **timeouts**, **termination** that rejects pending calls.
- Workers cancel **cooperatively**: chunk the work, check a signal.
- **Pool** workers (lazy, FIFO queue, one job per worker); **latest-wins** for fast tick streams.
- Test protocol logic with **fake ports**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a tiny RPC caller | The stepper and the fake-ports snippet |
| Worker RPC client | Pending `Map`, abort/timeout handling, `terminate()` |
| Worker RPC server | The message protocol, per-call `AbortSignal`, suppressing cancelled replies |
| Worker pool with a queue | The pool figure: lazy creation, FIFO queue, stats, terminate |

%% exercise prod-guided-caller | Guided: a tiny RPC caller | 1 | js | js | createCaller | 8 | guided
Write `createCaller(post)` — the smallest useful RPC client. It returns `{ call(method, args), receive(message) }`.

- `call(method, args)` gives the call the **next id** (starting at `1`), posts `{ id, type: 'call', method, args }` using `post(...)`, and returns a promise.
- `receive(message)` is called with messages coming **back**:
  - `{ id, type: 'result', result }` → resolve the promise for that id with `result`.
  - `{ id, type: 'error', error: { name, message } }` → reject it with an `Error` having that `name` and `message`.
  - Messages with an **unknown id** are ignored.

%% worked
**A similar problem, solved: a "request/response" helper for a chat server.**

```js
function createAsker(send) {
  let nextId = 0;
  const waiting = new Map();                              // ① id → { resolve, reject }

  return {
    ask(question) {
      const id = ++nextId;                                // ② unique, increasing ids
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });             // ③ remember HOW to settle this promise later
        send({ id, question });
      });
    },
    onReply(reply) {
      const entry = waiting.get(reply.id);
      if (!entry) return;                                 // ④ unknown id → ignore
      waiting.delete(reply.id);                           // ⑤ forget it (settled calls release their memory)
      entry.resolve(reply.answer);
    },
  };
}
```

A promise is settled by calling its `resolve`/`reject`, which only exist *inside* the `new Promise` callback — so stash them in a `Map` under the id, and call them when the matching reply arrives.

%% explain
- **Ids** start at 1 and increase by 1 per call.
- **`post`** receives `{ id, type: 'call', method, args }`.
- **Results** resolve the matching promise; **errors** reject with an `Error` carrying the given `name` and `message`.
- **Unknown ids** are ignored; answers can arrive **out of order**.

%% nudge
- Where do you keep `resolve` and `reject` so `receive` can reach them later?
- What should you do with the map entry once the call is settled?

%% starter
```js
export function createCaller(post) {
  let nextId = 0;
  const pending = new Map();
  return {
    call(method, args) {
      // Step 1 — const id = ++nextId;
      // Step 2 — return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); post({ id, type: 'call', method, args }); });
      return Promise.resolve();
    },
    receive(message) {
      // Step 3 — look up pending.get(message.id); if there is none, return.
      // Step 4 — delete it; then resolve(message.result) for 'result',
      //          or reject(Object.assign(new Error(message.error.message), { name: message.error.name })) for 'error'.
    },
  };
}
```

%% tests
```js
describe('createCaller', () => {
  it('posts numbered call messages', () => {
    const sent = [];
    const caller = createCaller((m) => sent.push(m));
    caller.call('price', [1, 2]);
    caller.call('risk', []);
    expect(sent).toEqual([
      { id: 1, type: 'call', method: 'price', args: [1, 2] },
      { id: 2, type: 'call', method: 'risk', args: [] },
    ]);
  });

  it('resolves the matching call, even out of order', async () => {
    const caller = createCaller(() => {});
    const a = caller.call('a', []);
    const b = caller.call('b', []);
    caller.receive({ id: 2, type: 'result', result: 'B' });
    caller.receive({ id: 1, type: 'result', result: 'A' });
    expect(await a).toBe('A');
    expect(await b).toBe('B');
  });

  it('rejects with an Error carrying name and message', async () => {
    const caller = createCaller(() => {});
    const p = caller.call('x', []);
    caller.receive({ id: 1, type: 'error', error: { name: 'RangeError', message: 'bad input' } });
    await expect(p).rejects.toMatchObject({ name: 'RangeError', message: 'bad input' });
  });

  it('ignores unknown ids', () => {
    const caller = createCaller(() => {});
    expect(() => caller.receive({ id: 99, type: 'result', result: 1 })).not.toThrow();
  });
});
```

%% hints
- Promise executors run immediately, so `pending.set(...)` and `post(...)` can both go inside `new Promise(...)`.
- Use the entry's `resolve` or `reject`, then `pending.delete(id)`.

%% solution
```js
export function createCaller(post) {
  let nextId = 0;
  const pending = new Map();
  return {
    call(method, args) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        post({ id, type: 'call', method, args });
      });
    },
    receive(message) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.type === 'result') entry.resolve(message.result);
      else entry.reject(Object.assign(new Error(message.error.message), { name: message.error.name }));
    },
  };
}
```

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

%% worked
**Build on the guided caller: each extra feature is "settle once, and clean up".** The key helper is a single `settle` that guarantees a call finishes **exactly once** and releases its timer and listener:

```js
function call(method, args, { signal } = {}) {
  if (signal?.aborted) return Promise.reject(abortError());        // ① already aborted → reject NOW and post NOTHING

  const id = ++nextId;
  return new Promise((resolve, reject) => {
    let timer, onAbort;

    const entry = {
      settle(fn, value) {                                          // ② the ONE place a call finishes
        if (!pending.delete(id)) return;                           //    already settled? do nothing
        clearTimeout(timer);                                       // ③ release the timer…
        signal?.removeEventListener('abort', onAbort);             //    …and the abort listener
        fn(value);
      },
    };
    pending.set(id, entry);

    if (signal) {
      onAbort = () => { entry.settle(reject, abortError()); port.postMessage({ id, type: 'cancel' }); };   // ④ tell the worker too
      signal.addEventListener('abort', onAbort);
    }
    if (timeoutMs > 0) timer = setTimeout(() => {
      entry.settle(reject, timeoutError(method, timeoutMs));
      port.postMessage({ id, type: 'cancel' });
    }, timeoutMs);

    port.postMessage({ id, type: 'call', method, args });
  });
}
```

Errors need the right **names**: `Object.assign(new Error(msg), { name: 'AbortError' })`. `terminate()` loops over `pending`, rejecting each with `Error('Worker terminated')`, calls `port.close?.()`, and sets a flag so later `call`s reject immediately. The response handler looks up the id and calls `entry.settle(resolve | reject, …)` — unknown/late ids are simply not found.

%% explain
- **Ids** are unique and increase from 1; responses are matched by id in any order; unknown ids are ignored.
- **`error` responses** reject with an `Error` having the payload's `name` and `message`.
- **Abort** while pending → reject with `AbortError`, post `{ id, type: 'cancel' }`, ignore late responses; an **already-aborted** signal rejects immediately and posts **nothing**.
- **Timeout** (`timeoutMs > 0`) → reject with `TimeoutError` (`Call "<method>" timed out after <ms>ms`) and post a cancel.
- **Settled calls release** their timer and abort listener.
- **`terminate()`** rejects every pending call with `Error('Worker terminated')`, calls `port.close?.()`, and later calls reject the same way.

%% nudge
- How can you make sure a call can't settle twice (e.g. a timeout *and* a late result)?
- What must you clean up when a call settles for any reason?

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

%% worked
**A similar problem, solved: a server for one method, with per-call cancellation.**

```js
function createMiniServer(port, handler) {
  const running = new Map();                                        // id → AbortController

  port.onmessage = async ({ data }) => {
    if (!data || typeof data.id !== 'number') return;               // ① ignore malformed messages

    if (data.type === 'cancel') { running.get(data.id)?.abort(); return; }   // ② abort THAT call's signal
    if (data.type !== 'call') return;

    const controller = new AbortController();
    running.set(data.id, controller);
    try {
      const result = await handler(data.args, { signal: controller.signal });   // ③ each call gets its own signal
      if (!controller.signal.aborted) port.postMessage({ id: data.id, type: 'result', result });   // ④ a cancelled call NEVER replies
    } catch (err) {
      if (!controller.signal.aborted) port.postMessage({ id: data.id, type: 'error', error: { name: err.name, message: err.message } });
    } finally {
      running.delete(data.id);                                      // ⑤ forget finished calls (so late cancels are ignored)
    }
  };

  return { close() { running.forEach((c) => c.abort()); running.clear(); port.onmessage = null; } };   // ⑥ abort everything, detach
}
```

For the real server, look the handler up by `method` (unknown → an `Error('Unknown method "<method>"')` response), let **calls run concurrently** (don't `await` one before starting the next — each message handler is its own async function), and post **exactly one** response per call. After `close()`, in-flight handlers that finish later must also stay silent (their signals are aborted).

%% explain
- **`call`**: run the handler, post `{ id, type: 'result', result }`; unknown method → error `Unknown method "<method>"`.
- **Handler throws/rejects** → `{ id, type: 'error', error: { name, message } }`.
- **Each call gets its own `AbortSignal`**; `cancel` aborts it; **a cancelled call never replies** (even if the handler finishes).
- **Exactly one response per call**; unknown/finished ids in `cancel` and malformed messages are ignored.
- **Calls run concurrently.** **`close()`** aborts all in-flight calls, suppresses their replies, and detaches the port handler.

%% nudge
- How do you know, at the moment a handler finishes, whether its call was cancelled?
- Where do you keep the per-call abort controllers so `cancel` and `close()` can find them?

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

%% worked
**A similar problem, solved: a limiter that runs at most `n` jobs at once** — the same queue logic a pool needs.

```js
function createLimiter(n) {
  let active = 0;
  const queue = [];                                     // FIFO: first in, first out

  function next() {
    while (active < n && queue.length > 0) {
      const job = queue.shift();                        // ① oldest job first
      active += 1;
      Promise.resolve()
        .then(job.run)
        .then(job.resolve, job.reject)                  // ② success OR failure settles the caller's promise…
        .finally(() => { active -= 1; next(); });       // ③ …and ALWAYS frees the slot and starts the next job
    }
  }

  return function run(fn) {
    return new Promise((resolve, reject) => { queue.push({ run: fn, resolve, reject }); next(); });
  };
}
```

A worker pool is the same thing, except a "slot" is a **specific client** (`createWorker()` result). Keep an array of clients and a parallel `busy` set: to start a job, pick an idle client or — if fewer than `size` exist — **create one lazily**; otherwise queue. When a job settles (either way), mark that client idle and pull the next queued job for it. `stats()` reports counts; `terminate()` calls `terminate()` on every client, rejects everything still queued with `Error('Pool terminated')`, and sets a flag so later `call`s reject the same way.

%% explain
- **Lazy creation**: clients are created only when needed, never more than `size`.
- **`call`** runs on an idle client; otherwise waits in a **FIFO** queue. Each client runs **one job at a time**.
- **When a job settles** (success or failure) the client takes the next queued job; one failure never affects others.
- **`stats()`** → `{ workers, busy, idle, queued }`.
- **`terminate()`** terminates every client, rejects queued jobs with `Error('Pool terminated')`, and later calls reject the same way. Arguments pass through unchanged.

%% nudge
- When does a slot become free — only on success, or on failure too?
- How do you decide between "use an idle client", "create a new one" and "queue"?

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
