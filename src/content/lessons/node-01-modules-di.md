---
id: node-modules-di
track: node
title: Modules, providers & dependency injection
summary: How backends stay changeable: classes declare what they need, a container builds them; scopes decide how long an instance lives; modules decide who can see what.
---

## The idea in one sentence

**Dependency injection** means a piece of code **asks for what it needs** (a logger, a repository) and something else **builds and hands it over**, so you can change, share or fake any part without touching the code that uses it.

> **Analogy** A restaurant kitchen. The chef doesn't buy flour, grow herbs or build the oven; they say "I need flour and an oven" and the kitchen manager provides them. Swap the oven for a bigger one, or use fake butter in a taste test, and the chef's recipe doesn't change.

*(In NestJS this is exactly the `@Injectable()` provider system: classes list their constructor dependencies and the framework's container resolves them. Here you will build the mechanism itself.)*

## From `new` to injection

```js try predict
// Hard-wired: the service creates its own repository, forever
class HardWired {
  constructor() { this.repo = { find: (id) => ({ id, source: 'real database' }) }; }
  get(id) { return this.repo.find(id); }
}

// Injected: the service receives its repository
class UserService {
  constructor(repo) { this.repo = repo; }
  get(id) { return this.repo.find(id); }
}

const real = new UserService({ find: (id) => ({ id, source: 'real database' }) });
const fake = new UserService({ find: (id) => ({ id, source: 'fake' }) });
console.log(real.get(1), fake.get(1));
```

Wiring by hand works for three classes. At fifty, you want a **container**: a registry of **providers** (recipes) that resolves a whole chain on request.

![Dependency injection](fig:nd-di "The container builds dependencies first, so every class gets exactly what it declared.")

A **provider** is a recipe for one **token** (a name, or the class itself): a ready **value**, a **factory** function, or a **class** to instantiate, plus the list of tokens it needs injected.

```stepper Resolving a chain
code:
  container.register('Config', { useValue: { dbUrl: 'db://x' } });
  container.register('Db', { useFactory: (cfg) => connect(cfg.dbUrl), inject: ['Config'] });
  container.register('Repo', { useFactory: (db) => makeRepo(db), inject: ['Db'] });
  container.resolve('Repo');
---
line: 1
say: `Config` is a plain **value**. Registering does nothing yet: providers are **recipes**, not instances.
instances: (none)
---
line: 2
say: `Db` is a **factory** that needs `Config`. The `inject` list says which tokens to pass, **in order**, as arguments.
recipe: Db needs [Config]
---
line: 4
say: `resolve('Repo')` starts at the top: `Repo` needs `Db`, so resolve `Db` first.
path: Repo
---
line: 4
say: `Db` needs `Config`: that one is a value, so it's returned directly. Now `Db`'s factory runs with it.
path: Repo -> Db -> Config
---
line: 4
say: Back up the chain: the `Repo` factory runs with the built `Db`. Because the scope is **singleton** by default, each is **cached**: asking again returns the same objects.
cached: Config, Db, Repo
```

## Scopes: how long does an instance live?

![Provider scopes](fig:nd-scopes "Singleton: one for the app. Request: one per request. Transient: one per injection.")

- **Singleton** (default): created once, shared everywhere. Cheap, but must not store per-request data.
- **Transient**: a **new** instance every time it's injected.
- **Request**: one per incoming request (so request-specific state is safe), at the cost of rebuilding everything that depends on it.

The classic bugs are a **singleton that holds request data** (users see each other's data) and **forgetting a cycle** (A needs B needs A), which a good container reports as a clear error instead of overflowing the stack.

## Modules: who may use what

Large apps group providers into **modules** with **explicit boundaries**: a module lists what it **provides**, what it **imports** from other modules, and what it **exports**. A provider that isn't exported is **private**.

![Modules and visibility](fig:nd-modules "Imports bring in only what the other module exports.")

*(In NestJS: `@Module({ imports, providers, exports })`.)* The payoff: you can see an app's dependency structure from its module files, and nothing reaches into another feature's internals by accident.

## Testing with DI

Because dependencies are injected, a test builds a container (or just constructs the class) with **fakes**, and an `override(token, provider)` helper swaps one provider while leaving the rest of the graph intact.

## Quick check

```check
Q: What is the main benefit of injecting dependencies instead of creating them with `new` inside a class?
A) It makes code run faster
B) The class can be tested and reconfigured with different collaborators without being edited *
C) It removes the need for classes
D) It hides errors
Why: The class depends on an interface (what it needs), not on a concrete construction.
---
Q: A provider is registered as a singleton. What does `resolve` return the second time?
A) A new instance
B) The same cached instance *
C) undefined
D) An error
Why: Singletons are created on first use and then reused.
---
Q: Why is storing the current user on a singleton service dangerous?
A) Singletons are slow
B) One instance serves all requests, so users would overwrite and see each other's data *
C) Users cannot be stored
D) It breaks the cache
Why: Per-request data needs request scope or must be passed as arguments.
---
Q: What does it mean for a provider to be not exported from its module?
A) It is deleted
B) It stays private: other modules cannot inject it *
C) It becomes transient
D) It is exported automatically
Why: Exports are the public surface of a module.
---
Q: What should a container do when A needs B and B needs A?
A) Loop forever
B) Report a circular dependency with the path (A -> B -> A) *
C) Return undefined
D) Create both lazily
Why: A clear error beats a stack overflow.
```

## Recap

- **DI**: declare needs, let a container build; swap implementations without editing consumers.
- **Providers** are recipes (value, factory, class) with `inject` tokens; **resolve** builds dependencies first.
- **Scopes**: singleton (default), transient, request. Singletons must be stateless about requests.
- **Modules** control visibility with imports and exports; private by default.
- Detect **cycles** and report the path; **override** providers in tests.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a tiny registry | A `Map` of factories and a cache |
| A DI container | Providers (value/factory/class), `inject`, scopes, cycle detection, override |
| A module system | Imports, exports, per-module context, re-exports |
| Tests for a container | Checks that expose caching, order and cycle bugs |

%% exercise nod-guided-registry | Guided: a tiny registry | 1 | js | js | createRegistry | 8 | guided
Implement `createRegistry()`:

- `provide(token, factory)` stores a factory (a function with no arguments).
- `resolve(token)` calls the factory **the first time** and **caches** the result; later calls return the same value. An unknown token throws `Error('no provider for TOKEN')`.

```js
const r = createRegistry();
r.provide('config', () => ({ port: 3000 }));
r.resolve('config') === r.resolve('config'); // true
```

%% worked
**A similar problem, solved: `createLazyValues()`** — create on first use, remember it.

```js
function createLazyValues() {
  const makers = new Map();
  const made = new Map();
  return {
    define(name, maker) { makers.set(name, maker); },
    get(name) {
      if (!made.has(name)) {                                    // ① check the cache with has(), not by value
        if (!makers.has(name)) throw new Error('unknown: ' + name);
        made.set(name, makers.get(name)());                     // ② create once
      }
      return made.get(name);                                    // ③ always return the cached one
    },
  };
}
```

Use `Map.has` for the cache check: a factory may legitimately produce `0`, `''` or `undefined`, and those must still count as "already created".

%% explain
- **Factories** stored by token; **instances** cached after the first `resolve`.
- **Unknown token** throws the exact message.

%% nudge
- How do you tell "cached a falsy value" from "not cached yet"?
- Where should the unknown-token check go?

%% starter
```js
export function createRegistry() {
  const factories = new Map();
  const instances = new Map();
  return {
    provide(token, factory) {},
    resolve(token) {},
  };
}
```

%% tests
```js
describe('createRegistry', () => {
  it('creates a value lazily and caches it', () => {
    const r = createRegistry();
    const factory = jest.fn(() => ({ port: 3000 }));
    r.provide('config', factory);
    expect(factory).not.toHaveBeenCalled();
    const first = r.resolve('config');
    expect(r.resolve('config')).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });
  it('keeps tokens separate', () => {
    const r = createRegistry();
    r.provide('a', () => 1);
    r.provide('b', () => 2);
    expect(r.resolve('a')).toBe(1);
    expect(r.resolve('b')).toBe(2);
  });
  it('caches falsy values too', () => {
    const r = createRegistry();
    const zero = jest.fn(() => 0);
    const nothing = jest.fn(() => undefined);
    r.provide('zero', zero);
    r.provide('nothing', nothing);
    r.resolve('zero'); r.resolve('zero'); r.resolve('nothing'); r.resolve('nothing');
    expect(zero).toHaveBeenCalledTimes(1);
    expect(nothing).toHaveBeenCalledTimes(1);
  });
  it('throws for unknown tokens', () => {
    expect(() => createRegistry().resolve('missing')).toThrow('no provider for missing');
  });
  it('registries are independent', () => {
    const a = createRegistry(), b = createRegistry();
    a.provide('x', () => 1);
    expect(() => b.resolve('x')).toThrow('no provider for x');
  });
});
```

%% hints
- `if (!instances.has(token)) { ... instances.set(token, factories.get(token)()); }`
- Check `factories.has(token)` before calling.

%% solution
```js
export function createRegistry() {
  const factories = new Map();
  const instances = new Map();
  return {
    provide(token, factory) {
      factories.set(token, factory);
    },
    resolve(token) {
      if (!instances.has(token)) {
        if (!factories.has(token)) throw new Error('no provider for ' + token);
        instances.set(token, factories.get(token)());
      }
      return instances.get(token);
    },
  };
}
```

%% exercise nod-container | A dependency injection container | 4 | js | js | createContainer | 40
Implement `createContainer()`. A **token** is any value (a string, a symbol or a class). Messages show a class by its `name` and anything else with `String(token)`.

- `register(token, provider)` stores a provider and returns the container. A provider is **one of** `{ useValue }`, `{ useFactory, inject = [] }` or `{ useClass, inject = [] }`, plus `scope`: `'singleton'` (default) or `'transient'`. Registering the same token twice throws `Error('already registered: TOKEN')`.
- `resolve(token)` builds the value: `useValue` gives that value; `useFactory` calls `useFactory(...deps)`; `useClass` does `new useClass(...deps)`, where `deps` are the **resolved** `inject` tokens **in order**.
- **Singletons** are cached (`useValue` too); **transient** providers build a fresh value every time they are resolved or injected.
- An unknown token throws `Error('no provider for TOKEN')`; if it was needed by another provider, `Error('no provider for TOKEN (required by OWNER)')`.
- A cycle throws `Error('circular dependency: a -> b -> a')` (the path, ending with the repeated token).
- `override(token, provider)` replaces (or adds) a provider and **clears all cached singletons**, so dependents are rebuilt with the new one. It returns the container.
- `has(token)` says whether a provider is registered.

```js
const c = createContainer()
  .register('config', { useValue: { port: 3000 } })
  .register('server', { useFactory: (cfg) => ({ port: cfg.port }), inject: ['config'] });
c.resolve('server'); // { port: 3000 }
```

%% worked
**A similar problem, solved: resolving with a path**, detecting a cycle while walking dependencies.

```js
function build(token, providers, path = []) {
  if (path.includes(token)) throw new Error('circular: ' + [...path, token].join(' -> '));   // ① were we already building this one?
  const p = providers.get(token);
  const deps = (p.inject ?? []).map((t) => build(t, providers, [...path, token]));            // ② recurse with the path so far
  return p.useFactory(...deps);
}
```

Pass the **path** down the recursion: if you meet a token already on it, you have gone in a circle. Cache singletons **after** they are built (a singleton in progress is not cached, which is why the cycle check must come first). Describe tokens with a helper (`typeof t === 'function' ? t.name : String(t)`) so class tokens make readable messages.

%% explain
- **Three provider kinds** and two scopes.
- **Recursion with a path** for cycle detection and "required by" messages.
- **Singleton cache** filled after building; transient never cached.
- **`override`** clears the cache so dependents see the new provider.

%% nudge
- Why must the cycle check come before the cache check?
- What exactly does `override` need to invalidate?

%% starter
```js
export function createContainer() {
  const providers = new Map();
  const container = {
    register(token, provider) { return container; },
    override(token, provider) { return container; },
    resolve(token) {},
    has(token) { return providers.has(token); },
  };
  return container;
}
```

%% tests
```js
describe('createContainer', () => {
  it('resolves values, factories and classes with injected dependencies in order', () => {
    class Greeter { constructor(prefix, name) { this.text = `${prefix} ${name}`; } }
    const c = createContainer()
      .register('prefix', { useValue: 'Hello' })
      .register('name', { useValue: 'Ada' })
      .register('greeter', { useClass: Greeter, inject: ['prefix', 'name'] })
      .register('shout', { useFactory: (g) => g.text.toUpperCase(), inject: ['greeter'] });
    expect(c.resolve('greeter').text).toBe('Hello Ada');
    expect(c.resolve('shout')).toBe('HELLO ADA');
  });
  it('caches singletons, including values, and shares them between dependents', () => {
    const make = jest.fn(() => ({}));
    const c = createContainer()
      .register('shared', { useFactory: make })
      .register('a', { useFactory: (s) => ({ s }), inject: ['shared'] })
      .register('b', { useFactory: (s) => ({ s }), inject: ['shared'] });
    expect(c.resolve('shared')).toBe(c.resolve('shared'));
    expect(c.resolve('a').s).toBe(c.resolve('b').s);
    expect(c.resolve('a')).toBe(c.resolve('a'));
    expect(make).toHaveBeenCalledTimes(1);
  });
  it('builds a new transient instance every time, also when injected', () => {
    const make = jest.fn(() => ({}));
    const c = createContainer()
      .register('t', { useFactory: make, scope: 'transient' })
      .register('user', { useFactory: (t) => ({ t }), inject: ['t'], scope: 'transient' });
    expect(c.resolve('t')).not.toBe(c.resolve('t'));
    expect(c.resolve('user').t).not.toBe(c.resolve('user').t);
    expect(make).toHaveBeenCalledTimes(4);
  });
  it('does not call factories until needed', () => {
    const make = jest.fn(() => 1);
    createContainer().register('x', { useFactory: make });
    expect(make).not.toHaveBeenCalled();
  });
  it('supports class tokens', () => {
    class Logger { log() { return 'ok'; } }
    const c = createContainer().register(Logger, { useClass: Logger });
    expect(c.resolve(Logger)).toBeInstanceOf(Logger);
    expect(c.resolve(Logger)).toBe(c.resolve(Logger));
    expect(c.has(Logger)).toBe(true);
    expect(c.has('nope')).toBe(false);
  });
  it('reports unknown tokens, naming who needed them', () => {
    const c = createContainer().register('svc', { useFactory: () => 1, inject: ['missing'] });
    expect(() => createContainer().resolve('x')).toThrow('no provider for x');
    expect(() => c.resolve('svc')).toThrow('no provider for missing (required by svc)');
    class Repo {}
    const d = createContainer().register('svc', { useFactory: () => 1, inject: [Repo] });
    expect(() => d.resolve('svc')).toThrow('no provider for Repo (required by svc)');
  });
  it('reports duplicate registrations', () => {
    const c = createContainer().register('a', { useValue: 1 });
    expect(() => c.register('a', { useValue: 2 })).toThrow('already registered: a');
  });
  it('detects circular dependencies with the path', () => {
    const c = createContainer()
      .register('a', { useFactory: () => 1, inject: ['b'] })
      .register('b', { useFactory: () => 2, inject: ['c'] })
      .register('c', { useFactory: () => 3, inject: ['a'] });
    expect(() => c.resolve('a')).toThrow('circular dependency: a -> b -> c -> a');
    const self = createContainer().register('x', { useFactory: () => 1, inject: ['x'] });
    expect(() => self.resolve('x')).toThrow('circular dependency: x -> x');
  });
  it('is not confused by diamonds (shared, not circular)', () => {
    const c = createContainer()
      .register('base', { useValue: 1 })
      .register('left', { useFactory: (b) => b + 1, inject: ['base'] })
      .register('right', { useFactory: (b) => b + 2, inject: ['base'] })
      .register('top', { useFactory: (l, r) => l * 10 + r, inject: ['left', 'right'] });
    expect(c.resolve('top')).toBe(23);
  });
  it('recovers after a failed resolve', () => {
    let fail = true;
    const c = createContainer().register('flaky', { useFactory: () => { if (fail) throw new Error('boom'); return 'ok'; } });
    expect(() => c.resolve('flaky')).toThrow('boom');
    fail = false;
    expect(c.resolve('flaky')).toBe('ok');
  });
  it('overrides a provider and rebuilds dependents', () => {
    const c = createContainer()
      .register('db', { useValue: 'real' })
      .register('repo', { useFactory: (db) => ({ db }), inject: ['db'] });
    const before = c.resolve('repo');
    expect(before.db).toBe('real');
    c.override('db', { useValue: 'fake' });
    const after = c.resolve('repo');
    expect(after.db).toBe('fake');
    expect(after).not.toBe(before);
    expect(c.override('new', { useValue: 1 })).toBe(c);
    expect(c.resolve('new')).toBe(1);
  });
  it('caches useValue results without calling them', () => {
    const fn = () => 'i am a function value';
    const c = createContainer().register('fn', { useValue: fn });
    expect(c.resolve('fn')).toBe(fn);
  });
});
```

%% hints
- Keep `providers` and `instances` maps; `build(token, path, requiredBy)` does the work.
- Order inside `build`: cycle check (`path.includes(token)`), then cache for singletons, then recipe.
- `describe(token)`: `typeof token === 'function' ? token.name : String(token)`.
- `override`: `providers.set(token, normalised); instances.clear();`

%% solution
```js
const describe = (t) => (typeof t === 'function' ? t.name : String(t));

export function createContainer() {
  const providers = new Map();
  const instances = new Map();
  const normalise = (p) => ({ scope: 'singleton', inject: [], ...p });

  function build(token, path, requiredBy) {
    if (path.includes(token)) throw new Error('circular dependency: ' + [...path, token].map(describe).join(' -> '));
    const p = providers.get(token);
    if (!p) {
      throw new Error(`no provider for ${describe(token)}` + (requiredBy !== undefined ? ` (required by ${describe(requiredBy)})` : ''));
    }
    if (p.scope === 'singleton' && instances.has(token)) return instances.get(token);
    let value;
    if ('useValue' in p) {
      value = p.useValue;
    } else {
      const deps = p.inject.map((dep) => build(dep, [...path, token], token));
      value = p.useFactory ? p.useFactory(...deps) : new p.useClass(...deps);
    }
    if (p.scope === 'singleton') instances.set(token, value);
    return value;
  }

  const container = {
    register(token, provider) {
      if (providers.has(token)) throw new Error('already registered: ' + describe(token));
      providers.set(token, normalise(provider));
      return container;
    },
    override(token, provider) {
      providers.set(token, normalise(provider));
      instances.clear();
      return container;
    },
    resolve: (token) => build(token, [], undefined),
    has: (token) => providers.has(token),
  };
  return container;
}
```

%% exercise nod-modules | A module system | 4 | js | js | createModuleSystem | 40
Implement `createModuleSystem()` with `defineModule(name, { imports = [], providers = {}, exports = [] })` and `resolve(moduleName, token)`.

- `providers` maps a token (a string) to `{ useValue }` or `{ useFactory, inject = [] }`. All providers are **singletons**: one instance per (owning module, token), no matter who asks.
- Inside module `M` you can use: `M`'s **own** providers, and tokens that a module in `M.imports` **exports**. A module's `exports` may name its own providers **or tokens it imports from another module** (a **re-export**).
- A provider's dependencies are resolved **in the context of the module that owns the provider**, not the module that asked.
- Not visible: `Error('TOKEN is not available in module M')` (where `M` is the module whose context was searching). An undefined module: `Error('unknown module: NAME')`. Defining a name twice: `Error('module already defined: NAME')`.
- Circular provider dependencies: `Error('circular dependency: a -> b -> a')`. Module import cycles must not hang.

```js
const sys = createModuleSystem();
sys.defineModule('Config', { providers: { config: { useValue: { port: 1 } } }, exports: ['config'] });
sys.defineModule('Api', { imports: ['Config'], providers: { server: { useFactory: (c) => c.port, inject: ['config'] } } });
sys.resolve('Api', 'server'); // 1
```

%% worked
**A similar problem, solved: visibility of folders** — you can open a folder's own files and the files that other folders *publish*.

```js
function findOwner(folders, name, file, viaImport = false, seen = new Set()) {
  const f = folders.get(name);
  if (seen.has(name)) return undefined;                            // ① import cycles must terminate
  seen.add(name);
  if (f.files.includes(file) && (!viaImport || f.publishes.includes(file))) return name;     // ② own file; through an import it must be published
  if (!viaImport || f.publishes.includes(file)) {                  // ③ a re-export: only what we publish may be passed on
    for (const other of f.imports) {
      const found = findOwner(folders, other, file, true, seen);
      if (found) return found;
    }
  }
  return undefined;
}
```

Your `locate(moduleName, token, viaImport)` has the same shape. Once you know the **owner**, build the provider **in the owner's context** (its dependencies are `locate`d from the owner), caching by owner and token.

%% explain
- **`locate`** finds the owning module under the visibility rules, including re-exports.
- **Build in the owner's context**; cache per owner and token.
- **Errors** name the module whose context was searching.
- **Cycles** among modules are guarded with a `seen` set; provider cycles with a path.

%% nudge
- Why must a dependency be resolved from the provider's owning module?
- What stops an import cycle between two modules from recursing forever?

%% starter
```js
export function createModuleSystem() {
  const modules = new Map();
  return {
    defineModule(name, def) {},
    resolve(moduleName, token) {},
  };
}
```

%% tests
```js
const setup = () => {
  const sys = createModuleSystem();
  const make = jest.fn(() => ({ port: 3000 }));
  sys.defineModule('Config', { providers: { config: { useFactory: make }, secret: { useValue: 's3' } }, exports: ['config'] });
  sys.defineModule('Db', {
    imports: ['Config'],
    providers: { db: { useFactory: (cfg) => ({ url: 'db:' + cfg.port }), inject: ['config'] } },
    exports: ['db'],
  });
  sys.defineModule('Users', {
    imports: ['Db'],
    providers: { users: { useFactory: (db) => ({ db }), inject: ['db'] } },
  });
  return { sys, make };
};

describe('createModuleSystem', () => {
  it('resolves own providers and their dependencies', () => {
    const { sys } = setup();
    expect(sys.resolve('Config', 'secret')).toBe('s3');
    expect(sys.resolve('Db', 'db')).toEqual({ url: 'db:3000' });
  });
  it('lets a module use what an imported module exports', () => {
    const { sys } = setup();
    expect(sys.resolve('Users', 'users').db).toEqual({ url: 'db:3000' });
    expect(sys.resolve('Users', 'db')).toBe(sys.resolve('Db', 'db'));
  });
  it('keeps unexported providers private', () => {
    const { sys } = setup();
    expect(() => sys.resolve('Db', 'secret')).toThrow('secret is not available in module Db');
    expect(() => sys.resolve('Users', 'secret')).toThrow('secret is not available in module Users');
  });
  it('does not expose a module\'s imports to its importers unless re-exported', () => {
    const { sys } = setup();
    expect(() => sys.resolve('Users', 'config')).toThrow('config is not available in module Users');
  });
  it('supports re-exports', () => {
    const { sys, make } = setup();
    sys.defineModule('Shared', { imports: ['Config'], exports: ['config'] });
    sys.defineModule('Feature', { imports: ['Shared'] });
    expect(sys.resolve('Feature', 'config')).toEqual({ port: 3000 });
    expect(sys.resolve('Feature', 'config')).toBe(sys.resolve('Config', 'config'));
    expect(make).toHaveBeenCalledTimes(1);
  });
  it('shares one instance per owning module', () => {
    const { sys, make } = setup();
    const a = sys.resolve('Db', 'config');
    const b = sys.resolve('Users', 'db');
    sys.resolve('Config', 'config');
    expect(a).toBe(sys.resolve('Config', 'config'));
    expect(sys.resolve('Users', 'db')).toBe(b);
    expect(make).toHaveBeenCalledTimes(1);
  });
  it('resolves dependencies in the owning module, not the asking one', () => {
    const sys = createModuleSystem();
    sys.defineModule('Hidden', { providers: { x: { useValue: 42 } }, exports: ['x'] });
    sys.defineModule('A', { imports: ['Hidden'], providers: { a: { useFactory: (x) => x + 1, inject: ['x'] } }, exports: ['a'] });
    sys.defineModule('B', { imports: ['A'] });
    expect(sys.resolve('B', 'a')).toBe(43);
    expect(() => sys.resolve('B', 'x')).toThrow('x is not available in module B');
  });
  it('reports a dependency that is not visible to the provider\'s module', () => {
    const sys = createModuleSystem();
    sys.defineModule('A', { providers: { a: { useFactory: () => 1, inject: ['ghost'] } }, exports: ['a'] });
    sys.defineModule('B', { imports: ['A'] });
    expect(() => sys.resolve('B', 'a')).toThrow('ghost is not available in module A');
  });
  it('handles falsy values and useValue functions', () => {
    const sys = createModuleSystem();
    sys.defineModule('M', { providers: { zero: { useValue: 0 }, nothing: { useValue: undefined } } });
    expect(sys.resolve('M', 'zero')).toBe(0);
    expect(sys.resolve('M', 'nothing')).toBeUndefined();
  });
  it('reports unknown and duplicate modules', () => {
    const sys = createModuleSystem();
    expect(() => sys.resolve('Nope', 'x')).toThrow('unknown module: Nope');
    sys.defineModule('A', { imports: ['Missing'] });
    expect(() => sys.resolve('A', 'x')).toThrow('unknown module: Missing');
    expect(() => sys.defineModule('A', {})).toThrow('module already defined: A');
  });
  it('detects circular provider dependencies', () => {
    const sys = createModuleSystem();
    sys.defineModule('M', {
      providers: {
        a: { useFactory: () => 1, inject: ['b'] },
        b: { useFactory: () => 2, inject: ['a'] },
      },
    });
    expect(() => sys.resolve('M', 'a')).toThrow('circular dependency: a -> b -> a');
  });
  it('does not hang on module import cycles', () => {
    const sys = createModuleSystem();
    sys.defineModule('A', { imports: ['B'], exports: ['y'] });
    sys.defineModule('B', { imports: ['A'], exports: ['x'], providers: { x: { useValue: 1 } } });
    expect(sys.resolve('A', 'x')).toBe(1);
    expect(() => sys.resolve('A', 'nothing')).toThrow('nothing is not available in module A');
  });
});
```

%% hints
- `locate(moduleName, token, viaImport, seen)`: own provider (must be exported if `viaImport`), else search imports (only if `!viaImport` or the token is exported).
- `build(owner, token, path)`: cache in `instances.get(owner)`; dependencies via `locate(owner, dep, false)`.
- A missing dependency error comes from the owner's context: `${dep} is not available in module ${owner}`.

%% solution
```js
export function createModuleSystem() {
  const modules = new Map();
  const instances = new Map();
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const getModule = (name) => {
    const m = modules.get(name);
    if (!m) throw new Error('unknown module: ' + name);
    return m;
  };

  function locate(name, token, viaImport, seen = new Set()) {
    if (seen.has(name)) return undefined;
    seen.add(name);
    const m = getModule(name);
    if (has(m.providers, token) && (!viaImport || m.exports.includes(token))) return name;
    if (!viaImport || m.exports.includes(token)) {
      for (const imported of m.imports) {
        const found = locate(imported, token, true, seen);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  function build(requester, token, path) {
    const owner = locate(requester, token, false);
    if (owner === undefined) throw new Error(`${token} is not available in module ${requester}`);
    if (path.includes(token)) throw new Error('circular dependency: ' + [...path, token].join(' -> '));
    if (!instances.has(owner)) instances.set(owner, new Map());
    const cache = instances.get(owner);
    if (cache.has(token)) return cache.get(token);
    const provider = modules.get(owner).providers[token];
    let value;
    if ('useValue' in provider) {
      value = provider.useValue;
    } else {
      const deps = (provider.inject || []).map((dep) => build(owner, dep, [...path, token]));
      value = provider.useFactory(...deps);
    }
    cache.set(token, value);
    return value;
  }

  return {
    defineModule(name, { imports = [], providers = {}, exports = [] } = {}) {
      if (modules.has(name)) throw new Error('module already defined: ' + name);
      modules.set(name, { imports, providers, exports });
    },
    resolve: (moduleName, token) => {
      getModule(moduleName);
      return build(moduleName, token, []);
    },
  };
}
```

%% exercise nod-check-container | Tests for a DI container | 4 | js | js | checkContainer | 36
`createContainer()` has `register(token, provider)` (providers `{ useValue }` or `{ useFactory, inject }`, `scope: 'singleton'` by default or `'transient'`), `resolve(token)`, `override(token, provider)` and `has(token)`. Singletons are **cached**, transient providers are rebuilt every time, `inject` tokens are passed **in order**, a cycle throws an error mentioning `circular`, a duplicate registration throws, an unknown dependency throws an error that names **both** the missing token and the provider that needed it, and `override` rebuilds dependents. Write `checkContainer(createContainer)` that passes for a correct container and **fails** for: **singletons are rebuilt on every resolve**, **transient providers are cached**, **dependencies are not injected**, **dependencies are injected in the wrong order**, **cycles are not detected**, **duplicate registrations are allowed**, **override keeps cached instances**, **the unknown-dependency error does not name the requiring provider**.

```js
const c = createContainer().register('a', { useFactory: () => ({}) });
expect(c.resolve('a')).toBe(c.resolve('a'));
```

%% worked
**A similar problem, solved: `checkCache(createCache)`** — a spy to **count calls**, and one scenario per behaviour.

```js
export function checkCache(createCache) {                      // createCache(loader) → { get(key) }, loader called once per key
  const loader = jest.fn((key) => ({ key }));                  // ① a spy that returns a fresh object each call
  const cache = createCache(loader);
  const first = cache.get('a');
  expect(cache.get('a')).toBe(first);                          // ② same object the second time (identity, not equality)
  expect(loader).toHaveBeenCalledTimes(1);                     // ③ and the loader ran once
  cache.get('b');
  expect(loader).toHaveBeenCalledTimes(2);                     // ④ a different key does call it
  expect(loader).toHaveBeenLastCalledWith('b');                // ⑤ with the right argument
}
```

Caching is invisible in a result's *value*, so test it with **identity** (`toBe`) on an object and with **call counts** on a spy. For a cycle, assert on the **message** (`'circular'`): an implementation that overflows the stack also "throws" a `RangeError`, so a bare `toThrow()` wouldn't catch it.

%% explain
- **Identity and call counts** for singleton vs transient.
- **Argument order** with a factory that returns its arguments.
- **Messages** for cycles, duplicates and unknown dependencies.
- **Override** must produce a fresh dependent.

%% nudge
- Which assertion distinguishes "cached" from "rebuilt" when the factory returns an object?
- Why match the cycle error by text instead of just expecting an error?

%% starter
```js
export function checkContainer(createContainer) {
  const c = createContainer().register('a', { useFactory: () => ({}) });
  expect(c.resolve('a')).toBe(c.resolve('a'));
  // your assertions: transient scope, injection and order, cycles, duplicates, override, unknown dependency
}
```

%% tests
```js
const describeToken = (t) => (typeof t === 'function' ? t.name : String(t));
const make = ({ rebuild = false, cacheTransient = false, noInject = false, reverse = false, noCycle = false, allowDup = false, keepOnOverride = false, anonymousUnknown = false } = {}) => () => {
  const providers = new Map();
  const cache = new Map();
  const build = (token, path, by) => {
    if (!noCycle && path.includes(token)) throw new Error('circular dependency: ' + [...path, token].join(' -> '));
    if (noCycle && path.length > 50) throw new RangeError('Maximum call stack size exceeded');
    const p = providers.get(token);
    if (!p) throw new Error(`no provider for ${describeToken(token)}` + (by !== undefined && !anonymousUnknown ? ` (required by ${describeToken(by)})` : ''));
    const singleton = p.scope !== 'transient';
    if ((singleton || cacheTransient) && !rebuild && cache.has(token)) return cache.get(token);
    let value;
    if ('useValue' in p) value = p.useValue;
    else {
      let deps = (p.inject || []).map((d) => build(d, [...path, token], token));
      if (reverse) deps = deps.reverse();
      value = p.useFactory(...(noInject ? [] : deps));
    }
    if (singleton || cacheTransient) cache.set(token, value);
    return value;
  };
  const container = {
    register(token, provider) {
      if (!allowDup && providers.has(token)) throw new Error('already registered: ' + describeToken(token));
      providers.set(token, provider);
      return container;
    },
    override(token, provider) {
      providers.set(token, provider);
      if (!keepOnOverride) cache.clear();
      return container;
    },
    resolve: (token) => build(token, [], undefined),
    has: (token) => providers.has(token),
  };
  return container;
};
const correct = make();
const mutants = {
  'rebuilds singletons on every resolve': make({ rebuild: true }),
  'caches transient providers': make({ cacheTransient: true }),
  'does not inject dependencies': make({ noInject: true }),
  'injects dependencies in the wrong order': make({ reverse: true }),
  'does not detect cycles': make({ noCycle: true }),
  'allows duplicate registrations': make({ allowDup: true }),
  'keeps cached instances on override': make({ keepOnOverride: true }),
  'does not name the requiring provider': make({ anonymousUnknown: true }),
};

describe('your checkContainer', () => {
  it('passes on a correct container', () => {
    expect(() => checkContainer(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a container that ${name}`, () => {
      expect(() => checkContainer(impl)).toThrow();
    });
  }
});
```

%% hints
- Singleton: `expect(c.resolve('a')).toBe(c.resolve('a'))` with a factory returning `{}`; transient: `not.toBe`.
- Order: a factory `(first, second) => [first, second]` with `inject: ['one', 'two']` and `useValue` providers.
- Cycle: `expect(() => c.resolve('a')).toThrow('circular')`.
- Unknown: `toThrow('required by svc')`. Override: resolve a dependent, override its dependency, resolve again and compare.

%% solution
```js
export function checkContainer(createContainer) {
  const single = createContainer().register('a', { useFactory: () => ({}) });
  expect(single.resolve('a')).toBe(single.resolve('a'));

  const spy = jest.fn(() => ({}));
  const transient = createContainer().register('t', { useFactory: spy, scope: 'transient' });
  expect(transient.resolve('t')).not.toBe(transient.resolve('t'));
  expect(spy).toHaveBeenCalledTimes(2);

  const injected = createContainer()
    .register('one', { useValue: 1 })
    .register('two', { useValue: 2 })
    .register('pair', { useFactory: (x, y) => [x, y], inject: ['one', 'two'] });
  expect(injected.resolve('pair')).toEqual([1, 2]);

  const cyclic = createContainer()
    .register('a', { useFactory: () => 1, inject: ['b'] })
    .register('b', { useFactory: () => 2, inject: ['a'] });
  expect(() => cyclic.resolve('a')).toThrow('circular');

  const dup = createContainer().register('x', { useValue: 1 });
  expect(() => dup.register('x', { useValue: 2 })).toThrow();

  const missing = createContainer().register('svc', { useFactory: () => 1, inject: ['ghost'] });
  expect(() => missing.resolve('svc')).toThrow('ghost');
  expect(() => missing.resolve('svc')).toThrow('svc');

  const swap = createContainer()
    .register('db', { useValue: 'real' })
    .register('repo', { useFactory: (db) => ({ db }), inject: ['db'] });
  const before = swap.resolve('repo');
  swap.override('db', { useValue: 'fake' });
  expect(swap.resolve('repo')).not.toBe(before);
  expect(swap.resolve('repo').db).toBe('fake');
}
```
