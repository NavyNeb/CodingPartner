---
id: ts-real-world
track: ts
title: Typing real code
summary: The patterns you actually ship — type guards, event maps, and APIs whose types follow their string arguments.
---

Type-level puzzles are fun; **typing real APIs** is the job. Three patterns cover a surprising share of interview and production TypeScript.

## 1. Narrowing with user-defined type guards

The compiler narrows on `typeof`, `instanceof`, `in`, equality and discriminants. When your check is more complex, teach it with a **type predicate**:

```ts
function isString(x: unknown): x is string {
  return typeof x === 'string';
}
function process(v: unknown) {
  if (isString(v)) v.toUpperCase();   // v: string here
}
```

The return type `x is string` is a *promise you make* — the compiler trusts it. A wrong predicate is a silent bug, so keep them tiny and obviously correct. Related tools:

- **Assertion functions** — `function assert(x: unknown): asserts x` narrows *after* the call.
- **`never` for exhaustiveness** — `function assertNever(x: never): never { throw … }`; passing the leftover of a `switch` makes a missing case a *compile error*.
- **`.filter(isNonNull)`** — with a predicate signature, `filter` returns the narrowed array type instead of `(T | null)[]`.

Prefer `unknown` over `any` for untrusted input: it forces you to narrow before use.

## 2. Event maps: relate a string key to a payload type

The most reusable generic shape: a **map type** from names to payloads, and methods generic over the *key*:

```ts
type Events = { login: [user: string]; message: [from: string, body: string] };

emitter.on('message', (from, body) => {});   // args inferred from the key
emitter.emit('login', 42);                   // ✗ number is not string
```

The mechanism is `K extends keyof E` plus `E[K]` (indexed access), with tuples used as **argument lists** (`...args: E[K]`). You'll see this pattern in typed `EventEmitter`s, Redux action maps, `addEventListener` (`WindowEventMap`), and RPC clients.

## 3. Template-literal types to derive types from strings

If your API's *runtime string* carries information, the compiler can read it:

```ts
type Params<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}` ? P | Params<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P
  : never;

type P = Params<'/users/:id/posts/:postId'>;   // 'id' | 'postId'
```

Then a function `buildPath(path, params)` can require **exactly** the params the path declares. Routers (TanStack Router, Hono), CSS-in-TS, and i18n libraries use this.

## Tips for getting unstuck

- Reproduce with the **smallest** example and hover in your editor (here: read the failing message).
- When inference gives `unknown`, you probably need a type parameter bound to the *whole argument* (`T extends …`) rather than a piece of it.
- Excess property errors only fire on **fresh object literals** assigned to a known type.
- `as` casts are a last resort — a cast is a claim the compiler can't check.

%% exercise ts-guards | Type guards & exhaustiveness | 2 | ts | types |  | 12
Write four small functions whose **signatures** teach the compiler something.

- `isString(x: unknown)` — narrows to `string`.
- `isNonNull<T>(x: T)` — narrows `T` to `NonNullable<T>` (so `.filter(isNonNull)` removes `null | undefined` from array types).
- `isKeyOf(obj, key)` — narrows a `PropertyKey` to `keyof typeof obj`.
- `assertNever(x: never): never` — throws; passing anything other than `never` must be a compile error.

%% starter
```ts
function isString(x: unknown): boolean {
  return typeof x === 'string';
}

function isNonNull<T>(x: T): boolean {
  return x !== null && x !== undefined;
}

function isKeyOf<T extends object>(obj: T, key: PropertyKey): boolean {
  return key in obj;
}

function assertNever(x: unknown): never {
  throw new Error(`Unexpected: ${String(x)}`);
}
```

%% tests
```ts
//! isString narrows unknown to string
declare const v: unknown;
if (isString(v)) {
  type _a = Expect<Equal<typeof v, string>>;
}
//! isNonNull narrows away null and undefined
declare const maybe: string | null | undefined;
if (isNonNull(maybe)) {
  type _b = Expect<Equal<typeof maybe, string>>;
}
//! filter(isNonNull) yields a clean array type
const cleaned = [1, null, 2, undefined].filter(isNonNull);
type _c = Expect<Equal<typeof cleaned, number[]>>;
//! isKeyOf narrows a string to the object's keys
declare const key: string;
const settings = { theme: 'dark', lang: 'en' };
if (isKeyOf(settings, key)) {
  type _d = Expect<Equal<typeof key, 'theme' | 'lang'>>;
}
//! assertNever rejects values that are not never
// @ts-expect-error
assertNever('x');
//! assertNever accepts the leftover of an exhaustive switch
type Shape = 'circle' | 'square';
function area(s: Shape): number {
  switch (s) {
    case 'circle': return 1;
    case 'square': return 2;
    default: return assertNever(s);
  }
}
//! a missing case is a compile error
function broken(s: Shape): number {
  switch (s) {
    case 'circle': return 1;
    default:
      // @ts-expect-error
      return assertNever(s);
  }
}
```

%% hints
- A type predicate return type looks like `x is string`.
- `isNonNull<T>(x: T): x is NonNullable<T>`.
- `isKeyOf<T extends object>(obj: T, key: PropertyKey): key is keyof T`.
- `assertNever(x: never): never` — just tighten the parameter type.

%% solution
```ts
function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function isNonNull<T>(x: T): x is NonNullable<T> {
  return x !== null && x !== undefined;
}

function isKeyOf<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return key in obj;
}

function assertNever(x: never): never {
  throw new Error(`Unexpected: ${String(x)}`);
}
```

%% exercise ts-typed-emitter | Typed event emitter | 3 | ts | types | Emitter | 25
Build a **fully typed** `Emitter<Events>` class, where `Events` maps event names to their **argument tuples**:

```ts
type Events = { login: [user: string]; logout: []; message: [from: string, body: string] };
const e = new Emitter<Events>();
e.on('message', (from, body) => {});   // from: string, body: string
e.emit('login', 'ada');
```

- `on(event, listener)` — listener parameters are inferred from the event name; returns an **unsubscribe function** `() => void`.
- `emit(event, ...args)` — arguments must match the tuple exactly.
- Unknown event names are compile errors. `Events` must be constrained to `Record<string, unknown[]>`.
- It has to *work* too: listeners run in order and unsubscribing removes only that listener.

%% starter
```ts
export class Emitter<E extends Record<string, unknown[]>> {
  on(event: string, listener: (...args: any[]) => void): () => void {
    return () => {};
  }

  emit(event: string, ...args: any[]): void {}
}
```

%% tests
```ts
type Events = { login: [user: string]; logout: []; message: [from: string, body: string] };
declare const emitter: Emitter<Events>;

//! on() infers listener arguments from the event name
emitter.on('message', (from, body) => {
  type _a = Expect<Equal<typeof from, string>>;
  type _b = Expect<Equal<typeof body, string>>;
});
//! events without a payload have an empty argument list
emitter.on('logout', (...args) => {
  type _c = Expect<Equal<typeof args, []>>;
});
//! on() rejects unknown events
// @ts-expect-error
emitter.on('nope', () => {});
//! listeners cannot expect the wrong argument types
// @ts-expect-error
emitter.on('login', (user: number) => {});
//! emit accepts matching payloads
emitter.emit('login', 'ada');
emitter.emit('logout');
emitter.emit('message', 'ada', 'hi');
//! emit rejects mismatched payloads
// @ts-expect-error
emitter.emit('login', 42);
//! emit rejects missing payload arguments
// @ts-expect-error
emitter.emit('message', 'ada');
//! emit rejects extra arguments
// @ts-expect-error
emitter.emit('logout', 'unexpected');
//! on() returns an unsubscribe function
const off = emitter.on('login', () => {});
type _d = Expect<Equal<typeof off, () => void>>;
//! the class is constructible and safe to use
const real = new Emitter<Events>();
const seen: string[] = [];
const stop = real.on('login', (u) => seen.push(u));
real.emit('login', 'a');
stop();
real.emit('login', 'b');
type _e = Expect<Equal<typeof seen, string[]>>;
//! Events must be a record of tuples
// @ts-expect-error
type Bad = Emitter<{ x: string }>;
```

%% hints
- Two type parameters' worth of ideas: the class param `E`, and per-method `K extends keyof E`.
- Listener type: `(...args: E[K]) => void`. Payload rest parameter: `...args: E[K]`.
- Internally a `Map<keyof E, Array<(...args: any[]) => void>>` keeps the implementation simple — the *public* signatures carry the safety.
- Return `() => { … remove listener … }` from `on`.

%% solution
```ts
export class Emitter<E extends Record<string, unknown[]>> {
  private listeners = new Map<keyof E, Array<(...args: any[]) => void>>();

  on<K extends keyof E>(event: K, listener: (...args: E[K]) => void): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    return () => {
      const current = this.listeners.get(event);
      if (current) {
        this.listeners.set(event, current.filter((l) => l !== listener));
      }
    };
  }

  emit<K extends keyof E>(event: K, ...args: E[K]): void {
    this.listeners.get(event)?.forEach((l) => l(...args));
  }
}
```

%% exercise ts-route-params | Route params from a path string | 4 | ts | types | buildPath | 30
Make the compiler read a route pattern.

- `RouteParams<Path>` — the params declared by `:name` segments, all `string`s: `RouteParams<'/users/:id/posts/:postId'>` is `{ id: string; postId: string }`. A path **without** params gives `Record<string, never>` (an object that can only be empty — a plain `{}` would accept *anything*).
- `buildPath(path, params)` — fills the pattern and returns the string. `params` must contain **exactly** the params the path declares: a missing one **or an extra one** is a compile error.

%% starter
```ts
type RouteParams<Path extends string> = any;

export function buildPath(path: string, params: any): string {
  return path;
}
```

%% tests
```ts
//! extracts one param
type _a = Expect<Equal<RouteParams<'/users/:id'>, { id: string }>>;
//! extracts several params
type _b = Expect<Equal<RouteParams<'/users/:userId/posts/:postId'>, { userId: string; postId: string }>>;
//! handles static segments after a param
type _c = Expect<Equal<RouteParams<'/a/:x/b'>, { x: string }>>;
//! a path without params gives a record that can only be empty
type _d = Expect<Equal<RouteParams<'/about'>, Record<string, never>>>;
//! a param in the middle and at the end
type _e = Expect<Equal<RouteParams<'/:org/repos/:repo/issues/:n'>, { org: string; repo: string; n: string }>>;
//! buildPath accepts exactly the declared params
const ok = buildPath('/users/:id/posts/:postId', { id: '1', postId: 'hello' });
type _f = Expect<Equal<typeof ok, string>>;
//! buildPath rejects a missing param
// @ts-expect-error
buildPath('/users/:id/posts/:postId', { id: '1' });
//! buildPath rejects an extra param
// @ts-expect-error
buildPath('/users/:id', { id: '1', other: 'x' });
//! buildPath rejects params for a path that has none
// @ts-expect-error
buildPath('/about', { id: '1' });
//! buildPath accepts an empty object for a static path
buildPath('/about', {});
//! param values must be strings
// @ts-expect-error
buildPath('/users/:id', { id: 1 });
```

%% hints
- Peel one param at a time with a template-literal pattern: ``S extends `${string}:${infer P}/${infer Rest}` ``, then recurse on ``/${Rest}``.
- The last param has no trailing slash: a second branch ``S extends `${string}:${infer P}` ``.
- Collect the names as a **union**, then turn it into an object with a mapped type: `{ [K in Names]: string }`. An empty union (`never`) maps to `{}` — but `{}` accepts anything, so special-case it: ``[Names] extends [never] ? Record<string, never> : …``.
- `buildPath<S extends string>(path: S, params: RouteParams<S>)` — `S` is inferred as the *literal* from the first argument.
- The body can use a cast: `(params as Record<string, string>)[key]`.

%% solution
```ts
type ExtractParams<S extends string> = S extends `${string}:${infer P}/${infer Rest}`
  ? P | ExtractParams<`/${Rest}`>
  : S extends `${string}:${infer P}`
    ? P
    : never;

type RouteParams<Path extends string> = [ExtractParams<Path>] extends [never]
  ? Record<string, never>
  : { [K in ExtractParams<Path>]: string };

export function buildPath<S extends string>(path: S, params: RouteParams<S>): string {
  return path.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent((params as Record<string, string>)[key]));
}
```
