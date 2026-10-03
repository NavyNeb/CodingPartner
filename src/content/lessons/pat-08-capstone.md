---
id: pat-capstone
track: pat
title: Capstone: choosing and combining patterns
summary: Picking the right pattern from the problem instead of the other way round, avoiding over-engineering, and combining patterns into real systems: a plugin host, a pricing engine, an undoable store and a resilient client.
---

## The idea in one sentence

Patterns are **names for solutions to recurring problems**, so start from the **problem** you actually have, reach for the **smallest** pattern that solves it, and combine them only when they earn their place.

> **Analogy** A carpenter's toolbox. A good carpenter doesn't decide "today I'll use the dovetail saw" and then look for wood. They look at the joint they need to make and pick the tool. And they don't buy a table saw to cut one board.

## Start from the problem

![A guide for choosing a pattern](fig:pat-chooser "Read it from the left: what hurts, then which pattern is named after that pain.")

Use it as a prompt, not a rulebook: if the problem on the left isn't actually hurting you today, you probably don't need the pattern on the right yet.

## When patterns go wrong

- **Golden hammer**: having learned the visitor pattern, seeing visitors everywhere.
- **Speculative generality**: a plugin system, a factory and three interfaces for something with one implementation. Wait for the **second** use case.
- **Pattern for show**: a singleton that is really a global; an observer where a function call would do.
- **Class ceremony**: in JavaScript, most patterns are **just functions and objects**. If your pattern needs an `AbstractFactoryProvider`, step back.

A useful rule: **three similar things justify an abstraction; two usually don't.** Duplication is cheaper than the wrong abstraction.

## Combining patterns

Real systems layer several patterns, each doing its one job. Here they are in three small, typical shapes.

### A plugin host: container + observer + lifecycle

A tiny core offers **services** (a container), **events** (an observer) and a **lifecycle**; features arrive as plugins that declare what they **require**. The host starts them in dependency order (a topological sort) and stops them in reverse.

![A plugin host](fig:pat-plugin "The core stays small; everything else is a plugin that plugs into three sockets.")

### A resilient client: stacked decorators

Cache, deduplicate and retry are three independent behaviours you can wrap around **any** async function. Because every decorator returns a function with the same shape, you stack them with `compose`. **Order matters**: the outermost layer is consulted first.

![Stacked decorators](fig:pat-resilient "A cache hit skips everything inside; a retry only matters when the real call fails.")

```stepper A request through the stack
code:
  const getUser = compose(
    (f) => withCache(f, { ttlMs: 60000, clock }),
    (f) => withDedupe(f),
    (f) => withRetry(f, { attempts: 3, sleep }),
  )(fetchUser);
---
line: 2
say: The outermost layer, the **cache**. First call for user 7: nothing cached, so the call goes inwards. Later calls within a minute return right here.
layer: cache (miss)
---
line: 3
say: **Dedupe**. If ten components ask for user 7 at the same moment, only the **first** goes on; the other nine wait for that one answer.
layer: dedupe (first caller)
---
line: 4
say: **Retry**. The real network call fails once (a timeout). This layer waits, then tries again: the layers outside never notice.
layer: retry (attempt 2 of 3)
---
line: 5
say: The real `fetchUser` finally answers. The value travels back **out**: retry returns it, dedupe hands it to everyone waiting, cache stores it for a minute.
layer: result cached for 60 s
```

### An undoable store: observer + snapshots

State changes through a **reducer** (a pure function `(state, action) => newState`); every change keeps the **previous state** for undo (a snapshot, the memento idea), and **subscribers** are told about each change, including undo and redo.

## Quick check: which pattern?

```check
Q: Five different ways to calculate shipping, chosen per order. Which pattern fits?
A) Singleton
B) Strategy *
C) Visitor
D) Facade
Why: A family of interchangeable algorithms behind one slot is strategy.
---
Q: A document must support undo and redo of edits. Which pattern?
A) Command (or snapshots) *
B) Adapter
C) Composite
D) Builder
Why: Actions as objects with do/undo, or stored snapshots, give history.
---
Q: A third-party SDK returns `{ usr_nm, act }` and you want `{ name, active }`. Which pattern?
A) Adapter (anti-corruption layer) *
B) Observer
C) State
D) Pool
Why: Translate foreign data once at the boundary.
---
Q: Your code has only one payment provider and no plans for another. Should you build a payment-provider plugin framework?
A) Yes, always
B) No: wait for the second use case, and keep it a plain function until then *
C) Yes, with a visitor
D) Only with a singleton
Why: Speculative generality costs more than it saves.
---
Q: Where in a decorator stack should a cache go if you want hits to skip retries and deduping?
A) Innermost
B) Outermost *
C) Anywhere
D) It can't be stacked
Why: The outermost layer sees the call first; a hit returns immediately.
```

## Recap

- **Problem first**: pick a pattern because a specific pain exists, not because you know it.
- **Smallest tool**: in JavaScript most patterns are functions and plain objects.
- **Three before abstracting**: avoid speculative generality and golden-hammer thinking.
- **Combine deliberately**: containers + observers (plugins), stacked decorators (resilience), reducers + snapshots (undo).
- **Order and lifecycle** matter: what starts first stops last; the outermost decorator runs first.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: waterfall hooks | A list of functions per name; passing a value through them |
| A plugin host | A dependency-ordered start, services, events, teardown in reverse |
| A pricing engine | Rules as strategies; combining their results; rounding money |
| An undoable store | A reducer, past and future snapshots, subscribers |
| A resilient client | Async decorators, a fake clock, `compose` |

%% exercise pat-guided-hooks | Guided: waterfall hooks | 1 | js | js | createHooks | 8 | guided
Implement `createHooks()`, the extension mechanism behind many plugin systems.

- `tap(name, fn)` registers `fn` under a hook name.
- `call(name, value, ...rest)` passes `value` through each registered function **in registration order**: each receives the previous result (and the extra `rest` arguments) and returns the next value. It returns the **final** value. With no functions registered, it returns `value` **unchanged**.

```js
const hooks = createHooks();
hooks.tap('title', (t) => t.trim());
hooks.tap('title', (t) => t.toUpperCase());
hooks.call('title', '  hi  '); // 'HI'
```

%% worked
**A similar problem, solved: `createFilters()`** — a pipeline of functions registered by name.

```js
function createFilters() {
  const lists = new Map();
  return {
    add(name, fn) {
      if (!lists.has(name)) lists.set(name, []);
      lists.get(name).push(fn);
    },
    apply(name, value) {
      return (lists.get(name) ?? []).reduce((v, fn) => fn(v), value);   // ① each function's output is the next one's input
    },
  };
}
```

`reduce` with the starting `value` is exactly a waterfall. The `?? []` makes "nobody registered" behave as "return the value unchanged".

%% explain
- **A list of functions per hook name.**
- **`call`** folds the value through them, passing `rest` along.
- **No hooks**: the value comes back unchanged.

%% nudge
- Which array method turns a list of functions and a starting value into one result?
- What should happen for a name nobody tapped?

%% starter
```js
export function createHooks() {
  const lists = new Map();
  return {
    tap(name, fn) {},
    call(name, value, ...rest) {
      return value;
    },
  };
}
```

%% tests
```js
describe('createHooks', () => {
  it('passes the value through hooks in order', () => {
    const hooks = createHooks();
    hooks.tap('title', (t) => t.trim());
    hooks.tap('title', (t) => t.toUpperCase());
    expect(hooks.call('title', '  hi  ')).toBe('HI');
  });
  it('returns the value unchanged when there are no hooks', () => {
    const hooks = createHooks();
    const obj = { a: 1 };
    expect(hooks.call('none', obj)).toBe(obj);
  });
  it('keeps hook names separate', () => {
    const hooks = createHooks();
    hooks.tap('a', (v) => v + 1);
    hooks.tap('b', (v) => v * 10);
    expect(hooks.call('a', 1)).toBe(2);
    expect(hooks.call('b', 1)).toBe(10);
  });
  it('passes extra arguments to every hook', () => {
    const hooks = createHooks();
    const spy = jest.fn((v, ctx) => v + ctx.n);
    hooks.tap('x', spy);
    hooks.tap('x', spy);
    expect(hooks.call('x', 0, { n: 5 })).toBe(10);
    expect(spy).toHaveBeenNthCalledWith(2, 5, { n: 5 });
  });
  it('can be called repeatedly', () => {
    const hooks = createHooks();
    hooks.tap('x', (v) => v + 1);
    expect(hooks.call('x', 1)).toBe(2);
    expect(hooks.call('x', 1)).toBe(2);
  });
});
```

%% hints
- `tap`: `if (!lists.has(name)) lists.set(name, []); lists.get(name).push(fn);`
- `call`: `return (lists.get(name) ?? []).reduce((v, fn) => fn(v, ...rest), value);`

%% solution
```js
export function createHooks() {
  const lists = new Map();
  return {
    tap(name, fn) {
      if (!lists.has(name)) lists.set(name, []);
      lists.get(name).push(fn);
    },
    call(name, value, ...rest) {
      return (lists.get(name) ?? []).reduce((v, fn) => fn(v, ...rest), value);
    },
  };
}
```

%% exercise pat-plugin-host | A plugin host | 4 | js | js | createHost | 38
Implement `createHost()` for plugins `{ name, requires = [], setup(api), teardown() }` (`setup` and `teardown` are optional).

- `use(plugin)` registers it and returns the host. A repeated name throws `Error('duplicate plugin: NAME')`.
- `start()` returns the list of plugin **names in start order**. Plugins start in **dependency order** (a plugin after everything it `requires`); among those ready, **registration order** wins. A missing requirement throws `Error('plugin A requires B')`; a cycle throws `Error('circular plugin dependencies: a, b')` (the unresolved names, in registration order). Calling `start()` while started throws `Error('already started')`.
- `setup(api)` receives `api = { provide(name, value), inject(name), on(event, fn), emit(event, ...args) }`. `provide` twice for one name throws `Error('service already provided: NAME')`; `inject` of an unknown service throws `Error('no service: NAME')`. Services and events are shared by all plugins.
- If a `setup` **throws**, the plugins already started are torn down in **reverse** order, the host is left stopped, and the error is rethrown.
- `get(name)` reads a service from outside (same error for unknown).
- `stop()` calls each started plugin's `teardown()` in **reverse start order**, then forgets all services and listeners. If teardowns throw, all still run and the **first** error is rethrown at the end. Stopping a host that isn't started does nothing; a stopped host can be started again.

%% worked
**A similar problem, solved: ordering tasks by their dependencies** — repeatedly pick the first task whose requirements are done.

```js
function order(tasks) {                            // tasks: [{ name, needs: [] }]
  const done = new Set(), result = [];
  let remaining = [...tasks];
  while (remaining.length) {
    const next = remaining.find((t) => t.needs.every((n) => done.has(n)));   // ① the first one that is ready
    if (!next) throw new Error('cycle: ' + remaining.map((t) => t.name).join(', '));   // ② nothing is ready: a cycle
    result.push(next.name);
    done.add(next.name);
    remaining = remaining.filter((t) => t !== next);
  }
  return result;
}
```

Check for **missing** requirements before ordering. Keep the started plugins in a list so `stop()` (and a failed start) can walk it backwards. Services are a `Map`, events a `Map` of listener arrays; both are reset on stop.

%% explain
- **Validation**: duplicates on `use`; missing requirements at `start`.
- **Order**: a stable topological order; cycles named.
- **API**: shared services with clear errors, shared events.
- **Lifecycle**: failed setup rolls back; `stop` tears down in reverse; reusable afterwards.

%% nudge
- How do you keep registration order among plugins that are all ready?
- What state must be cleared on `stop` so the host can start again?

%% starter
```js
export function createHost() {
  const plugins = [];
  return {
    use(plugin) { return this; },
    start() { return []; },
    stop() {},
    get(name) { return undefined; },
  };
}
```

%% tests
```js
const plugin = (name, extra = {}) => ({ name, ...extra });

describe('createHost', () => {
  it('starts plugins in dependency order, then registration order', () => {
    const log = [];
    const host = createHost()
      .use(plugin('c', { requires: ['a'], setup: () => log.push('c') }))
      .use(plugin('b', { setup: () => log.push('b') }))
      .use(plugin('a', { setup: () => log.push('a') }))
      .use(plugin('d', { requires: ['c', 'b'], setup: () => log.push('d') }));
    expect(host.start()).toEqual(['b', 'a', 'c', 'd']);
    expect(log).toEqual(['b', 'a', 'c', 'd']);
  });
  it('validates duplicates, missing requirements and cycles', () => {
    expect(() => createHost().use(plugin('a')).use(plugin('a'))).toThrow('duplicate plugin: a');
    expect(() => createHost().use(plugin('a', { requires: ['ghost'] })).start()).toThrow('plugin a requires ghost');
    const cyc = createHost().use(plugin('a', { requires: ['b'] })).use(plugin('free')).use(plugin('b', { requires: ['a'] }));
    expect(() => cyc.start()).toThrow('circular plugin dependencies: a, b');
  });
  it('cannot be started twice', () => {
    const host = createHost().use(plugin('a'));
    host.start();
    expect(() => host.start()).toThrow('already started');
  });
  it('shares services between plugins', () => {
    const seen = [];
    const host = createHost()
      .use(plugin('logger', { setup: (api) => api.provide('log', (m) => seen.push(m)) }))
      .use(plugin('auth', { requires: ['logger'], setup: (api) => api.inject('log')('auth ready') }));
    host.start();
    expect(seen).toEqual(['auth ready']);
    expect(typeof host.get('log')).toBe('function');
  });
  it('reports service errors', () => {
    const dup = createHost().use(plugin('a', { setup: (api) => { api.provide('x', 1); api.provide('x', 2); } }));
    expect(() => dup.start()).toThrow('service already provided: x');
    const missing = createHost().use(plugin('a', { setup: (api) => api.inject('nope') }));
    expect(() => missing.start()).toThrow('no service: nope');
    expect(() => createHost().get('nope')).toThrow('no service: nope');
  });
  it('shares events between plugins', () => {
    const got = [];
    const host = createHost()
      .use(plugin('listener', { setup: (api) => api.on('ping', (n) => got.push(n)) }))
      .use(plugin('sender', { requires: ['listener'], setup: (api) => api.emit('ping', 7) }));
    host.start();
    expect(got).toEqual([7]);
  });
  it('stops in reverse order and forgets services', () => {
    const log = [];
    const host = createHost()
      .use(plugin('a', { setup: (api) => api.provide('x', 1), teardown: () => log.push('a') }))
      .use(plugin('b', { requires: ['a'], teardown: () => log.push('b') }))
      .use(plugin('c', { requires: ['b'], teardown: () => log.push('c') }));
    host.start();
    host.stop();
    expect(log).toEqual(['c', 'b', 'a']);
    expect(() => host.get('x')).toThrow('no service: x');
    host.stop();
    expect(log).toEqual(['c', 'b', 'a']);
  });
  it('can be restarted after stop', () => {
    const setup = jest.fn((api) => api.provide('x', 1));
    const host = createHost().use(plugin('a', { setup }));
    host.start(); host.stop();
    expect(host.start()).toEqual(['a']);
    expect(setup).toHaveBeenCalledTimes(2);
  });
  it('rolls back when a setup throws', () => {
    const log = [];
    const host = createHost()
      .use(plugin('a', { teardown: () => log.push('teardown a') }))
      .use(plugin('b', { requires: ['a'], teardown: () => log.push('teardown b') }))
      .use(plugin('boom', { requires: ['b'], setup: () => { throw new Error('boom'); }, teardown: () => log.push('teardown boom') }));
    expect(() => host.start()).toThrow('boom');
    expect(log).toEqual(['teardown b', 'teardown a']);
    expect(() => host.start()).toThrow('boom');
  });
  it('runs every teardown even if some throw, rethrowing the first', () => {
    const log = [];
    const host = createHost()
      .use(plugin('a', { teardown: () => log.push('a') }))
      .use(plugin('b', { requires: ['a'], teardown: () => { log.push('b'); throw new Error('b failed'); } }))
      .use(plugin('c', { requires: ['b'], teardown: () => { log.push('c'); throw new Error('c failed'); } }));
    host.start();
    expect(() => host.stop()).toThrow('c failed');
    expect(log).toEqual(['c', 'b', 'a']);
  });
});
```

%% hints
- Order: `while (remaining.length) { const next = remaining.find((p) => (p.requires || []).every((r) => done.has(r))); ... }`.
- `start`: validate (missing requirements first, then order), set `running`, then loop `p.setup?.(api)` pushing onto `started`; on error call teardowns in reverse, reset, rethrow.
- Put the reset (services, listeners, started, running) in one helper used by `stop` and the failure path.

%% solution
```js
export function createHost() {
  const plugins = [];
  let started = [];
  let running = false;
  let services = new Map();
  let listeners = new Map();

  const api = {
    provide(name, value) {
      if (services.has(name)) throw new Error('service already provided: ' + name);
      services.set(name, value);
    },
    inject(name) {
      if (!services.has(name)) throw new Error('no service: ' + name);
      return services.get(name);
    },
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    emit(event, ...args) {
      for (const fn of [...(listeners.get(event) || [])]) fn(...args);
    },
  };

  function shutdown() {
    let failed = false;
    let firstError;
    while (started.length) {
      const p = started.pop();
      try {
        p.teardown?.();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    services = new Map();
    listeners = new Map();
    running = false;
    if (failed) throw firstError;
  }

  const host = {
    use(plugin) {
      if (plugins.some((p) => p.name === plugin.name)) throw new Error('duplicate plugin: ' + plugin.name);
      plugins.push(plugin);
      return host;
    },
    start() {
      if (running) throw new Error('already started');
      const names = new Set(plugins.map((p) => p.name));
      for (const p of plugins) {
        for (const r of p.requires || []) {
          if (!names.has(r)) throw new Error(`plugin ${p.name} requires ${r}`);
        }
      }
      const order = [];
      const done = new Set();
      let remaining = [...plugins];
      while (remaining.length) {
        const next = remaining.find((p) => (p.requires || []).every((r) => done.has(r)));
        if (!next) throw new Error('circular plugin dependencies: ' + remaining.map((p) => p.name).join(', '));
        order.push(next);
        done.add(next.name);
        remaining = remaining.filter((p) => p !== next);
      }
      running = true;
      started = [];
      try {
        for (const p of order) {
          p.setup?.(api);
          started.push(p);
        }
      } catch (error) {
        try {
          shutdown();
        } catch {
          /* the original error matters more */
        }
        throw error;
      }
      return order.map((p) => p.name);
    },
    stop() {
      if (!running) return;
      shutdown();
    },
    get: (name) => api.inject(name),
  };
  return host;
}
```

%% exercise pat-pricing | A pricing engine | 3 | js | js | createPricer, percentOff, bulkDiscount, fixedOff, freeShippingOver | 28
Rules are **strategies**: a rule is `(cart, subtotal) => null | { label, discount?, freeShipping? }`. A cart is `{ items: [{ sku, price, qty }], shipping = 5 }`.

`createPricer(rules).quote(cart)` returns `{ subtotal, discounts, shipping, total }`:

- `subtotal` is the sum of `price * qty`, rounded to 2 decimals.
- Each rule is asked, in order, with the cart and the subtotal. A result with `discount > 0` adds `{ label, amount }` (amount rounded to 2 decimals) to `discounts`. Any result with `freeShipping: true` makes shipping `0`.
- `shipping` is the cart's `shipping` (default `5`), or `0` for an **empty cart** or when a rule freed it.
- `total = max(0, subtotal - sum of discounts) + shipping`, rounded to 2 decimals.

Rule makers:

- `percentOff(pct)` → label `PCT% off`, discount `subtotal × pct / 100`.
- `bulkDiscount(sku, minQty, pct)` → label `bulk SKU`, when the **total quantity of that sku** is at least `minQty`: `pct`% off **that sku's lines**.
- `fixedOff(amount, minSubtotal = 0)` → label `AMOUNT off`, discount `min(amount, subtotal)` when `subtotal >= minSubtotal` (and the subtotal is above 0).
- `freeShippingOver(threshold)` → label `free shipping`, `freeShipping: true` when `subtotal >= threshold`.

Rules that don't apply return `null`.

```js
const pricer = createPricer([percentOff(10), freeShippingOver(50)]);
pricer.quote({ items: [{ sku: 'a', price: 30, qty: 2 }] }); // subtotal 60, discount 6, shipping 0, total 54
```

%% worked
**A similar problem, solved: `createChecker(rules)`** — a list of strategies, each looking at the same input.

```js
export function createChecker(rules) {
  return {
    run(order) {
      const findings = [];
      for (const rule of rules) {
        const result = rule(order);                      // ① every rule gets the same input
        if (result) findings.push(result);               // ② null means "does not apply"
      }
      return findings;
    },
  };
}
```

The engine never mentions "percent" or "bulk": new offers are new functions. Round money at the end of each calculation (`Math.round(x * 100) / 100`) to avoid results like `0.30000000000000004`.

%% explain
- **The engine** only runs rules and totals the results.
- **Rule makers** return rules; inapplicable rules return `null`.
- **Shipping**: default 5, `0` when empty or freed by a rule.
- **Totals** never go below zero and are rounded.

%% nudge
- What input does each rule receive, and what does it return when it doesn't apply?
- When is shipping charged?

%% starter
```js
const round2 = (x) => Math.round(x * 100) / 100;

export const percentOff = (pct) => (cart, subtotal) => null;
export const bulkDiscount = (sku, minQty, pct) => (cart, subtotal) => null;
export const fixedOff = (amount, minSubtotal = 0) => (cart, subtotal) => null;
export const freeShippingOver = (threshold) => (cart, subtotal) => null;

export function createPricer(rules) {
  return {
    quote(cart) {
      return { subtotal: 0, discounts: [], shipping: 0, total: 0 };
    },
  };
}
```

%% tests
```js
const cart = (items, shipping) => (shipping === undefined ? { items } : { items, shipping });
const item = (sku, price, qty) => ({ sku, price, qty });

describe('createPricer', () => {
  it('totals a cart without rules', () => {
    const q = createPricer([]).quote(cart([item('a', 10, 2), item('b', 5.5, 1)]));
    expect(q).toEqual({ subtotal: 25.5, discounts: [], shipping: 5, total: 30.5 });
  });
  it('rounds money', () => {
    const q = createPricer([]).quote(cart([item('a', 0.1, 3)], 0));
    expect(q.subtotal).toBe(0.3);
    expect(q.total).toBe(0.3);
  });
  it('uses the cart shipping and charges none for an empty cart', () => {
    expect(createPricer([]).quote(cart([item('a', 10, 1)], 8)).shipping).toBe(8);
    expect(createPricer([]).quote(cart([])).shipping).toBe(0);
    expect(createPricer([]).quote(cart([])).total).toBe(0);
  });
  it('applies percentOff', () => {
    const q = createPricer([percentOff(10)]).quote(cart([item('a', 30, 2)]));
    expect(q.discounts).toEqual([{ label: '10% off', amount: 6 }]);
    expect(q.total).toBe(59);
  });
  it('applies bulkDiscount only when the quantity is reached', () => {
    const rules = [bulkDiscount('a', 3, 20)];
    const few = createPricer(rules).quote(cart([item('a', 10, 2), item('b', 100, 1)]));
    expect(few.discounts).toEqual([]);
    const many = createPricer(rules).quote(cart([item('a', 10, 2), item('a', 10, 1), item('b', 100, 1)]));
    expect(many.discounts).toEqual([{ label: 'bulk a', amount: 6 }]);
    expect(many.subtotal).toBe(130);
    expect(many.total).toBe(130 - 6 + 5);
  });
  it('applies fixedOff with a minimum and never beyond the subtotal', () => {
    expect(createPricer([fixedOff(5, 50)]).quote(cart([item('a', 40, 1)])).discounts).toEqual([]);
    const q = createPricer([fixedOff(5, 50)]).quote(cart([item('a', 60, 1)]));
    expect(q.discounts).toEqual([{ label: '5 off', amount: 5 }]);
    const small = createPricer([fixedOff(20)]).quote(cart([item('a', 8, 1)], 0));
    expect(small.discounts).toEqual([{ label: '20 off', amount: 8 }]);
    expect(small.total).toBe(0);
  });
  it('frees shipping over a threshold', () => {
    const rules = [freeShippingOver(50)];
    expect(createPricer(rules).quote(cart([item('a', 49.99, 1)])).shipping).toBe(5);
    const q = createPricer(rules).quote(cart([item('a', 50, 1)]));
    expect(q.shipping).toBe(0);
    expect(q.discounts).toEqual([]);
    expect(q.total).toBe(50);
  });
  it('combines rules in order, each seeing the original subtotal', () => {
    const q = createPricer([percentOff(10), fixedOff(5), freeShippingOver(50)]).quote(cart([item('a', 30, 2)]));
    expect(q.subtotal).toBe(60);
    expect(q.discounts).toEqual([{ label: '10% off', amount: 6 }, { label: '5 off', amount: 5 }]);
    expect(q.shipping).toBe(0);
    expect(q.total).toBe(49);
  });
  it('never lets the total go below zero', () => {
    const q = createPricer([percentOff(60), percentOff(60)]).quote(cart([item('a', 10, 1)], 0));
    expect(q.total).toBe(0);
  });
  it('accepts custom rules', () => {
    const rule = (c) => (c.items.some((i) => i.sku === 'promo') ? { label: 'promo', discount: 1 } : null);
    expect(createPricer([rule]).quote(cart([item('promo', 10, 1)], 0)).total).toBe(9);
  });
});
```

%% hints
- `quote`: compute `subtotal`, loop rules, collect `discounts` and a `free` flag, then total.
- `bulkDiscount`: filter the lines with that sku, sum `qty`; discount is `sum(price × qty) × pct / 100`.
- Use `round2` for `subtotal`, each discount `amount`, and `total`.

%% solution
```js
const round2 = (x) => Math.round(x * 100) / 100;

export const percentOff = (pct) => (cart, subtotal) =>
  subtotal > 0 ? { label: `${pct}% off`, discount: (subtotal * pct) / 100 } : null;

export const bulkDiscount = (sku, minQty, pct) => (cart) => {
  const lines = cart.items.filter((i) => i.sku === sku);
  const qty = lines.reduce((n, i) => n + i.qty, 0);
  if (qty < minQty) return null;
  const value = lines.reduce((sum, i) => sum + i.price * i.qty, 0);
  return { label: `bulk ${sku}`, discount: (value * pct) / 100 };
};

export const fixedOff = (amount, minSubtotal = 0) => (cart, subtotal) =>
  subtotal > 0 && subtotal >= minSubtotal ? { label: `${amount} off`, discount: Math.min(amount, subtotal) } : null;

export const freeShippingOver = (threshold) => (cart, subtotal) =>
  subtotal >= threshold ? { label: 'free shipping', freeShipping: true } : null;

export function createPricer(rules) {
  return {
    quote(cart) {
      const items = cart.items ?? [];
      const subtotal = round2(items.reduce((sum, i) => sum + i.price * i.qty, 0));
      const discounts = [];
      let freeShipping = false;
      for (const rule of rules) {
        const result = rule(cart, subtotal);
        if (!result) continue;
        if (result.freeShipping) freeShipping = true;
        if (result.discount > 0) discounts.push({ label: result.label, amount: round2(result.discount) });
      }
      const discounted = discounts.reduce((sum, d) => sum + d.amount, 0);
      const shipping = items.length === 0 || freeShipping ? 0 : cart.shipping ?? 5;
      const total = round2(Math.max(0, subtotal - discounted) + shipping);
      return { subtotal, discounts, shipping, total };
    },
  };
}
```

%% exercise pat-undoable-store | An undoable store | 3 | js | js | createUndoableStore | 26
Combine an **observable store** with **undo/redo snapshots**. `createUndoableStore({ initial, reducer, limit = 100 })`:

- `getState()` returns the current state.
- `dispatch(action)` computes `next = reducer(state, action)`. If `next` is the **same reference** (`Object.is`) as the current state, nothing happens (no history, no notification). Otherwise the previous state goes onto the **undo** history (at most `limit` entries; the oldest is dropped), the **redo** history is cleared, and subscribers are notified. It returns the current state.
- `undo()` / `redo()` move between states, notify subscribers, and return `true`, or `false` when there is nothing to do.
- `canUndo()` and `canRedo()`.
- `subscribe(listener)` returns an unsubscribe function; `listener(state)` is called after **every real change** (dispatch, undo, redo), never on subscribe.

```js
const store = createUndoableStore({ initial: { n: 0 }, reducer: (s, a) => (a.type === 'inc' ? { n: s.n + 1 } : s) });
store.dispatch({ type: 'inc' }); store.undo(); // back to { n: 0 }
```

%% worked
**A similar problem, solved: `createHistoryCell(initial)`** — a value with a past and a future.

```js
function createHistoryCell(initial) {
  let value = initial;
  const past = [], future = [];
  return {
    set(next) { past.push(value); value = next; future.length = 0; },     // ① remember the old value, drop the future
    undo() { if (!past.length) return false; future.push(value); value = past.pop(); return true; },
    redo() { if (!future.length) return false; past.push(value); value = future.pop(); return true; },
    get: () => value,
  };
}
```

Snapshots are enough because **a reducer never mutates**: each state is a separate object. Add the observer part by keeping a `Set` of listeners and notifying a snapshot of it after each change.

%% explain
- **Reducer** computes the next state; an unchanged reference is a no-op.
- **Past and future stacks** of states; a new dispatch clears the future; `limit` trims the past.
- **Listeners** get the new state after dispatch, undo and redo.

%% nudge
- Why is no copying needed for snapshots here?
- What happens to the future when you dispatch after an undo?

%% starter
```js
export function createUndoableStore({ initial, reducer, limit = 100 }) {
  let state = initial;
  const past = [];
  const future = [];
  const listeners = new Set();
  return {
    getState: () => state,
    dispatch(action) { return state; },
    undo() { return false; },
    redo() { return false; },
    canUndo: () => false,
    canRedo: () => false,
    subscribe(listener) { return () => {}; },
  };
}
```

%% tests
```js
const reducer = (s, a) => {
  if (a.type === 'inc') return { n: s.n + 1 };
  if (a.type === 'add') return { n: s.n + a.by };
  return s;
};
const make = (opts = {}) => createUndoableStore({ initial: { n: 0 }, reducer, ...opts });

describe('createUndoableStore', () => {
  it('dispatches through the reducer', () => {
    const store = make();
    expect(store.dispatch({ type: 'inc' })).toEqual({ n: 1 });
    store.dispatch({ type: 'add', by: 5 });
    expect(store.getState()).toEqual({ n: 6 });
  });
  it('ignores actions that do not change the state', () => {
    const store = make();
    const listener = jest.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'unknown' });
    expect(listener).not.toHaveBeenCalled();
    expect(store.canUndo()).toBe(false);
  });
  it('undoes and redoes', () => {
    const store = make();
    store.dispatch({ type: 'inc' });
    store.dispatch({ type: 'inc' });
    expect(store.undo()).toBe(true);
    expect(store.getState()).toEqual({ n: 1 });
    expect(store.canRedo()).toBe(true);
    expect(store.redo()).toBe(true);
    expect(store.getState()).toEqual({ n: 2 });
    expect(store.canRedo()).toBe(false);
  });
  it('reports nothing to undo or redo', () => {
    const store = make();
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(false);
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
  });
  it('a new dispatch clears the future', () => {
    const store = make();
    store.dispatch({ type: 'inc' });
    store.undo();
    store.dispatch({ type: 'add', by: 10 });
    expect(store.canRedo()).toBe(false);
    expect(store.redo()).toBe(false);
    expect(store.getState()).toEqual({ n: 10 });
  });
  it('limits how far back you can go', () => {
    const store = make({ limit: 2 });
    for (let i = 0; i < 4; i++) store.dispatch({ type: 'inc' });
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(false);
    expect(store.getState()).toEqual({ n: 2 });
  });
  it('notifies subscribers on dispatch, undo and redo, with the new state', () => {
    const store = make();
    const seen = [];
    const off = store.subscribe((s) => seen.push(s.n));
    store.dispatch({ type: 'inc' });
    store.dispatch({ type: 'inc' });
    store.undo();
    store.redo();
    expect(seen).toEqual([1, 2, 1, 2]);
    off();
    store.dispatch({ type: 'inc' });
    expect(seen).toHaveLength(4);
  });
  it('does not notify on a failed undo or redo, or on subscribe', () => {
    const store = make();
    const listener = jest.fn();
    store.subscribe(listener);
    store.undo(); store.redo();
    expect(listener).not.toHaveBeenCalled();
  });
  it('keeps old states unmodified', () => {
    const store = make();
    const first = store.getState();
    store.dispatch({ type: 'inc' });
    expect(first).toEqual({ n: 0 });
    store.undo();
    expect(store.getState()).toBe(first);
  });
});
```

%% hints
- `dispatch`: `const next = reducer(state, action); if (Object.is(next, state)) return state; past.push(state); while (past.length > limit) past.shift(); future.length = 0; state = next; notify(); return state;`
- `undo`: `if (!past.length) return false; future.push(state); state = past.pop(); notify(); return true;`
- `notify`: `for (const l of [...listeners]) l(state);`

%% solution
```js
export function createUndoableStore({ initial, reducer, limit = 100 }) {
  let state = initial;
  const past = [];
  const future = [];
  const listeners = new Set();
  const notify = () => {
    for (const listener of [...listeners]) listener(state);
  };
  return {
    getState: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (Object.is(next, state)) return state;
      past.push(state);
      while (past.length > limit) past.shift();
      future.length = 0;
      state = next;
      notify();
      return state;
    },
    undo() {
      if (!past.length) return false;
      future.push(state);
      state = past.pop();
      notify();
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(state);
      state = future.pop();
      notify();
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

%% exercise pat-resilient-client | A resilient client | 4 | js | js | withRetry, withCache, withDedupe, compose | 36
Write four **async decorators** for any function that returns a promise. Each returns a function with the same shape, forwards `this` and arguments, and returns the promise's value.

- `withRetry(fn, { attempts = 3, sleep, shouldRetry = () => true })`: on failure, if attempts remain **and** `shouldRetry(error)` is true, `await sleep(100 * 2 ** i)` (`i` = zero-based attempt that just failed) and try again; otherwise rethrow that error. `attempts` that isn't an integer ≥ 1 throws `RangeError` when decorating.
- `withCache(fn, { ttlMs, clock, key = (...args) => JSON.stringify(args) })`: remembers **successful** results by key for `ttlMs` (a result is fresh while `clock.now() - storedAt < ttlMs`, where `storedAt` is read when the result arrived). Failures are not cached.
- `withDedupe(fn, { key = (...args) => JSON.stringify(args) } = {})`: while a call with a key is **in flight**, further calls with the same key return the **same promise** and don't call `fn` again. After it settles (success or failure) the next call calls `fn` again.
- `compose(...decorators)` returns a decorator: `compose(a, b, c)(fn)` is `a(b(c(fn)))` (the **first** is outermost).

```js
const getUser = compose((f) => withCache(f, { ttlMs: 60000, clock }), (f) => withRetry(f, { sleep }))(fetchUser);
```

%% worked
**A similar problem, solved: `withTimeoutValue(fn, ms, fallback)`** — an async decorator that keeps the function's shape.

```js
export function withFallback(fn, fallback) {
  return async function (...args) {                       // ① same shape: takes args, returns a promise
    try {
      return await fn.apply(this, args);                  // ② forward this and arguments
    } catch {
      return fallback;                                    // ③ the extra behaviour
    }
  };
}

export const compose = (...ds) => (fn) => ds.reduceRight((inner, d) => d(inner), fn);   // ④ wrap from the inside out
```

`reduceRight` wraps the **last** decorator first (innermost), so the first ends up outermost. For `withDedupe`, store the promise in a `Map` while it runs and delete it in a `finally`; for `withCache`, store `{ value, at }` after the call succeeds.

%% explain
- **`withRetry`**: loop with exponential sleeps; rethrow the last error; `shouldRetry` can stop early.
- **`withCache`**: successful results only, keyed, with a TTL from the injected clock.
- **`withDedupe`**: share an in-flight promise per key; forget it when it settles.
- **`compose`**: first decorator outermost.

%% nudge
- Where is the promise stored in `withDedupe`, and when is it removed?
- Why must `compose` use `reduceRight`?

%% starter
```js
export function withRetry(fn, { attempts = 3, sleep, shouldRetry = () => true } = {}) {
  return async function (...args) {
    return fn.apply(this, args);
  };
}

export function withCache(fn, { ttlMs, clock, key = (...args) => JSON.stringify(args) }) {
  return async function (...args) {
    return fn.apply(this, args);
  };
}

export function withDedupe(fn, { key = (...args) => JSON.stringify(args) } = {}) {
  return function (...args) {
    return fn.apply(this, args);
  };
}

export function compose(...decorators) {
  return (fn) => fn;
}
```

%% tests
```js
const makeClock = () => { let t = 0; return { now: () => t, advance: (d) => { t += d; } }; };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flaky = (failures, value = 'ok') => {
  let n = 0;
  return jest.fn(async () => { n++; if (n <= failures) throw new Error('fail ' + n); return value; });
};

describe('withRetry', () => {
  it('returns at once on success', async () => {
    const sleep = jest.fn(async () => {});
    const fn = flaky(0);
    expect(await withRetry(fn, { sleep })()).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it('retries with exponential waits', async () => {
    const sleep = jest.fn(async () => {});
    const fn = flaky(2);
    expect(await withRetry(fn, { attempts: 3, sleep })()).toBe('ok');
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });
  it('rethrows the last error after the last attempt without a final sleep', async () => {
    const sleep = jest.fn(async () => {});
    const fn = flaky(99);
    await expect(withRetry(fn, { attempts: 3, sleep })()).rejects.toThrow('fail 3');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
  it('stops when shouldRetry says no', async () => {
    const sleep = jest.fn(async () => {});
    const fn = flaky(99);
    await expect(withRetry(fn, { attempts: 5, sleep, shouldRetry: (e) => e.message !== 'fail 2' })()).rejects.toThrow('fail 2');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
  it('forwards this and arguments, and validates attempts', async () => {
    const obj = { k: 3, run: withRetry(async function (x) { return this.k * x; }, { sleep: async () => {} }) };
    expect(await obj.run(4)).toBe(12);
    expect(() => withRetry(async () => {}, { attempts: 0 })).toThrow(RangeError);
    expect(() => withRetry(async () => {}, { attempts: 1.5 })).toThrow(RangeError);
  });
});

describe('withCache', () => {
  it('caches successful results by arguments for the ttl', async () => {
    const clock = makeClock();
    const fn = jest.fn(async (id) => ({ id }));
    const cached = withCache(fn, { ttlMs: 1000, clock });
    const a = await cached(1);
    expect(await cached(1)).toBe(a);
    await cached(2);
    expect(fn).toHaveBeenCalledTimes(2);
    clock.advance(999);
    await cached(1);
    expect(fn).toHaveBeenCalledTimes(2);
    clock.advance(1);
    await cached(1);
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it('does not cache failures', async () => {
    const clock = makeClock();
    const fn = flaky(1);
    const cached = withCache(fn, { ttlMs: 1000, clock });
    await expect(cached()).rejects.toThrow('fail 1');
    expect(await cached()).toBe('ok');
    expect(await cached()).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('supports a custom key and caches falsy values', async () => {
    const clock = makeClock();
    const fn = jest.fn(async () => 0);
    const cached = withCache(fn, { ttlMs: 1000, clock, key: (o) => o.id });
    await cached({ id: 1, noise: 'a' });
    await cached({ id: 1, noise: 'b' });
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('measures freshness from when the result arrived', async () => {
    const clock = makeClock();
    const gate = deferred();
    const fn = jest.fn(() => gate.promise);
    const cached = withCache(fn, { ttlMs: 100, clock });
    const first = cached();
    clock.advance(500);
    gate.resolve('late');
    await first;
    clock.advance(99);
    expect(await cached()).toBe('late');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('withDedupe', () => {
  it('shares one in-flight call per key', async () => {
    const gate = deferred();
    const fn = jest.fn(() => gate.promise);
    const deduped = withDedupe(fn);
    const a = deduped(1), b = deduped(1), c = deduped(2);
    expect(a).toBe(b);
    expect(fn).toHaveBeenCalledTimes(2);
    gate.resolve('x');
    expect(await a).toBe('x');
    expect(await c).toBe('x');
  });
  it('calls again after the previous call settled', async () => {
    const fn = jest.fn(async () => 'v');
    const deduped = withDedupe(fn);
    await deduped();
    await deduped();
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('shares a failure and then recovers', async () => {
    let fail = true;
    const gate = deferred();
    const fn = jest.fn(() => (fail ? gate.promise : Promise.resolve('fine')));
    const deduped = withDedupe(fn);
    const a = deduped(), b = deduped();
    gate.reject(new Error('shared failure'));
    await expect(a).rejects.toThrow('shared failure');
    await expect(b).rejects.toThrow('shared failure');
    fail = false;
    expect(await deduped()).toBe('fine');
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('supports a custom key', async () => {
    const gate = deferred();
    const fn = jest.fn(() => gate.promise);
    const deduped = withDedupe(fn, { key: (o) => o.id });
    deduped({ id: 1, x: 'a' });
    deduped({ id: 1, x: 'b' });
    expect(fn).toHaveBeenCalledTimes(1);
    gate.resolve();
  });
});

describe('compose', () => {
  it('makes the first decorator outermost', async () => {
    const log = [];
    const tag = (name) => (f) => async (...args) => { log.push(name + ' in'); const r = await f(...args); log.push(name + ' out'); return r; };
    const fn = compose(tag('A'), tag('B'), tag('C'))(async () => { log.push('core'); return 1; });
    expect(await fn()).toBe(1);
    expect(log).toEqual(['A in', 'B in', 'C in', 'core', 'C out', 'B out', 'A out']);
  });
  it('with no decorators returns the function itself', () => {
    const fn = async () => 1;
    expect(compose()(fn)).toBe(fn);
  });
  it('builds a resilient client from the other decorators', async () => {
    const clock = makeClock();
    const sleep = jest.fn(async () => {});
    const gate = deferred();
    let calls = 0;
    const fetchUser = jest.fn(async (id) => { calls++; if (calls === 1) throw new Error('timeout'); await gate.promise; return { id }; });
    const getUser = compose(
      (f) => withCache(f, { ttlMs: 1000, clock }),
      (f) => withDedupe(f),
      (f) => withRetry(f, { attempts: 3, sleep }),
    )(fetchUser);
    const a = getUser(7), b = getUser(7);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    gate.resolve();
    expect(await a).toEqual({ id: 7 });
    expect(await b).toEqual({ id: 7 });
    expect(fetchUser).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls).toEqual([[100]]);
    await getUser(7);
    expect(fetchUser).toHaveBeenCalledTimes(2);
  });
});
```

%% hints
- `withRetry`: `for (let i = 0; i < attempts; i++) { try { return await fn.apply(this, args); } catch (e) { if (i === attempts - 1 || !shouldRetry(e)) throw e; await sleep(100 * 2 ** i); } }`
- `withCache`: `const entry = cache.get(k); if (entry && clock.now() - entry.at < ttlMs) return entry.value; const value = await fn.apply(this, args); cache.set(k, { value, at: clock.now() }); return value;`
- `withDedupe`: `if (inflight.has(k)) return inflight.get(k); const p = (async () => fn.apply(this, args))(); inflight.set(k, p); p.then(clear, clear)` where `clear` deletes the key (careful to avoid an unhandled rejection from the helper chain).
- `compose`: `(fn) => decorators.reduceRight((inner, d) => d(inner), fn)`.

%% solution
```js
export function withRetry(fn, { attempts = 3, sleep, shouldRetry = () => true } = {}) {
  if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError('attempts must be an integer >= 1');
  return async function (...args) {
    for (let i = 0; ; i++) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        if (i >= attempts - 1 || !shouldRetry(error)) throw error;
        await sleep(100 * 2 ** i);
      }
    }
  };
}

export function withCache(fn, { ttlMs, clock, key = (...args) => JSON.stringify(args) }) {
  const cache = new Map();
  return async function (...args) {
    const k = key(...args);
    const entry = cache.get(k);
    if (entry && clock.now() - entry.at < ttlMs) return entry.value;
    const value = await fn.apply(this, args);
    cache.set(k, { value, at: clock.now() });
    return value;
  };
}

export function withDedupe(fn, { key = (...args) => JSON.stringify(args) } = {}) {
  const inflight = new Map();
  return function (...args) {
    const k = key(...args);
    if (inflight.has(k)) return inflight.get(k);
    const promise = (async () => fn.apply(this, args))();
    inflight.set(k, promise);
    const clear = () => {
      if (inflight.get(k) === promise) inflight.delete(k);
    };
    promise.then(clear, clear);
    return promise;
  };
}

export function compose(...decorators) {
  return (fn) => decorators.reduceRight((inner, decorator) => decorator(inner), fn);
}
```
