---
id: pat-factories-builders
track: pat
title: Factories, builders & shared instances
summary: Creational patterns the JavaScript way: factory functions and registries instead of scattered new calls, immutable fluent builders for objects with many options, lazy singletons through a container, and object pools.
---

## The idea in one sentence

**Creational patterns** put the *how an object gets made* in one place, so the rest of the code asks for what it needs and never cares how it is built.

> **Analogy** A restaurant kitchen. You order "the soup of the day" and a bowl arrives. You don't pick the pot, the stove or the chef. If the recipe changes tomorrow, your order stays the same. A **factory** is the kitchen: a stable way to ask, and freedom to change what happens behind it.

In JavaScript you rarely need class hierarchies for this. **Functions that return objects** (closures and plain objects) do the job, and a tiny **registry** (a `Map`) gives you the open-ended variety.

## Factory functions

A **factory** is a function that returns a ready-to-use object. The caller says *what*, the factory decides *how*.

![A factory with a registry](fig:pat-factory "The caller never says new: it passes a name and arguments, and gets something that behaves like every other shape.")

```js try predict
const makers = new Map([
  ['circle', (r) => ({ area: () => Math.PI * r * r })],
  ['square', (s) => ({ area: () => s * s })],
]);

function createShape(type, ...args) {
  const make = makers.get(type);
  if (!make) throw new Error('unknown shape: ' + type);
  return { type, ...make(...args) };
}

console.log(createShape('square', 3).area());
console.log(createShape('circle', 1).type);
try { createShape('blob'); } catch (e) { console.log(e.message); }
```

Why this beats scattered `new Circle(...)`:

- **One place to change** construction (add defaults, validation, caching).
- **The caller depends on a shape of behaviour**, not a concrete class.
- With a registry, you can **add a new kind without editing the factory** (open for extension, closed for modification). A plugin calls `registerShape('triangle', …)`.

## Builders

When an object has many **optional** settings, a constructor with eight positional arguments is unreadable. A **builder** collects settings step by step and creates the object at the end.

![An immutable builder](fig:pat-builder "Each step returns a new builder, so earlier builders stay valid and can branch.")

The JavaScript-friendly version is **immutable and fluent**: every method returns a **new** builder instead of changing `this`.

```stepper An immutable builder branching
code:
  const base = query().from('users');
  const adults = base.where('age >= 18');
  const admins = base.where("role = 'admin'");
  console.log(adults.build());
---
line: 1
say: `base` is a builder that knows only the table. It is a **value** you can reuse as a starting point.
base: SELECT * FROM users
---
line: 2
say: `.where(...)` does **not** change `base`: it returns a **new** builder that remembers the extra filter.
adults: SELECT * FROM users WHERE age >= 18
base: SELECT * FROM users
---
line: 3
say: A second branch from the **same** base. Because nothing was mutated, `admins` knows nothing about `adults`.
admins: SELECT * FROM users WHERE role = 'admin'
---
line: 4
say: `build()` turns the collected settings into the final result. A **mutating** builder would have leaked the `age` filter into `admins` too: the classic bug this design prevents.
output: SELECT * FROM users WHERE age >= 18
```

```js try
function query(state = { cols: ['*'], where: [] }) {
  return {
    from: (table) => query({ ...state, table }),
    where: (cond) => query({ ...state, where: [...state.where, cond] }),
    build() {
      if (!state.table) throw new Error('from() is required');
      const w = state.where.length ? ' WHERE ' + state.where.join(' AND ') : '';
      return `SELECT ${state.cols.join(', ')} FROM ${state.table}${w}`;
    },
  };
}
const base = query().from('users');
console.log(base.where('a = 1').where('b = 2').build());
console.log(base.build());
```

The builder also gives you a place for **validation at the end**: `build()` can refuse an incomplete or inconsistent result.

## Shared instances: singletons, carefully

Sometimes you really want **one** shared thing: a config, a database connection. The textbook **singleton** makes it a global that anyone can reach. That is the problem: hidden coupling and tests that influence each other.

![Global singleton versus passed-in instance](fig:pat-singleton "Sharing is fine. Hiding the sharing is what hurts.")

A better JavaScript shape is a small **container** (also called a service registry) that creates each shared thing **lazily, once**, and hands it to whoever asks, usually from the top of your program:

```js
const c = createContainer();
c.register('config', () => ({ url: 'db://prod' }));
c.register('db', (c) => connect(c.get('config').url));   // dependencies come from the container
c.get('db') === c.get('db');                             // true: created once, then reused
```

Tests build their **own** container with fakes, so nothing global leaks.

## Object pools

Creating some objects is **expensive** (connections, big buffers). An **object pool** keeps spare ones around: you **acquire** one, use it, then **release** it so someone else can reuse it. A cap protects the resource.

## Quick check

```check
Q: What is the main benefit of a factory function?
A) It makes code run faster
B) Callers ask for what they need and one place decides how it is built *
C) It removes the need for objects
D) It forbids classes
Why: Centralising construction lets you change, validate or extend it without touching the callers.
---
Q: Why is a registry (a Map of makers) good for a factory?
A) It sorts the shapes
B) New kinds can be added without editing the factory itself *
C) It caches results
D) It makes errors disappear
Why: Registration is an extension point: open for extension, closed for modification.
---
Q: Why should a fluent builder return a new builder from each step?
A) To use more memory
B) So earlier builders are not changed and can safely branch *
C) Because JavaScript requires it
D) To make build() faster
Why: With mutation, one branch's settings would leak into every other branch built from the same base.
---
Q: What is the real problem with a classic global singleton?
A) There is only one of it
B) It is hidden coupling: any code can reach and change it, and tests influence each other *
C) It uses too much memory
D) It cannot hold data
Why: Sharing one instance is fine; making it reachable from anywhere makes the dependency invisible.
---
Q: When is an object pool worth it?
A) For every object
B) When objects are expensive to create and can be safely reused *
C) When objects are tiny
D) Never
Why: Pools trade complexity for the cost of creation; they pay off for connections and large buffers.
```

## Recap

- A **factory** hides construction behind a stable call; a **registry** makes it extensible.
- A **builder** assembles complex objects step by step; make it **immutable** so branches are safe, and **validate in `build()`**.
- A **singleton** is fine as a *shared instance* but dangerous as a *global*; use a **container** and pass dependencies in.
- A **pool** reuses expensive objects within a cap.
- In JavaScript, **closures and plain objects** replace most class machinery.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a logger factory | A closure over `level` and `sink`; a rank table |
| A shape factory | A `Map` registry; spread of the product; an error for unknown types |
| An immutable query builder | Returning a new builder from every method; building the string last |
| A lazy service container | A cache `Map`, a "currently resolving" list for cycles, `try/finally` |
| An object pool | `idle` and `inUse` sets; a cap; refusing foreign objects |

%% exercise pat-guided-logger | Guided: a logger factory | 1 | js | js | createLogger | 8 | guided
Implement `createLogger({ level = 'info', sink })`. It returns an object with the methods `debug`, `info`, `warn` and `error`. The levels rank `debug < info < warn < error`. Calling a method sends `LEVEL: message` (the level name in capitals) to `sink` **only if** that method's rank is **at least** the configured `level`.

```js
const log = createLogger({ level: 'warn', sink: console.log });
log.info('hi');  // nothing: info is below warn
log.error('no'); // sink('ERROR: no')
```

%% worked
**A similar problem, solved: `createGreeterFactory(prefix)`** — a factory returns an object whose methods remember the factory's arguments.

```js
function createGreeterFactory(prefix) {
  return {
    greet(name) { return `${prefix}, ${name}!`; },        // ① the closure remembers prefix
    shout(name) { return `${prefix}, ${name}!`.toUpperCase(); },
  };
}
```

Each call to the factory makes a **separate** object with its own remembered settings. Your logger remembers `level` and `sink` the same way.

%% explain
- **A rank table** `{ debug: 0, info: 1, warn: 2, error: 3 }`.
- **Four methods**, built from one helper.
- **Default level** is `info`.
- **Message format**: `WARN: disk low`.

%% nudge
- How do you compare two levels? A table of numbers helps.
- Can you build all four methods without repeating the same code four times?

%% starter
```js
export function createLogger({ level = 'info', sink }) {
  // Step 1 — const RANK = { debug: 0, info: 1, warn: 2, error: 3 };
  // Step 2 — a helper that checks the rank and calls sink(`${name.toUpperCase()}: ${message}`)
  return {
    debug(message) {},
    info(message) {},
    warn(message) {},
    error(message) {},
  };
}
```

%% tests
```js
describe('createLogger', () => {
  it('defaults to info', () => {
    const sink = jest.fn();
    const log = createLogger({ sink });
    log.debug('d'); log.info('i');
    expect(sink.mock.calls).toEqual([['INFO: i']]);
  });
  it('filters below the level', () => {
    const sink = jest.fn();
    const log = createLogger({ level: 'warn', sink });
    log.debug('a'); log.info('b'); log.warn('c'); log.error('d');
    expect(sink.mock.calls).toEqual([['WARN: c'], ['ERROR: d']]);
  });
  it('debug level lets everything through', () => {
    const sink = jest.fn();
    const log = createLogger({ level: 'debug', sink });
    log.debug('a'); log.info('b'); log.warn('c'); log.error('d');
    expect(sink).toHaveBeenCalledTimes(4);
    expect(sink).toHaveBeenNthCalledWith(1, 'DEBUG: a');
  });
  it('error level only lets errors through', () => {
    const sink = jest.fn();
    const log = createLogger({ level: 'error', sink });
    log.warn('x'); log.error('y');
    expect(sink.mock.calls).toEqual([['ERROR: y']]);
  });
  it('makes independent loggers', () => {
    const a = jest.fn(), b = jest.fn();
    createLogger({ level: 'debug', sink: a }).debug('x');
    createLogger({ level: 'error', sink: b }).debug('x');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});
```

%% hints
- `const log = (name) => (message) => { if (RANK[name] >= RANK[level]) sink(`${name.toUpperCase()}: ${message}`); };`
- `return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };`

%% solution
```js
export function createLogger({ level = 'info', sink }) {
  const RANK = { debug: 0, info: 1, warn: 2, error: 3 };
  const log = (name) => (message) => {
    if (RANK[name] >= RANK[level]) sink(`${name.toUpperCase()}: ${message}`);
  };
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  };
}
```

%% exercise pat-shape-factory | A shape factory with a registry | 2 | js | js | createShape, registerShape | 16
Implement `createShape(type, ...args)` and `registerShape(type, make)`.

- Built in: `'circle'` (radius), `'rect'` (width, height), `'square'` (side).
- `createShape` returns `{ type, area(), perimeter() }`.
- An unknown type throws `Error('unknown shape: TYPE')`.
- `registerShape(type, make)` adds a new kind, where `make(...args)` returns an object with `area()` and `perimeter()`. Registering a type that **already exists** throws `Error('already registered: TYPE')`.

```js
createShape('rect', 2, 3).area(); // 6
```

%% worked
**A similar problem, solved: `createUnit(name, value)` with a registry** — an extensible lookup table of makers.

```js
const makers = new Map([['meters', (v) => ({ toMeters: () => v })]]);   // ① the registry
export function registerUnit(name, make) {
  if (makers.has(name)) throw new Error('already registered: ' + name); // ② refuse duplicates
  makers.set(name, make);
}
export function createUnit(name, value) {
  const make = makers.get(name);
  if (!make) throw new Error('unknown unit: ' + name);                  // ③ fail loudly
  return { name, ...make(value) };                                      // ④ the factory adds the common part
}
```

The factory itself never changes when a new kind arrives: only the registry grows.

%% explain
- **Registry** of makers keyed by type, pre-filled with three shapes.
- **Circle**: `Math.PI * r²`, `2 * Math.PI * r`.
- **Unknown or duplicate** types throw the exact messages.
- **Result** always includes `type`.

%% nudge
- Where do the three built-in shapes live, so that `registerShape` can add to the same place?
- What does the factory add that every shape shares?

%% starter
```js
const makers = new Map();

export function registerShape(type, make) {
  // your code
}

export function createShape(type, ...args) {
  // your code
}
```

%% tests
```js
describe('shape factory', () => {
  it('creates a circle', () => {
    const c = createShape('circle', 2);
    expect(c.type).toBe('circle');
    expect(c.area()).toBeCloseTo(Math.PI * 4, 6);
    expect(c.perimeter()).toBeCloseTo(4 * Math.PI, 6);
  });
  it('creates a rect and a square', () => {
    const r = createShape('rect', 2, 3);
    expect(r.area()).toBe(6);
    expect(r.perimeter()).toBe(10);
    const s = createShape('square', 4);
    expect(s.type).toBe('square');
    expect(s.area()).toBe(16);
    expect(s.perimeter()).toBe(16);
  });
  it('throws for an unknown type', () => {
    expect(() => createShape('blob')).toThrow('unknown shape: blob');
  });
  it('lets you register a new kind', () => {
    registerShape('triangle', (a, b, c) => {
      const s = (a + b + c) / 2;
      return { area: () => Math.sqrt(s * (s - a) * (s - b) * (s - c)), perimeter: () => a + b + c };
    });
    const t = createShape('triangle', 3, 4, 5);
    expect(t.type).toBe('triangle');
    expect(t.area()).toBe(6);
    expect(t.perimeter()).toBe(12);
  });
  it('refuses to register a type twice', () => {
    expect(() => registerShape('circle', () => ({}))).toThrow('already registered: circle');
  });
});
```

%% hints
- Pre-fill: `new Map([['circle', (r) => ({ area: () => Math.PI * r * r, perimeter: () => 2 * Math.PI * r })], ...])`.
- `createShape`: `const make = makers.get(type); if (!make) throw ...; return { type, ...make(...args) };`

%% solution
```js
const makers = new Map([
  ['circle', (r) => ({ area: () => Math.PI * r * r, perimeter: () => 2 * Math.PI * r })],
  ['rect', (w, h) => ({ area: () => w * h, perimeter: () => 2 * (w + h) })],
  ['square', (s) => ({ area: () => s * s, perimeter: () => 4 * s })],
]);

export function registerShape(type, make) {
  if (makers.has(type)) throw new Error('already registered: ' + type);
  makers.set(type, make);
}

export function createShape(type, ...args) {
  const make = makers.get(type);
  if (!make) throw new Error('unknown shape: ' + type);
  return { type, ...make(...args) };
}
```

%% exercise pat-query-builder | An immutable query builder | 3 | js | js | query | 22
Implement `query()`, which returns an **immutable** fluent builder.

- `select(...cols)` sets the columns (default `*`; calling it again **replaces** them).
- `from(table)`, `where(condition)` (**repeated calls are joined with `AND`**), `orderBy(column, direction = 'asc')` (direction is case-insensitive, otherwise `RangeError`), `limit(n)` (a non-negative integer, otherwise `RangeError`).
- Each method returns a **new** builder; the original is unchanged.
- `build()` returns e.g. `SELECT a, b FROM t WHERE x = 1 AND y = 2 ORDER BY a DESC LIMIT 5`. Without `from()` it throws `Error('from() is required')`.

```js
query().select('id').from('users').where('age > 18').limit(10).build();
// 'SELECT id FROM users WHERE age > 18 LIMIT 10'
```

%% worked
**A similar problem, solved: `url()`** — an immutable builder with validation in `build()`.

```js
export function url(state = { path: [], params: [] }) {
  return {
    host: (host) => url({ ...state, host }),                                  // ① copy the state, change one thing
    path: (seg) => url({ ...state, path: [...state.path, seg] }),             // ② arrays are copied, never pushed to
    param: (k, v) => url({ ...state, params: [...state.params, `${k}=${v}`] }),
    build() {
      if (!state.host) throw new Error('host() is required');                 // ③ validate at the end
      const q = state.params.length ? '?' + state.params.join('&') : '';
      return `https://${state.host}/${state.path.join('/')}${q}`;
    },
  };
}
```

The trick: the whole builder is a **function of its state object**. Each method calls the function again with a modified **copy** of the state.

%% explain
- **State object** `{ cols, table, wheres, order, limit }`, copied on every call.
- **Format** `SELECT … FROM … [WHERE …] [ORDER BY … DIR] [LIMIT n]` with single spaces.
- **Validation**: direction and limit; missing `from()`.
- **Immutability**: branching from one base gives independent queries.

%% nudge
- Which methods must copy arrays instead of pushing?
- Where do you build the string, and where do you validate?

%% starter
```js
export function query(state = { cols: ['*'], wheres: [] }) {
  return {
    select(...cols) { return this; },
    from(table) { return this; },
    where(condition) { return this; },
    orderBy(column, direction = 'asc') { return this; },
    limit(n) { return this; },
    build() { return ''; },
  };
}
```

%% tests
```js
describe('query builder', () => {
  it('builds a minimal query', () => {
    expect(query().from('users').build()).toBe('SELECT * FROM users');
  });
  it('builds a full query', () => {
    const sql = query().select('a', 'b').from('t').where('x = 1').where('y = 2').orderBy('a', 'desc').limit(5).build();
    expect(sql).toBe('SELECT a, b FROM t WHERE x = 1 AND y = 2 ORDER BY a DESC LIMIT 5');
  });
  it('defaults the direction to ASC and accepts any case', () => {
    expect(query().from('t').orderBy('n').build()).toBe('SELECT * FROM t ORDER BY n ASC');
    expect(query().from('t').orderBy('n', 'DeSc').build()).toBe('SELECT * FROM t ORDER BY n DESC');
  });
  it('select replaces earlier columns', () => {
    expect(query().select('a').select('b').from('t').build()).toBe('SELECT b FROM t');
  });
  it('is immutable and can branch', () => {
    const base = query().from('users');
    const adults = base.where('age >= 18');
    const admins = base.where("role = 'admin'");
    expect(base.build()).toBe('SELECT * FROM users');
    expect(adults.build()).toBe('SELECT * FROM users WHERE age >= 18');
    expect(admins.build()).toBe("SELECT * FROM users WHERE role = 'admin'");
  });
  it('allows limit 0 and validates', () => {
    expect(query().from('t').limit(0).build()).toBe('SELECT * FROM t LIMIT 0');
    expect(() => query().limit(-1)).toThrow(RangeError);
    expect(() => query().limit(1.5)).toThrow(RangeError);
    expect(() => query().orderBy('a', 'sideways')).toThrow(RangeError);
  });
  it('requires from()', () => {
    expect(() => query().select('a').build()).toThrow('from() is required');
  });
});
```

%% hints
- `from: (table) => query({ ...state, table })`; `where: (c) => query({ ...state, wheres: [...state.wheres, c] })`.
- Validate in `limit` and `orderBy` by throwing a `RangeError` before returning the new builder.
- `build`: assemble parts into an array and `join(' ')`.

%% solution
```js
export function query(state = { cols: ['*'], wheres: [] }) {
  return {
    select: (...cols) => query({ ...state, cols }),
    from: (table) => query({ ...state, table }),
    where: (condition) => query({ ...state, wheres: [...state.wheres, condition] }),
    orderBy(column, direction = 'asc') {
      const dir = String(direction).toUpperCase();
      if (dir !== 'ASC' && dir !== 'DESC') throw new RangeError('direction must be asc or desc');
      return query({ ...state, order: `${column} ${dir}` });
    },
    limit(n) {
      if (!Number.isInteger(n) || n < 0) throw new RangeError('limit must be a non-negative integer');
      return query({ ...state, limit: n });
    },
    build() {
      if (!state.table) throw new Error('from() is required');
      const parts = [`SELECT ${state.cols.join(', ')}`, `FROM ${state.table}`];
      if (state.wheres.length) parts.push('WHERE ' + state.wheres.join(' AND '));
      if (state.order) parts.push('ORDER BY ' + state.order);
      if (state.limit !== undefined) parts.push('LIMIT ' + state.limit);
      return parts.join(' ');
    },
  };
}
```

%% exercise pat-container | A lazy service container | 3 | js | js | createContainer | 22
Implement `createContainer()` with:

- `register(name, factory)`: stores a factory; registering a name twice throws `Error('already registered: NAME')`.
- `get(name)`: calls `factory(container)` the **first** time and **caches** the result (same object every time). An unknown name throws `Error('unknown service: NAME')`.
- `has(name)`: whether a factory is registered.
- **Circular** dependencies (a needs b needs a) throw `Error('circular dependency: a -> b -> a')`.
- If a factory **throws**, the error propagates and **nothing is cached**: a later `get` tries again.

```js
c.register('config', () => ({ url: 'db://x' }));
c.register('db', (c) => ({ url: c.get('config').url }));
c.get('db') === c.get('db'); // true
```

%% worked
**A similar problem, solved: `lazy(factory)`** — create once, on first use, and remember.

```js
function lazy(factory) {
  let made = false, value;
  return () => {
    if (!made) { value = factory(); made = true; }     // ① only the first call builds it
    return value;                                      // ② every call returns the same one
  };
}
```

Your container is a `Map` of these, plus a **stack of names being resolved** to detect a cycle: if you meet a name that is already on the stack, you've gone in a circle. Use `try/finally` to pop the stack even when a factory throws.

%% explain
- **Factories** stored by name; **instances** cached after first creation.
- **Cycle detection** with a "currently resolving" list; the message shows the path.
- **Failure leaves no trace**: nothing cached, stack cleaned.

%% nudge
- How do you know you are already in the middle of creating `a`?
- What must `finally` do when the factory throws?

%% starter
```js
export function createContainer() {
  const factories = new Map();
  const instances = new Map();
  const resolving = [];
  const container = {
    register(name, factory) {},
    get(name) {},
    has(name) { return false; },
  };
  return container;
}
```

%% tests
```js
describe('createContainer', () => {
  it('creates a service lazily, once', () => {
    const c = createContainer();
    const make = jest.fn(() => ({ id: 1 }));
    c.register('a', make);
    expect(make).not.toHaveBeenCalled();
    const first = c.get('a');
    expect(c.get('a')).toBe(first);
    expect(make).toHaveBeenCalledTimes(1);
  });
  it('passes the container to factories', () => {
    const c = createContainer();
    c.register('config', () => ({ url: 'db://x' }));
    c.register('db', (cc) => ({ url: cc.get('config').url }));
    expect(c.get('db')).toEqual({ url: 'db://x' });
    expect(c.get('config')).toBe(c.get('config'));
  });
  it('reports unknown and duplicate names', () => {
    const c = createContainer();
    expect(() => c.get('nope')).toThrow('unknown service: nope');
    c.register('a', () => 1);
    expect(() => c.register('a', () => 2)).toThrow('already registered: a');
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
  });
  it('can hold falsy values and caches them', () => {
    const c = createContainer();
    const make = jest.fn(() => 0);
    c.register('zero', make);
    expect(c.get('zero')).toBe(0);
    expect(c.get('zero')).toBe(0);
    expect(make).toHaveBeenCalledTimes(1);
  });
  it('detects circular dependencies', () => {
    const c = createContainer();
    c.register('a', (cc) => cc.get('b'));
    c.register('b', (cc) => cc.get('a'));
    expect(() => c.get('a')).toThrow('circular dependency: a -> b -> a');
  });
  it('retries after a factory throws', () => {
    const c = createContainer();
    let n = 0;
    c.register('flaky', () => { n++; if (n === 1) throw new Error('boom'); return 'ok'; });
    expect(() => c.get('flaky')).toThrow('boom');
    expect(c.get('flaky')).toBe('ok');
    c.register('uses', (cc) => cc.get('flaky') + '!');
    expect(c.get('uses')).toBe('ok!');
  });
});
```

%% hints
- `get`: if cached (`instances.has(name)`) return it; if not registered throw; if `resolving.includes(name)` throw with `[...resolving, name].join(' -> ')`.
- `resolving.push(name); try { const v = factories.get(name)(container); instances.set(name, v); return v; } finally { resolving.pop(); }`

%% solution
```js
export function createContainer() {
  const factories = new Map();
  const instances = new Map();
  const resolving = [];
  const container = {
    register(name, factory) {
      if (factories.has(name)) throw new Error('already registered: ' + name);
      factories.set(name, factory);
    },
    get(name) {
      if (instances.has(name)) return instances.get(name);
      if (!factories.has(name)) throw new Error('unknown service: ' + name);
      if (resolving.includes(name)) {
        throw new Error('circular dependency: ' + [...resolving, name].join(' -> '));
      }
      resolving.push(name);
      try {
        const value = factories.get(name)(container);
        instances.set(name, value);
        return value;
      } finally {
        resolving.pop();
      }
    },
    has(name) {
      return factories.has(name);
    },
  };
  return container;
}
```

%% exercise pat-object-pool | An object pool | 3 | js | js | createPool | 20
Implement `createPool({ create, reset = () => {}, max = Infinity })`.

- `acquire()` returns an idle object if there is one, otherwise calls `create()` for a new one, up to `max` objects in total. When all `max` are in use it throws `Error('pool exhausted')`.
- `release(obj)` calls `reset(obj)` and makes it available again. Releasing an object that is **not currently in use** (foreign, or released twice) throws `Error('not in use')`.
- `stats()` returns `{ idle, inUse, created }` (counts).

```js
const pool = createPool({ create: () => ({ buf: [] }), reset: (o) => { o.buf.length = 0; }, max: 2 });
const a = pool.acquire();
pool.release(a);
pool.acquire() === a; // true
```

%% worked
**A similar problem, solved: `createSlots(n)`** — a fixed number of reusable slots.

```js
function createSlots(n) {
  const free = Array.from({ length: n }, (_, i) => i);   // ① the ids that can be handed out
  const used = new Set();
  return {
    take() {
      if (free.length === 0) throw new Error('no slots');   // ② the cap
      const id = free.pop();
      used.add(id);
      return id;
    },
    give(id) {
      if (!used.delete(id)) throw new Error('not in use');  // ③ delete() tells you whether it was in use
      free.push(id);
    },
  };
}
```

Your pool is the same idea with objects, created on demand instead of up front.

%% explain
- **Idle list** and an **in-use set**; `created` counts every object ever made.
- **Reuse before creating**; creation stops at `max`.
- **Release** resets then returns it to idle; unknown or double release throws.

%% nudge
- What does `Set.prototype.delete` return, and how can that detect a double release?
- When is a new object created, and when is an idle one reused?

%% starter
```js
export function createPool({ create, reset = () => {}, max = Infinity }) {
  const idle = [];
  const inUse = new Set();
  let created = 0;
  return {
    acquire() {},
    release(obj) {},
    stats() { return { idle: 0, inUse: 0, created: 0 }; },
  };
}
```

%% tests
```js
describe('createPool', () => {
  it('creates on demand and reuses released objects', () => {
    const create = jest.fn(() => ({}));
    const pool = createPool({ create });
    const a = pool.acquire();
    pool.release(a);
    expect(pool.acquire()).toBe(a);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('resets on release', () => {
    const reset = jest.fn((o) => { o.n = 0; });
    const pool = createPool({ create: () => ({ n: 5 }), reset });
    const a = pool.acquire();
    pool.release(a);
    expect(reset).toHaveBeenCalledWith(a);
    expect(a.n).toBe(0);
  });
  it('respects max', () => {
    const pool = createPool({ create: () => ({}), max: 2 });
    pool.acquire(); pool.acquire();
    expect(() => pool.acquire()).toThrow('pool exhausted');
  });
  it('frees capacity when something is released', () => {
    const pool = createPool({ create: () => ({}), max: 1 });
    const a = pool.acquire();
    expect(() => pool.acquire()).toThrow('pool exhausted');
    pool.release(a);
    expect(pool.acquire()).toBe(a);
  });
  it('refuses foreign objects and double release', () => {
    const pool = createPool({ create: () => ({}) });
    expect(() => pool.release({})).toThrow('not in use');
    const a = pool.acquire();
    pool.release(a);
    expect(() => pool.release(a)).toThrow('not in use');
  });
  it('reports stats', () => {
    const pool = createPool({ create: () => ({}), max: 3 });
    const a = pool.acquire(); pool.acquire();
    pool.release(a);
    expect(pool.stats()).toEqual({ idle: 1, inUse: 1, created: 2 });
  });
});
```

%% hints
- `acquire`: `if (idle.length) { const o = idle.pop(); inUse.add(o); return o; }` then check `created >= max`, else `create()`.
- `release`: `if (!inUse.delete(obj)) throw new Error('not in use'); reset(obj); idle.push(obj);`

%% solution
```js
export function createPool({ create, reset = () => {}, max = Infinity }) {
  const idle = [];
  const inUse = new Set();
  let created = 0;
  return {
    acquire() {
      if (idle.length) {
        const obj = idle.pop();
        inUse.add(obj);
        return obj;
      }
      if (created >= max) throw new Error('pool exhausted');
      const obj = create();
      created++;
      inUse.add(obj);
      return obj;
    },
    release(obj) {
      if (!inUse.delete(obj)) throw new Error('not in use');
      reset(obj);
      idle.push(obj);
    },
    stats() {
      return { idle: idle.length, inUse: inUse.size, created };
    },
  };
}
```
