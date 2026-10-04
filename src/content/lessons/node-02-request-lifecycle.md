---
id: node-request-lifecycle
track: node
title: The request lifecycle
summary: What happens between a request arriving and a response leaving: middleware, guards, interceptors, pipes, the handler and exception filters, the order they run in, and what each one is for.
---

## The idea in one sentence

A backend handles every request the same way: a fixed **pipeline of stages**, each with **one job**, so the **handler** itself only contains business logic.

> **Analogy** A hospital visit. Reception logs you in (middleware), a nurse checks you're allowed in this ward (guard), a monitor times the whole visit (interceptor), triage cleans up your form and rejects nonsense (pipe), the doctor treats you (handler), and if anything goes wrong a duty manager decides what to tell you (exception filter).

*(In NestJS these are exactly: middleware, guards, interceptors, pipes, the controller handler and exception filters, in that order. You will build the machinery yourself.)*

## The order

![The request lifecycle](fig:nd-lifecycle "Memorise it as M G I P H: middleware, guards, interceptors, pipes, handler.")

| Stage | Job | Typical examples |
| --- | --- | --- |
| **Middleware** | Runs first, sees the raw request; can modify it or answer early | logging, request ids, cookies, CORS |
| **Guard** | Yes/no: *may this request continue?* | authentication, roles, rate limits |
| **Interceptor** | Wraps the rest: code **before** and **after**, can change the result | timing, caching, response mapping, timeouts |
| **Pipe** | Transforms and validates the handler's **input** | parse `"42"` to `42`, reject bad ids, defaults |
| **Handler** | The actual business logic | fetch the user, create the order |
| **Exception filter** | Turns a thrown error into a response | `404` for not-found, `500` generic otherwise |

Two things interviewers like to hear: **guards come before interceptors and pipes** (so a denied request does no work), and **interceptors wrap the handler** (so they can see the result and the error), while **pipes run inside** that wrapper.

```stepper One request, in order
code:
  middleware   logger          → sees the raw request
  guard        isAuthenticated → allowed? else 403
  interceptor  timing          → starts the clock, calls next()
  pipe         parseIntParam   → "42" becomes 42 (or 400)
  handler      getUser(42)     → returns the user
  interceptor  timing          → stops the clock
  middleware   logger          → records the final status
---
line: 1
say: **Middleware** goes first. It can attach a request id, parse cookies, or even answer the request itself and stop the pipeline.
phase: request in
---
line: 2
say: The **guard** decides yes or no. If it says no, a `403` is produced and **nothing after this runs**: no timing, no parsing, no handler.
phase: gate
---
line: 3
say: The **interceptor** starts its stopwatch, then calls `next()`: everything inside happens during that call.
phase: wrap begins
---
line: 4
say: The **pipe** converts the path parameter `"42"` to the number `42`. If it were `"abc"` the pipe throws a `400` and the handler never runs.
phase: input cleaned
---
line: 5
say: The **handler** receives clean, typed arguments and just does its job.
phase: handler
---
line: 6
say: Back out: the interceptor's **after** half runs now, in **reverse** order of the "before" half. It could transform the result, record the duration, or log an error.
phase: wrap ends
---
line: 7
say: Finally the middleware sees the finished response (status and all) on the way out.
phase: response out
```

## Interceptors wrap the call

![Interceptors as an onion](fig:nd-interceptors "Before runs in order, after runs in reverse; skipping next() skips everything inside.")

An interceptor is `(ctx, next) => result`. Calling `next()` runs everything inside it. Because it is a **wrapper**, one function can do something before, something after, **change the result**, **skip the call** (a cache hit), or **catch** the error.

```js try predict
const timing = (log) => async (ctx, next) => {
  log('before');
  try { return await next(); } finally { log('after'); }
};
const cache = (store) => async (ctx, next) => {
  if (store.has(ctx.id)) return store.get(ctx.id);       // skip the rest entirely
  const value = await next();
  store.set(ctx.id, value);
  return value;
};

const log = [];
const store = new Map();
const handler = async () => { log.push('handler'); return 'result'; };
const run = (ctx) => timing((m) => log.push(m))(ctx, () => cache(store)(ctx, handler));

run({ id: 1 })
  .then(() => run({ id: 1 }))
  .then(() => console.log(log.join(' > ')));
```

## Errors and exception filters

![Errors become responses](fig:nd-errors "Handlers throw. One place maps errors to HTTP responses.")

Handlers shouldn't build error responses by hand. They **throw**; **exception filters** catch and map: a known HTTP error keeps its status (`404 Not Found`), anything unknown becomes a generic **500** and the real message is **logged**, never returned (it may contain SQL, paths or secrets).

## Quick check

```check
Q: In what order do the stages run on the way in?
A) Pipes, guards, middleware, interceptors, handler
B) Middleware, guards, interceptors, pipes, handler *
C) Guards, middleware, pipes, interceptors, handler
D) Interceptors, middleware, guards, handler, pipes
Why: Raw-request work first, then permission, then wrappers, then input shaping.
---
Q: A guard returns false. What happens to the interceptors and the handler?
A) They still run
B) They never run: a 403 is returned *
C) Only the handler runs
D) Only the interceptors run
Why: Guards run before interceptors and pipes, so a denied request does no work.
---
Q: What can an interceptor do that a pipe cannot?
A) Validate input
B) Wrap the call: run code before and after, change the result, or skip the handler *
C) Throw errors
D) Read the request
Why: An interceptor surrounds the handler call; a pipe only reshapes the input.
---
Q: Where should an unexpected database error's message go?
A) In the response body for debugging
B) In the server log; the client gets a generic 500 *
C) In a cookie
D) Nowhere
Why: Internal messages can leak secrets and structure.
---
Q: Which stage is the right place to turn the string "42" into the number 42?
A) A guard
B) A pipe *
C) An exception filter
D) The database
Why: Pipes transform and validate handler input.
```

## Recap

- **M G I P H**: middleware, guards, interceptors, pipes, handler; **exception filters** handle any thrown error.
- **Middleware** touches the raw request; **guards** decide yes/no; **interceptors** wrap with before/after; **pipes** reshape input.
- Interceptors nest like an onion: **before in order, after in reverse**; they can cache, time, map or recover.
- **Throw** from handlers; **filters** map errors to responses; unknown errors are **generic 500s**, logged.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a tiny middleware app | A recursive `next()` and a 404 fallback |
| The full lifecycle | Reducing middleware and interceptors into nested calls; guards; pipes; filters |
| Interceptors | Timeouts, caching with a clock, result mapping, logging |
| Pipes | Parsing, defaults, clamping, rejecting with a 400 |
| Exception filters | First match wins, safe defaults, never leaking messages |
| Tests for a lifecycle | Call-order traces that expose swapped stages |

%% exercise nod-guided-middleware | Guided: a tiny middleware app | 1 | js | js | createApp | 8 | guided
Implement `createApp()` in the style of Express:

- `use(fn)` registers a middleware `fn(req, res, next)` and returns the app.
- `handle(req)` runs the middleware **in order** with a fresh `res` of `{ status: 200, body: undefined }` and returns `res`. Calling `next()` runs the next middleware; **not** calling it stops the chain.
- If the chain finishes and `res.body` is still `undefined`, set `res.status = 404` and `res.body = 'Not Found'`.

```js
const app = createApp().use((req, res) => { res.body = 'hi ' + req.name; });
app.handle({ name: 'Ada' }); // { status: 200, body: 'hi Ada' }
```

%% worked
**A similar problem, solved: `createChain()` of steps** — a recursive `next` that moves an index forward.

```js
function createChain() {
  const steps = [];
  return {
    add(fn) { steps.push(fn); return this; },
    run(input) {
      const out = { log: [] };
      const next = (i) => () => { if (i < steps.length) steps[i](input, out, next(i + 1)); };   // ① next(i) runs step i and gives it next(i + 1)
      next(0)();
      return out;
    },
  };
}
```

`next(i + 1)` is created **lazily** when step `i` is about to run, so a step that doesn't call `next` simply ends the chain. Handle the "nothing answered" case **after** the chain returns.

%% explain
- **A recursive `next(i)`** runs middleware `i`.
- **Stopping** = not calling `next`.
- **404 fallback** if no body was set when the chain ends.

%% nudge
- How does each middleware get a `next` that runs the following one?
- When do you check whether a body was set?

%% starter
```js
export function createApp() {
  const stack = [];
  const app = {
    use(fn) { return app; },
    handle(req) {
      const res = { status: 200, body: undefined };
      return res;
    },
  };
  return app;
}
```

%% tests
```js
describe('createApp', () => {
  it('runs middleware in order', () => {
    const order = [];
    const app = createApp()
      .use((req, res, next) => { order.push('a'); next(); })
      .use((req, res, next) => { order.push('b'); next(); })
      .use((req, res) => { order.push('c'); res.body = 'done'; });
    expect(app.handle({})).toEqual({ status: 200, body: 'done' });
    expect(order).toEqual(['a', 'b', 'c']);
  });
  it('lets middleware change the request and response', () => {
    const app = createApp()
      .use((req, res, next) => { req.name = req.name.toUpperCase(); next(); })
      .use((req, res) => { res.status = 201; res.body = 'hi ' + req.name; });
    expect(app.handle({ name: 'Ada' })).toEqual({ status: 201, body: 'hi ADA' });
  });
  it('stops when next is not called', () => {
    const later = jest.fn();
    const app = createApp()
      .use((req, res) => { res.status = 401; res.body = 'denied'; })
      .use(later);
    expect(app.handle({})).toEqual({ status: 401, body: 'denied' });
    expect(later).not.toHaveBeenCalled();
  });
  it('answers 404 when nobody sets a body', () => {
    expect(createApp().handle({})).toEqual({ status: 404, body: 'Not Found' });
    const app = createApp().use((req, res, next) => next());
    expect(app.handle({})).toEqual({ status: 404, body: 'Not Found' });
  });
  it('gives each request a fresh response', () => {
    const app = createApp().use((req, res) => { res.body = req.id; });
    expect(app.handle({ id: 1 }).body).toBe(1);
    expect(app.handle({ id: 2 }).body).toBe(2);
  });
  it('keeps apps independent', () => {
    const a = createApp().use((req, res) => { res.body = 'a'; });
    const b = createApp();
    expect(b.handle({}).status).toBe(404);
    expect(a.handle({}).body).toBe('a');
  });
});
```

%% hints
- `const run = (i) => () => { if (i < stack.length) stack[i](req, res, run(i + 1)); }; run(0)();`
- After running: `if (res.body === undefined) { res.status = 404; res.body = 'Not Found'; }`

%% solution
```js
export function createApp() {
  const stack = [];
  const app = {
    use(fn) {
      stack.push(fn);
      return app;
    },
    handle(req) {
      const res = { status: 200, body: undefined };
      const run = (i) => () => {
        if (i < stack.length) stack[i](req, res, run(i + 1));
      };
      run(0)();
      if (res.body === undefined) {
        res.status = 404;
        res.body = 'Not Found';
      }
      return res;
    },
  };
  return app;
}
```

%% exercise nod-lifecycle | The full request lifecycle | 4 | js | js | createLifecycle, HttpError, ForbiddenError, BadRequestError, NotFoundError | 48
Implement `createLifecycle({ middleware = [], guards = [], interceptors = [], pipes = [], filters = [] })` returning `{ handle(request, handler) }`, and the error classes.

- `HttpError(status, message)` is an `Error` with `status`; `ForbiddenError` (`403`, `'Forbidden'`), `NotFoundError` (`404`, `'Not Found'`) and `BadRequestError(message = 'Bad Request')` (`400`) extend it.
- `handle(request, handler)` is async and returns `{ status, body }`. Stages run **in this order**: **middleware** (outermost), **guards**, **interceptors** (nested around pipes and the handler), **pipes**, **handler**.
  - **Middleware** `(req, next)`: calls `next(req2?)` (with no argument it passes the same request) and **returns the response**; it may return its own response without calling `next`, or change the response it gets back. The first middleware is outermost.
  - **Guards** `(ctx) => boolean | Promise<boolean>` with `ctx = { request }`, run in order; the first falsy answer throws `ForbiddenError` (later guards, interceptors, pipes and the handler do not run).
  - **Interceptors** `(ctx, next) => result | Promise`: `next()` runs the inner interceptors, the pipes and the handler and gives the handler's result. The first interceptor is outermost. They may change the result, skip `next`, or catch an error.
  - **Pipes** `(args, ctx) => args | Promise`, applied in order to `args = { params, query, body }` (`params` and `query` default to `{}`).
  - **Handler** `(args, ctx) => result`; the response is `{ status: 200, body: result }`.
- **Errors** thrown anywhere (including middleware) go to the **filters**: the first filter with `catches(error)` true returns `await filter.handle(error, { request })`. With no matching filter: an `HttpError` becomes `{ status: error.status, body: { error: error.message } }`; anything else becomes `{ status: 500, body: { error: 'Internal Server Error' } }` (the real message is **not** exposed). A filter that itself throws also gives that generic 500.

```js
const app = createLifecycle({ guards: [(ctx) => !!ctx.request.user] });
await app.handle({ user: 'ada' }, () => 'hello'); // { status: 200, body: 'hello' }
```

%% worked
**A similar problem, solved: wrapping with `reduceRight`** — turn a list of wrappers into nested calls.

```js
const wrappers = [(next) => () => 'A(' + next() + ')', (next) => () => 'B(' + next() + ')'];
const core = () => 'core';
const composed = wrappers.reduceRight((next, wrap) => wrap(next), core);   // ① start from the innermost and wrap outward
composed();   // 'A(B(core))'  → the FIRST wrapper is outermost
```

Use the same trick twice: `middleware.reduceRight(...)` around a `core(req)` function, and `interceptors.reduceRight(...)` around an `invoke()` that runs the pipes then the handler. Guards run inside `core` **before** the interceptor chain, so a denied request never touches an interceptor. One `try/catch` around the outermost call sends every error to the filters.

%% explain
- **Nested wrappers** built with `reduceRight`: middleware outside, then guards, then interceptors, then pipes + handler.
- **Guards** throw `ForbiddenError`; **pipes** reshape `args`.
- **One `try/catch`** converts errors to responses through filters, with safe defaults.

%% nudge
- Where do guards run relative to the interceptor chain, and why?
- What should the response be when a middleware returns without calling `next`?

%% starter
```js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export class ForbiddenError extends HttpError {}
export class NotFoundError extends HttpError {}
export class BadRequestError extends HttpError {}

export function createLifecycle({ middleware = [], guards = [], interceptors = [], pipes = [], filters = [] } = {}) {
  return {
    async handle(request, handler) {
      return { status: 500, body: { error: 'Internal Server Error' } };
    },
  };
}
```

%% tests
```js
const recorder = () => {
  const calls = [];
  return { calls, note: (name) => calls.push(name) };
};

describe('error classes', () => {
  it('carry a status and message', () => {
    const e = new HttpError(418, 'teapot');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(418);
    expect(e.message).toBe('teapot');
    expect(new ForbiddenError()).toMatchObject({ status: 403, message: 'Forbidden' });
    expect(new NotFoundError()).toMatchObject({ status: 404, message: 'Not Found' });
    expect(new BadRequestError()).toMatchObject({ status: 400, message: 'Bad Request' });
    expect(new BadRequestError('id must be a number').message).toBe('id must be a number');
    expect(new ForbiddenError()).toBeInstanceOf(HttpError);
  });
});

describe('createLifecycle', () => {
  it('runs the stages in the documented order', async () => {
    const { calls, note } = recorder();
    const mw = (name) => async (req, next) => { note(name + ' in'); const res = await next(); note(name + ' out'); return res; };
    const guard = (name) => async () => { note(name); return true; };
    const interceptor = (name) => async (ctx, next) => { note(name + ' before'); const r = await next(); note(name + ' after'); return r; };
    const pipe = (name) => async (args) => { note(name); return args; };
    const app = createLifecycle({
      middleware: [mw('m1'), mw('m2')],
      guards: [guard('g1'), guard('g2')],
      interceptors: [interceptor('i1'), interceptor('i2')],
      pipes: [pipe('p1'), pipe('p2')],
    });
    const res = await app.handle({}, () => { note('handler'); return 'ok'; });
    expect(res).toEqual({ status: 200, body: 'ok' });
    expect(calls).toEqual(['m1 in', 'm2 in', 'g1', 'g2', 'i1 before', 'i2 before', 'p1', 'p2', 'handler', 'i2 after', 'i1 after', 'm2 out', 'm1 out']);
  });
  it('passes args to the handler, with defaults', async () => {
    const app = createLifecycle();
    let seen;
    await app.handle({ params: { id: '7' }, body: { a: 1 } }, (args, ctx) => { seen = [args, ctx.request.params.id]; });
    expect(seen[0]).toEqual({ params: { id: '7' }, query: {}, body: { a: 1 } });
    expect(seen[1]).toBe('7');
    await app.handle({}, (args) => { seen = args; });
    expect(seen).toEqual({ params: {}, query: {}, body: undefined });
  });
  it('lets middleware change the request and the response', async () => {
    const app = createLifecycle({
      middleware: [
        async (req, next) => { const res = await next({ ...req, user: 'ada' }); return { ...res, body: { data: res.body } }; },
      ],
    });
    const res = await app.handle({}, (args, ctx) => ctx.request.user);
    expect(res).toEqual({ status: 200, body: { data: 'ada' } });
  });
  it('lets middleware answer without calling next', async () => {
    const guard = jest.fn(() => true);
    const handler = jest.fn();
    const app = createLifecycle({ middleware: [() => ({ status: 429, body: { error: 'slow down' } })], guards: [guard] });
    expect(await app.handle({}, handler)).toEqual({ status: 429, body: { error: 'slow down' } });
    expect(guard).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it('a denying guard stops everything after it and gives 403', async () => {
    const { calls, note } = recorder();
    const app = createLifecycle({
      guards: [async () => { note('g1'); return true; }, async () => { note('g2'); return false; }, async () => { note('g3'); return true; }],
      interceptors: [async (ctx, next) => { note('i'); return next(); }],
      pipes: [(args) => { note('p'); return args; }],
    });
    const res = await app.handle({}, () => { note('handler'); });
    expect(res).toEqual({ status: 403, body: { error: 'Forbidden' } });
    expect(calls).toEqual(['g1', 'g2']);
  });
  it('supports synchronous guards and treats falsy values as denial', async () => {
    const app = createLifecycle({ guards: [() => 0] });
    expect((await app.handle({}, () => 'x')).status).toBe(403);
    const ok = createLifecycle({ guards: [(ctx) => ctx.request.admin === true] });
    expect((await ok.handle({ admin: true }, () => 'x')).status).toBe(200);
  });
  it('lets interceptors change results, skip next, or recover from errors', async () => {
    const wrap = async (ctx, next) => ({ wrapped: await next() });
    const app = createLifecycle({ interceptors: [wrap] });
    expect(await app.handle({}, () => 1)).toEqual({ status: 200, body: { wrapped: 1 } });

    const handler = jest.fn();
    const pipe = jest.fn((a) => a);
    const cached = createLifecycle({ interceptors: [async () => 'cached'], pipes: [pipe] });
    expect(await cached.handle({}, handler)).toEqual({ status: 200, body: 'cached' });
    expect(handler).not.toHaveBeenCalled();
    expect(pipe).not.toHaveBeenCalled();

    const recover = createLifecycle({ interceptors: [async (ctx, next) => { try { return await next(); } catch { return 'fallback'; } }] });
    expect(await recover.handle({}, () => { throw new Error('boom'); })).toEqual({ status: 200, body: 'fallback' });
  });
  it('lets interceptors observe errors in reverse order', async () => {
    const { calls, note } = recorder();
    const watch = (name) => async (ctx, next) => { try { return await next(); } catch (e) { note(name + ' saw ' + e.message); throw e; } };
    const app = createLifecycle({ interceptors: [watch('outer'), watch('inner')] });
    const res = await app.handle({}, () => { throw new NotFoundError(); });
    expect(calls).toEqual(['inner saw Not Found', 'outer saw Not Found']);
    expect(res).toEqual({ status: 404, body: { error: 'Not Found' } });
  });
  it('applies pipes in order, each seeing the previous output', async () => {
    const app = createLifecycle({
      pipes: [
        (args) => ({ ...args, params: { ...args.params, id: Number(args.params.id) } }),
        async (args) => ({ ...args, params: { ...args.params, id: args.params.id * 2 } }),
      ],
    });
    let seen;
    await app.handle({ params: { id: '21' } }, (args) => { seen = args.params.id; });
    expect(seen).toBe(42);
  });
  it('turns a failing pipe into its status and skips the handler', async () => {
    const handler = jest.fn();
    const app = createLifecycle({ pipes: [() => { throw new BadRequestError('id must be a number'); }] });
    expect(await app.handle({}, handler)).toEqual({ status: 400, body: { error: 'id must be a number' } });
    expect(handler).not.toHaveBeenCalled();
  });
  it('maps HttpErrors to their status and hides unknown errors', async () => {
    const app = createLifecycle();
    expect(await app.handle({}, () => { throw new HttpError(418, 'teapot'); })).toEqual({ status: 418, body: { error: 'teapot' } });
    const res = await app.handle({}, () => { throw new Error('SELECT * FROM secrets failed'); });
    expect(res).toEqual({ status: 500, body: { error: 'Internal Server Error' } });
    expect(JSON.stringify(res)).not.toContain('secrets');
    expect((await app.handle({}, () => { throw 'a string'; })).status).toBe(500);
    expect((await app.handle({}, () => Promise.reject(new NotFoundError()))).status).toBe(404);
  });
  it('sends middleware errors through the filters too', async () => {
    const app = createLifecycle({ middleware: [() => { throw new ForbiddenError(); }] });
    expect(await app.handle({}, () => 'x')).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });
  it('uses the first matching custom filter and gives it the error and request', async () => {
    const seen = [];
    class Conflict extends Error {}
    const app = createLifecycle({
      filters: [
        { catches: (e) => e instanceof Conflict, handle: (e, ctx) => { seen.push(ctx.request.id); return { status: 409, body: { error: e.message } }; } },
        { catches: () => true, handle: () => ({ status: 599, body: {} }) },
      ],
    });
    expect(await app.handle({ id: 'r1' }, () => { throw new Conflict('already exists'); })).toEqual({ status: 409, body: { error: 'already exists' } });
    expect(seen).toEqual(['r1']);
    expect((await app.handle({}, () => { throw new Error('x'); })).status).toBe(599);
  });
  it('gives a generic 500 when a filter itself throws', async () => {
    const app = createLifecycle({ filters: [{ catches: () => true, handle: () => { throw new Error('filter broke'); } }] });
    const res = await app.handle({}, () => { throw new Error('x'); });
    expect(res).toEqual({ status: 500, body: { error: 'Internal Server Error' } });
  });
  it('can be reused for many requests', async () => {
    const app = createLifecycle({ guards: [(ctx) => ctx.request.ok] });
    expect((await app.handle({ ok: true }, () => 1)).status).toBe(200);
    expect((await app.handle({ ok: false }, () => 1)).status).toBe(403);
    expect((await app.handle({ ok: true }, () => 2)).body).toBe(2);
  });
});
```

%% hints
- `const core = async (req) => { const ctx = { request: req }; for (const g of guards) if (!(await g(ctx))) throw new ForbiddenError(); const invoke = async () => { let args = {...}; for (const p of pipes) args = await p(args, ctx); return handler(args, ctx); }; const result = await interceptors.reduceRight((next, i) => () => i(ctx, next), invoke)(); return { status: 200, body: result }; };`
- `const outer = middleware.reduceRight((next, mw) => (req) => mw(req, (r = req) => next(r)), core);`
- Wrap `await outer(request)` in `try/catch`; find a filter, else default mapping.

%% solution
```js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}
export class NotFoundError extends HttpError {
  constructor(message = 'Not Found') {
    super(404, message);
  }
}
export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request') {
    super(400, message);
  }
}

const GENERIC = () => ({ status: 500, body: { error: 'Internal Server Error' } });

export function createLifecycle({ middleware = [], guards = [], interceptors = [], pipes = [], filters = [] } = {}) {
  return {
    async handle(request, handler) {
      const core = async (req) => {
        const ctx = { request: req };
        for (const guard of guards) {
          if (!(await guard(ctx))) throw new ForbiddenError();
        }
        const invoke = async () => {
          let args = { params: req.params ?? {}, query: req.query ?? {}, body: req.body };
          for (const pipe of pipes) args = await pipe(args, ctx);
          return handler(args, ctx);
        };
        const chain = interceptors.reduceRight((next, interceptor) => () => interceptor(ctx, next), invoke);
        return { status: 200, body: await chain() };
      };
      const outer = middleware.reduceRight((next, mw) => (req) => mw(req, (r = req) => next(r)), core);
      try {
        return await outer(request);
      } catch (error) {
        const filter = filters.find((f) => f.catches(error));
        try {
          if (filter) return await filter.handle(error, { request });
        } catch {
          return GENERIC();
        }
        if (error instanceof HttpError) return { status: error.status, body: { error: error.message } };
        return GENERIC();
      }
    },
  };
}
```

%% exercise nod-interceptors | Interceptors: timeout, cache, map, log | 3 | js | js | withTimeout, withCache, mapResult, withLogging, RequestTimeoutError | 28
Write four interceptor factories. An interceptor is `(ctx, next) => Promise` where `next()` runs the rest and `ctx = { request }` with `request = { method, url }`.

- `RequestTimeoutError` is an `Error` with `status = 408` and the message `'Request Timeout'`.
- `withTimeout(ms)`: if `next()` has not settled after `ms` milliseconds (use `setTimeout`), reject with a `RequestTimeoutError`. Otherwise settle like `next()` and **clear the timer**.
- `withCache({ ttlMs, clock, key })`: remember **successful** results by `key(ctx)` (default `` `${ctx.request.method} ${ctx.request.url}` ``) while `clock.now() - storedAt < ttlMs`; on a hit return the stored value **without calling `next`**. Errors are not cached.
- `mapResult(fn)`: returns `fn(result, ctx)` for the result of `next()`.
- `withLogging(log, clock)`: after `next()` settles call `log({ method, url, ms, outcome })` where `ms` is the elapsed clock time and `outcome` is `'ok'` or `'error'`; errors are rethrown.

```js
const intercept = withTimeout(50);
await intercept({ request: {} }, () => slowCall()); // rejects after 50 ms
```

%% worked
**A similar problem, solved: `withRetryOnce()`** — an interceptor that wraps `next` in extra behaviour.

```js
export const withRetryOnce = () => async (ctx, next) => {
  try {
    return await next();                      // ① the normal path
  } catch (error) {
    return next();                            // ② on failure run the rest ONE more time, letting a second error propagate
  }
};
```

Every interceptor has the same skeleton: **do something, call `next`, do something with what comes back**. For a timeout, race `next()` against a timer and make sure whichever loses cannot leak: **clear the timer** when `next` finishes first.

%% explain
- **Timeout**: a timer racing `next()`, cleared when `next` wins.
- **Cache**: a `Map` of `{ value, at }`; no `next` call on a fresh hit; failures not stored.
- **Map**: transform the awaited result.
- **Logging**: time with the injected clock; log on both outcomes.

%% nudge
- How do you stop the timer when `next` finishes first?
- Which result should the cache store: the promise or the resolved value?

%% starter
```js
export class RequestTimeoutError extends Error {
  constructor() {
    super('Request Timeout');
    this.status = 408;
  }
}

export const withTimeout = (ms) => async (ctx, next) => next();

export const withCache = ({ ttlMs, clock, key }) => async (ctx, next) => next();

export const mapResult = (fn) => async (ctx, next) => next();

export const withLogging = (log, clock) => async (ctx, next) => next();
```

%% tests
```js
const ctx = (method = 'GET', url = '/a') => ({ request: { method, url } });

describe('withTimeout', () => {
  it('rejects with a 408 when next takes too long', async () => {
    jest.useFakeTimers();
    const intercept = withTimeout(100);
    const outcome = intercept(ctx(), () => new Promise(() => {})).then(() => 'resolved', (e) => e);
    await jest.advanceTimersByTimeAsync(99);
    let settled = false;
    outcome.then(() => { settled = true; });
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    const error = await outcome;
    expect(error).toBeInstanceOf(RequestTimeoutError);
    expect(error.status).toBe(408);
    expect(error.message).toBe('Request Timeout');
  });
  it('passes through a fast result and clears its timer', async () => {
    jest.useFakeTimers();
    const result = await withTimeout(100)(ctx(), async () => 'fast');
    expect(result).toBe('fast');
    expect(jest.getTimerCount()).toBe(0);
  });
  it('passes through a fast error and clears its timer', async () => {
    jest.useFakeTimers();
    await expect(withTimeout(100)(ctx(), async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('withCache', () => {
  const clockAt = () => { let t = 0; return { now: () => t, advance: (d) => { t += d; } }; };
  it('returns cached values without calling next while fresh', async () => {
    const clock = clockAt();
    const next = jest.fn(async () => ({ n: 1 }));
    const cache = withCache({ ttlMs: 1000, clock });
    const first = await cache(ctx(), next);
    expect(await cache(ctx(), next)).toBe(first);
    expect(next).toHaveBeenCalledTimes(1);
    clock.advance(999);
    await cache(ctx(), next);
    expect(next).toHaveBeenCalledTimes(1);
    clock.advance(1);
    await cache(ctx(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
  it('keys by method and url by default, or by a custom key', async () => {
    const clock = clockAt();
    const next = jest.fn(async () => 1);
    const cache = withCache({ ttlMs: 1000, clock });
    await cache(ctx('GET', '/a'), next);
    await cache(ctx('GET', '/b'), next);
    await cache(ctx('POST', '/a'), next);
    expect(next).toHaveBeenCalledTimes(3);
    const byUrl = withCache({ ttlMs: 1000, clock, key: (c) => c.request.url });
    const other = jest.fn(async () => 2);
    await byUrl(ctx('GET', '/x'), other);
    await byUrl(ctx('POST', '/x'), other);
    expect(other).toHaveBeenCalledTimes(1);
  });
  it('does not cache errors, and caches falsy results', async () => {
    const clock = clockAt();
    let fail = true;
    const next = jest.fn(async () => { if (fail) throw new Error('x'); return 0; });
    const cache = withCache({ ttlMs: 1000, clock });
    await expect(cache(ctx(), next)).rejects.toThrow('x');
    fail = false;
    expect(await cache(ctx(), next)).toBe(0);
    expect(await cache(ctx(), next)).toBe(0);
    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('mapResult', () => {
  it('transforms the result and receives the context', async () => {
    const intercept = mapResult((value, c) => ({ data: value, url: c.request.url }));
    expect(await intercept(ctx('GET', '/u'), async () => 5)).toEqual({ data: 5, url: '/u' });
  });
  it('does not swallow errors', async () => {
    await expect(mapResult((v) => v)(ctx(), async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});

describe('withLogging', () => {
  const clockAt = () => { let t = 100; return { now: () => t, advance: (d) => { t += d; } }; };
  it('logs successful calls with their duration', async () => {
    const clock = clockAt();
    const log = jest.fn();
    const result = await withLogging(log, clock)(ctx('GET', '/a'), async () => { clock.advance(25); return 'ok'; });
    expect(result).toBe('ok');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ method: 'GET', url: '/a', ms: 25, outcome: 'ok' });
  });
  it('logs failures and rethrows them', async () => {
    const clock = clockAt();
    const log = jest.fn();
    await expect(withLogging(log, clock)(ctx('POST', '/b'), async () => { clock.advance(7); throw new Error('bad'); })).rejects.toThrow('bad');
    expect(log).toHaveBeenCalledWith({ method: 'POST', url: '/b', ms: 7, outcome: 'error' });
  });
});
```

%% hints
- Timeout: `new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new RequestTimeoutError()), ms); next().then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); }); })`.
- Cache: `const hit = cache.get(k); if (hit && clock.now() - hit.at < ttlMs) return hit.value;`
- Logging: `try { const r = await next(); log({... outcome: 'ok'}); return r; } catch (e) { log({... outcome: 'error'}); throw e; }`.

%% solution
```js
export class RequestTimeoutError extends Error {
  constructor() {
    super('Request Timeout');
    this.status = 408;
  }
}

export const withTimeout = (ms) => (ctx, next) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeoutError()), ms);
    next().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

export const withCache = ({ ttlMs, clock, key = (ctx) => `${ctx.request.method} ${ctx.request.url}` }) => {
  const store = new Map();
  return async (ctx, next) => {
    const k = key(ctx);
    const hit = store.get(k);
    if (hit && clock.now() - hit.at < ttlMs) return hit.value;
    const value = await next();
    store.set(k, { value, at: clock.now() });
    return value;
  };
};

export const mapResult = (fn) => async (ctx, next) => fn(await next(), ctx);

export const withLogging = (log, clock) => async (ctx, next) => {
  const start = clock.now();
  const entry = (outcome) => ({ method: ctx.request.method, url: ctx.request.url, ms: clock.now() - start, outcome });
  try {
    const result = await next();
    log(entry('ok'));
    return result;
  } catch (error) {
    log(entry('error'));
    throw error;
  }
};
```

%% exercise nod-pipes | Pipes: parse, default, clamp | 3 | js | js | parseIntParam, parseBoolQuery, clampQuery, trimBody, pipeline, BadRequestError | 24
A **pipe** is a function `(args) => args` (or a promise of one) where `args = { params, query, body }`. Pipes **never mutate** `args`: they return a new object. Implement:

- `BadRequestError`: an `Error` with `status = 400` (default message `'Bad Request'`).
- `parseIntParam(name)`: converts `args.params[name]` (text matching `/^-?\d+$/`) to a number; anything else (including missing) throws `BadRequestError(`${name} must be an integer`)`.
- `parseBoolQuery(name, fallback = false)`: missing or `''` gives `fallback`; `'true'`/`'1'` gives `true`; `'false'`/`'0'` gives `false`; anything else throws `BadRequestError(`${name} must be a boolean`)`. The result is stored in `query[name]`.
- `clampQuery(name, { min, max, fallback })`: missing or `''` gives `fallback`; text that isn't an integer throws `BadRequestError(`${name} must be an integer`)`; otherwise the number is clamped into `[min, max]` and stored in `query[name]`.
- `trimBody(fields)`: trims the listed **string** fields of `args.body` (other fields and non-strings untouched); a missing body stays as it is.
- `pipeline(...pipes)`: one pipe that applies the pipes **in order** (each may be async).

```js
parseIntParam('id')({ params: { id: '42' }, query: {} }); // { params: { id: 42 }, query: {} }
```

%% worked
**A similar problem, solved: `requireParam(name)`** — validate and return a new object, never mutating.

```js
export class BadRequestError extends Error {
  constructor(message = 'Bad Request') { super(message); this.status = 400; }
}
export const requireParam = (name) => (args) => {
  const value = args.params?.[name];
  if (value === undefined || value === '') throw new BadRequestError(`${name} is required`);   // ① reject early, with a precise message
  return { ...args, params: { ...args.params, [name]: String(value).trim() } };                 // ② return a COPY: the original stays untouched
};
```

Pipes sit **in front of** business logic, so they should be **small, pure and predictable**: parse one thing, reject clearly, return a copy. `pipeline` is a `reduce` over the pipes (remember they may be async).

%% explain
- **Pure pipes**: return a modified copy of `args`.
- **Precise 400s** with the exact messages.
- **Defaults and clamping** for query values (pagination).
- **`pipeline`** composes in order, awaiting each.

%% nudge
- Why must the pipes return copies instead of editing `args`?
- What is the difference between a missing value and an invalid one for `clampQuery`?

%% starter
```js
export class BadRequestError extends Error {
  constructor(message = 'Bad Request') {
    super(message);
    this.status = 400;
  }
}

export const parseIntParam = (name) => (args) => args;
export const parseBoolQuery = (name, fallback = false) => (args) => args;
export const clampQuery = (name, { min, max, fallback }) => (args) => args;
export const trimBody = (fields) => (args) => args;
export const pipeline = (...pipes) => async (args) => args;
```

%% tests
```js
const args = (over = {}) => ({ params: {}, query: {}, body: undefined, ...over });

describe('parseIntParam', () => {
  it('converts integer text to a number without mutating', () => {
    const input = args({ params: { id: '42', other: 'x' } });
    const out = parseIntParam('id')(input);
    expect(out.params).toEqual({ id: 42, other: 'x' });
    expect(input.params.id).toBe('42');
    expect(out).not.toBe(input);
    expect(parseIntParam('id')(args({ params: { id: '-7' } })).params.id).toBe(-7);
  });
  it('rejects anything else with a 400', () => {
    for (const bad of ['abc', '1.5', '', '12abc', ' 1', undefined]) {
      let error;
      try { parseIntParam('id')(args({ params: { id: bad } })); } catch (e) { error = e; }
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.status).toBe(400);
      expect(error.message).toBe('id must be an integer');
    }
  });
});

describe('parseBoolQuery', () => {
  it('parses booleans and defaults', () => {
    const parse = parseBoolQuery('active', true);
    expect(parse(args({ query: { active: 'true' } })).query.active).toBe(true);
    expect(parse(args({ query: { active: '1' } })).query.active).toBe(true);
    expect(parse(args({ query: { active: 'false' } })).query.active).toBe(false);
    expect(parse(args({ query: { active: '0' } })).query.active).toBe(false);
    expect(parse(args()).query.active).toBe(true);
    expect(parse(args({ query: { active: '' } })).query.active).toBe(true);
    expect(parseBoolQuery('x')(args()).query.x).toBe(false);
  });
  it('rejects other text', () => {
    expect(() => parseBoolQuery('active')(args({ query: { active: 'maybe' } }))).toThrow('active must be a boolean');
    expect(() => parseBoolQuery('active')(args({ query: { active: 'TRUE' } }))).toThrow(BadRequestError);
  });
  it('keeps other query values', () => {
    expect(parseBoolQuery('a')(args({ query: { a: 'true', b: 'z' } })).query).toEqual({ a: true, b: 'z' });
  });
});

describe('clampQuery', () => {
  const clamp = clampQuery('limit', { min: 1, max: 100, fallback: 20 });
  it('uses the fallback for missing values', () => {
    expect(clamp(args()).query.limit).toBe(20);
    expect(clamp(args({ query: { limit: '' } })).query.limit).toBe(20);
  });
  it('clamps into the range', () => {
    expect(clamp(args({ query: { limit: '50' } })).query.limit).toBe(50);
    expect(clamp(args({ query: { limit: '1000' } })).query.limit).toBe(100);
    expect(clamp(args({ query: { limit: '0' } })).query.limit).toBe(1);
    expect(clamp(args({ query: { limit: '-5' } })).query.limit).toBe(1);
    expect(clamp(args({ query: { limit: '100' } })).query.limit).toBe(100);
  });
  it('rejects non-integers', () => {
    for (const bad of ['abc', '1.5', '10px']) expect(() => clamp(args({ query: { limit: bad } }))).toThrow('limit must be an integer');
  });
});

describe('trimBody', () => {
  it('trims only the listed string fields', () => {
    const input = args({ body: { name: '  Ada ', note: '  keep  ', age: 5, tags: [' x '] } });
    const out = trimBody(['name', 'age'])(input);
    expect(out.body).toEqual({ name: 'Ada', note: '  keep  ', age: 5, tags: [' x '] });
    expect(input.body.name).toBe('  Ada ');
  });
  it('leaves a missing body alone', () => {
    expect(trimBody(['name'])(args()).body).toBeUndefined();
    expect(trimBody(['name'])(args({ body: null })).body).toBeNull();
  });
});

describe('pipeline', () => {
  it('applies pipes in order, supporting async pipes', async () => {
    const run = pipeline(
      parseIntParam('id'),
      async (a) => ({ ...a, params: { ...a.params, id: a.params.id + 1 } }),
      clampQuery('limit', { min: 1, max: 10, fallback: 5 }),
    );
    const out = await run(args({ params: { id: '41' }, query: { limit: '99' } }));
    expect(out.params.id).toBe(42);
    expect(out.query.limit).toBe(10);
  });
  it('stops at the first failing pipe', async () => {
    const second = jest.fn((a) => a);
    await expect(pipeline(parseIntParam('id'), second)(args({ params: { id: 'x' } }))).rejects.toThrow('id must be an integer');
    expect(second).not.toHaveBeenCalled();
  });
  it('with no pipes returns the args', async () => {
    const input = args({ params: { a: '1' } });
    expect(await pipeline()(input)).toEqual(input);
  });
});
```

%% hints
- Every pipe returns `{ ...args, params: { ...args.params, ... } }` (or `query` / `body`).
- `parseIntParam`: `/^-?\d+$/.test(String(raw))` and `raw !== undefined`.
- `clampQuery`: `Math.min(max, Math.max(min, Number(raw)))` after the integer check.
- `pipeline`: `let current = args; for (const pipe of pipes) current = await pipe(current); return current;`

%% solution
```js
export class BadRequestError extends Error {
  constructor(message = 'Bad Request') {
    super(message);
    this.status = 400;
  }
}

const INT = /^-?\d+$/;
const missing = (v) => v === undefined || v === '';

export const parseIntParam = (name) => (args) => {
  const raw = args.params ? args.params[name] : undefined;
  if (typeof raw !== 'string' || !INT.test(raw)) throw new BadRequestError(`${name} must be an integer`);
  return { ...args, params: { ...args.params, [name]: Number(raw) } };
};

export const parseBoolQuery = (name, fallback = false) => (args) => {
  const raw = args.query ? args.query[name] : undefined;
  let value;
  if (missing(raw)) value = fallback;
  else if (raw === 'true' || raw === '1') value = true;
  else if (raw === 'false' || raw === '0') value = false;
  else throw new BadRequestError(`${name} must be a boolean`);
  return { ...args, query: { ...args.query, [name]: value } };
};

export const clampQuery = (name, { min, max, fallback }) => (args) => {
  const raw = args.query ? args.query[name] : undefined;
  let value;
  if (missing(raw)) {
    value = fallback;
  } else {
    if (typeof raw !== 'string' || !INT.test(raw)) throw new BadRequestError(`${name} must be an integer`);
    value = Math.min(max, Math.max(min, Number(raw)));
  }
  return { ...args, query: { ...args.query, [name]: value } };
};

export const trimBody = (fields) => (args) => {
  if (args.body === null || typeof args.body !== 'object') return { ...args };
  const body = { ...args.body };
  for (const field of fields) {
    if (typeof body[field] === 'string') body[field] = body[field].trim();
  }
  return { ...args, body };
};

export const pipeline = (...pipes) => async (args) => {
  let current = args;
  for (const pipe of pipes) current = await pipe(current);
  return current;
};
```

%% exercise nod-filters | Exception filters | 3 | js | js | applyFilters, httpExceptionFilter, typeFilter, HttpError | 22
Implement the error-to-response layer.

- `HttpError(status, message)` is an `Error` with a `status`.
- A **filter** is `{ catches(error) => boolean, handle(error, ctx) => response | Promise }` where a response is `{ status, body }`.
- `httpExceptionFilter()` catches `HttpError`s and returns `{ status: error.status, body: { error: error.message } }`.
- `typeFilter(ErrorClass, map)` catches `instanceof ErrorClass` and returns `map(error, ctx)`.
- `applyFilters(filters, error, ctx = {}, log = () => {})` is async: the **first** filter whose `catches` is true produces the response (`await filter.handle(error, ctx)`). With **no** match: an `HttpError` becomes `{ status, body: { error: message } }`; anything else becomes `{ status: 500, body: { error: 'Internal Server Error' } }` and `log({ level: 'error', message })` is called with the real message (`String(error)` for a non-Error). If the chosen filter **throws**, return the same generic 500 and log it. The real message must **never** appear in a generic 500.

```js
await applyFilters([], new Error('db down'), {}, log); // { status: 500, body: { error: 'Internal Server Error' } }
```

%% worked
**A similar problem, solved: `firstMatch(handlers, value, fallback)`** — first match wins, with a safe fallback.

```js
export async function firstMatch(handlers, value, fallback) {
  const handler = handlers.find((h) => h.matches(value));        // ① order matters: put specific handlers first
  try {
    return handler ? await handler.run(value) : fallback(value);
  } catch {
    return fallback(value);                                      // ② a broken handler must not break the error path
  }
}
```

The error path is the **worst place for a bug**: if the code that handles errors throws, the client gets nothing. So **guard the filter call**, and always end in a safe default.

%% explain
- **First match wins**, in registration order.
- **Defaults**: `HttpError` keeps status/message, everything else is a generic 500.
- **Log** the real message for unknown errors and failing filters; never return it.

%% nudge
- Why catch errors thrown by a filter itself?
- What do you log for something that isn't an `Error` object?

%% starter
```js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const httpExceptionFilter = () => ({ catches: () => false, handle: () => ({}) });
export const typeFilter = (ErrorClass, map) => ({ catches: () => false, handle: () => ({}) });

export async function applyFilters(filters, error, ctx = {}, log = () => {}) {
  return { status: 500, body: { error: 'Internal Server Error' } };
}
```

%% tests
```js
const generic = { status: 500, body: { error: 'Internal Server Error' } };

describe('filters', () => {
  it('httpExceptionFilter maps HttpErrors', async () => {
    const f = httpExceptionFilter();
    expect(f.catches(new HttpError(404, 'nope'))).toBe(true);
    expect(f.catches(new Error('x'))).toBe(false);
    expect(await f.handle(new HttpError(404, 'nope'))).toEqual({ status: 404, body: { error: 'nope' } });
  });
  it('typeFilter matches by class and uses the mapper with the context', async () => {
    class Conflict extends Error {}
    const f = typeFilter(Conflict, (e, ctx) => ({ status: 409, body: { error: e.message, id: ctx.id } }));
    expect(f.catches(new Conflict('dup'))).toBe(true);
    expect(f.catches(new Error('x'))).toBe(false);
    expect(await f.handle(new Conflict('dup'), { id: 'r1' })).toEqual({ status: 409, body: { error: 'dup', id: 'r1' } });
  });
});

describe('applyFilters', () => {
  it('uses the first matching filter', async () => {
    class A extends Error {}
    const filters = [
      typeFilter(A, () => ({ status: 400, body: { from: 'first' } })),
      typeFilter(Error, () => ({ status: 418, body: { from: 'second' } })),
    ];
    expect(await applyFilters(filters, new A('x'))).toEqual({ status: 400, body: { from: 'first' } });
    expect(await applyFilters(filters, new Error('y'))).toEqual({ status: 418, body: { from: 'second' } });
  });
  it('passes the context to the filter and awaits async filters', async () => {
    const handle = jest.fn(async (e, ctx) => ({ status: 409, body: { by: ctx.user } }));
    const res = await applyFilters([{ catches: () => true, handle }], new Error('x'), { user: 'ada' });
    expect(res).toEqual({ status: 409, body: { by: 'ada' } });
    expect(handle).toHaveBeenCalledTimes(1);
  });
  it('maps HttpErrors by default', async () => {
    expect(await applyFilters([], new HttpError(403, 'Forbidden'))).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });
  it('gives a generic 500 for unknown errors and logs the real message', async () => {
    const log = jest.fn();
    const res = await applyFilters([], new Error('SELECT * FROM secrets failed'), {}, log);
    expect(res).toEqual(generic);
    expect(JSON.stringify(res)).not.toContain('secrets');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ level: 'error', message: 'SELECT * FROM secrets failed' });
  });
  it('handles errors that are not Error objects', async () => {
    const log = jest.fn();
    expect(await applyFilters([], 'a plain string', {}, log)).toEqual(generic);
    expect(log).toHaveBeenCalledWith({ level: 'error', message: 'a plain string' });
    expect(await applyFilters([], undefined)).toEqual(generic);
  });
  it('does not log for handled HttpErrors', async () => {
    const log = jest.fn();
    await applyFilters([], new HttpError(404, 'x'), {}, log);
    expect(log).not.toHaveBeenCalled();
  });
  it('returns a generic 500 and logs when a filter throws', async () => {
    const log = jest.fn();
    const broken = { catches: () => true, handle: () => { throw new Error('filter broke'); } };
    const res = await applyFilters([broken], new Error('original'), {}, log);
    expect(res).toEqual(generic);
    expect(JSON.stringify(res)).not.toContain('broke');
    expect(log).toHaveBeenCalledWith({ level: 'error', message: 'filter broke' });
  });
  it('also survives a filter whose catches throws', async () => {
    const res = await applyFilters([{ catches: () => { throw new Error('bad matcher'); }, handle: () => ({}) }], new Error('x'));
    expect(res).toEqual(generic);
  });
});
```

%% hints
- `const filter = filters.find((f) => f.catches(error));` wrapped in the same `try` as the call.
- Default: `if (error instanceof HttpError) return {...}`; else log `error instanceof Error ? error.message : String(error)`.
- One `generic()` helper for the 500.

%% solution
```js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const httpExceptionFilter = () => ({
  catches: (error) => error instanceof HttpError,
  handle: (error) => ({ status: error.status, body: { error: error.message } }),
});

export const typeFilter = (ErrorClass, map) => ({
  catches: (error) => error instanceof ErrorClass,
  handle: (error, ctx) => map(error, ctx),
});

const generic = () => ({ status: 500, body: { error: 'Internal Server Error' } });
const describe = (e) => (e instanceof Error ? e.message : String(e));

export async function applyFilters(filters, error, ctx = {}, log = () => {}) {
  try {
    const filter = filters.find((f) => f.catches(error));
    if (filter) return await filter.handle(error, ctx);
  } catch (inner) {
    log({ level: 'error', message: describe(inner) });
    return generic();
  }
  if (error instanceof HttpError) return { status: error.status, body: { error: error.message } };
  log({ level: 'error', message: describe(error) });
  return generic();
}
```

%% exercise nod-check-lifecycle | Tests for a request lifecycle | 4 | js | js | checkLifecycle | 40
`createLifecycle({ middleware, guards, interceptors, pipes, filters })` returns `{ handle(request, handler) }` giving `{ status, body }`. The order is **middleware → guards → interceptors (before) → pipes → handler → interceptors (after, reverse) → middleware (after, reverse)**. A falsy guard answers `403` and nothing after it runs; thrown `HttpError`s keep their status; **unknown errors become a generic `500`** that does not expose the message; the **first** matching custom filter wins; errors thrown in middleware also reach the filters. You are given `checkLifecycle(createLifecycle, { HttpError })`. Write a check that passes for a correct lifecycle and **fails** for: **guards run before middleware**, **interceptors run before guards**, **pipes run before interceptors**, **a denied guard still lets the handler run**, **guards run in reverse order**, **only the first interceptor runs**, **unknown errors leak their message**, **middleware errors are not handled by the filters**, **the last matching filter wins**.

```js
const calls = [];
const app = createLifecycle({ guards: [() => { calls.push('guard'); return true; }] });
await app.handle({}, () => { calls.push('handler'); });
expect(calls).toEqual(['guard', 'handler']);
```

%% worked
**A similar problem, solved: `checkSteps(createRunner)`** — record the **order** in an array, then assert the whole array.

```js
export async function checkSteps(createRunner) {        // createRunner({ before, after }) runs before → work → after
  const calls = [];
  const runner = createRunner({ before: () => calls.push('before'), after: () => calls.push('after') });
  await runner.run(() => calls.push('work'));
  expect(calls).toEqual(['before', 'work', 'after']);   // ① ONE assertion on the whole sequence beats many on single calls
  const error = new Error('boom');
  calls.length = 0;
  await expect(runner.run(() => { throw error; })).rejects.toThrow('boom');
  expect(calls).toEqual(['before', 'after']);           // ② and the same for the failure path
}
```

For ordering rules, a **trace** is the best tool: each stage pushes its name, and a single `toEqual` on the array proves the **order and that nothing extra ran**. Then add a trace for each **early exit** (a denying guard, a failing pipe) to show that later stages **did not** run.

%% explain
- **Full-order trace** with two of every stage, so swapped neighbours show.
- **Denial trace**: after the denying guard nothing runs.
- **Error behaviour**: `HttpError` status, unknown error hidden, middleware errors, custom filter order.

%% nudge
- Why use two middleware, two guards and two interceptors in the same trace?
- How do you prove the handler did not run after a denial?

%% starter
```js
export async function checkLifecycle(createLifecycle, { HttpError }) {
  const app = createLifecycle({ guards: [() => true] });
  const res = await app.handle({}, () => 'ok');
  expect(res).toEqual({ status: 200, body: 'ok' });
  // your assertions: full order trace, denial, errors, filters
}
```

%% tests
```js
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const GENERIC = () => ({ status: 500, body: { error: 'Internal Server Error' } });
const make = ({ guardsFirst = false, interceptorsFirst = false, pipesFirst = false, runAfterDenial = false, reverseGuards = false, onlyFirstInterceptor = false, leak = false, mwEscapes = false, lastFilter = false } = {}) => ({ middleware = [], guards = [], interceptors = [], pipes = [], filters = [] } = {}) => ({
  async handle(request, handler) {
    const toFilters = async (error) => {
      const matching = filters.filter((f) => f.catches(error));
      const filter = lastFilter ? matching[matching.length - 1] : matching[0];
      if (filter) return filter.handle(error, { request });
      if (error instanceof HttpError) return { status: error.status, body: { error: error.message } };
      return leak ? { status: 500, body: { error: error.message } } : GENERIC();
    };
    const ctx = { request };
    const runGuards = async () => {
      const list = reverseGuards ? [...guards].reverse() : guards;
      for (const g of list) {
        if (!(await g(ctx))) {
          if (runAfterDenial) await handler({ params: {}, query: {}, body: undefined }, ctx);
          throw new HttpError(403, 'Forbidden');
        }
      }
    };
    const runPipes = async () => { let args = { params: request.params ?? {}, query: request.query ?? {}, body: request.body }; for (const p of pipes) args = await p(args, ctx); return args; };
    const invokeAfterPipes = async (args) => handler(args, ctx);
    const core = async (req) => {
      if (guardsFirst) { /* guards already ran outside */ } else if (!interceptorsFirst) await runGuards();
      const run = async () => {
        if (interceptorsFirst) await runGuards();
        const args = await runPipes();
        return invokeAfterPipes(args);
      };
      let result;
      const list = onlyFirstInterceptor ? interceptors.slice(0, 1) : interceptors;
      if (pipesFirst) {
        const args = await runPipes();
        const chain = list.reduceRight((next, i) => () => i(ctx, next), () => invokeAfterPipes(args));
        result = await chain();
      } else {
        const chain = list.reduceRight((next, i) => () => i(ctx, next), run);
        result = await chain();
      }
      return { status: 200, body: result };
    };
    const outer = middleware.reduceRight((next, mw) => (req) => mw(req, (r = req) => next(r)), core);
    try {
      if (guardsFirst) await runGuards();
      if (mwEscapes) {
        const wrapped = middleware.reduceRight((next, mw) => (req) => mw(req, (r = req) => next(r)), async (req) => { try { return await core(req); } catch (e) { return toFilters(e); } });
        try { return await wrapped(request); } catch (e) { e.escaped = true; throw e; }
      }
      return await outer(request);
    } catch (error) {
      if (mwEscapes && error && error.escaped) throw error;
      return toFilters(error);
    }
  },
});
const correct = make();
const mutants = {
  'runs guards before middleware': make({ guardsFirst: true }),
  'runs interceptors before guards': make({ interceptorsFirst: true }),
  'runs pipes before interceptors': make({ pipesFirst: true }),
  'still runs the handler after a denial': make({ runAfterDenial: true }),
  'runs guards in reverse order': make({ reverseGuards: true }),
  'only runs the first interceptor': make({ onlyFirstInterceptor: true }),
  'leaks unknown error messages': make({ leak: true }),
  'does not send middleware errors to the filters': make({ mwEscapes: true }),
  'uses the last matching filter': make({ lastFilter: true }),
};

describe('your checkLifecycle', () => {
  it('passes on a correct lifecycle', async () => {
    await checkLifecycle(correct, { HttpError });
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a lifecycle that ${name}`, async () => {
      let caught = false;
      try { await checkLifecycle(impl, { HttpError }); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Build all stages from one helper: `const mark = (name, ret) => (...a) => { calls.push(name); return ret ?? a[0]; }`, with async middleware/interceptors that push `in` and `out`.
- Expected trace: `['m1 in','m2 in','g1','g2','i1 in','i2 in','p1','p2','handler','i2 out','i1 out','m2 out','m1 out']`.
- Denial: a guard list `[g1, deny, g3]` gives exactly `['g1', 'deny']` and a `403`.
- Errors: unknown `Error('secret db detail')` must give status 500 and a body without that text; two filters that both match, expect the first one's status.

%% solution
```js
export async function checkLifecycle(createLifecycle, { HttpError }) {
  const calls = [];
  const mw = (n) => async (req, next) => { calls.push(n + ' in'); const r = await next(); calls.push(n + ' out'); return r; };
  const guard = (n, ok = true) => async () => { calls.push(n); return ok; };
  const icpt = (n) => async (ctx, next) => { calls.push(n + ' in'); const r = await next(); calls.push(n + ' out'); return r; };
  const pipe = (n) => async (args) => { calls.push(n); return args; };

  const app = createLifecycle({
    middleware: [mw('m1'), mw('m2')],
    guards: [guard('g1'), guard('g2')],
    interceptors: [icpt('i1'), icpt('i2')],
    pipes: [pipe('p1'), pipe('p2')],
  });
  const res = await app.handle({}, () => { calls.push('handler'); return 'ok'; });
  expect(res).toEqual({ status: 200, body: 'ok' });
  expect(calls).toEqual(['m1 in', 'm2 in', 'g1', 'g2', 'i1 in', 'i2 in', 'p1', 'p2', 'handler', 'i2 out', 'i1 out', 'm2 out', 'm1 out']);

  calls.length = 0;
  const denied = createLifecycle({
    guards: [guard('g1'), guard('g2', false), guard('g3')],
    interceptors: [icpt('i1')],
    pipes: [pipe('p1')],
  });
  const refusal = await denied.handle({}, () => { calls.push('handler'); });
  expect(refusal.status).toBe(403);
  expect(calls).toEqual(['g1', 'g2']);

  const plain = createLifecycle();
  const teapot = await plain.handle({}, () => { throw new HttpError(418, 'teapot'); });
  expect(teapot).toEqual({ status: 418, body: { error: 'teapot' } });
  const hidden = await plain.handle({}, () => { throw new Error('secret db detail'); });
  expect(hidden.status).toBe(500);
  expect(JSON.stringify(hidden)).not.toContain('secret');

  const fromMiddleware = createLifecycle({ middleware: [() => { throw new HttpError(403, 'no'); }] });
  expect((await fromMiddleware.handle({}, () => 'x')).status).toBe(403);

  const filtered = createLifecycle({
    filters: [
      { catches: () => true, handle: () => ({ status: 401, body: {} }) },
      { catches: () => true, handle: () => ({ status: 402, body: {} }) },
    ],
  });
  expect((await filtered.handle({}, () => { throw new Error('x'); })).status).toBe(401);
}
```
