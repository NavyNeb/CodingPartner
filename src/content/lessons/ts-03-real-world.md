---
id: ts-real-world
track: ts
title: Typing real code
summary: The patterns you actually ship — type guards, event maps, and APIs whose types follow their string arguments.
---

## The idea in one sentence

Type-level puzzles are fun, but **typing real APIs** is the job — and three patterns cover a surprising share of everyday and interview TypeScript.

> **Analogy** Good types are like **labelled drawers**. A *type guard* is the person who opens an unlabelled box, checks inside, and sticks a label on it. An *event map* is the directory on the wall: "drawer `login` holds one name; drawer `message` holds a sender and a body". A *template-literal API* is a drawer labelled by the *address you typed*.

Every snippet is checked by the real compiler — press **Run**.

## 1. Narrowing with type guards

TypeScript narrows automatically with `typeof`, `instanceof`, `in`, equality and discriminated unions. When your check is more complicated, **teach it** with a *type predicate*:

![A guard that returns x is string narrows v in the true branch](fig:type-guard "The return type `x is string` is a promise you make. The compiler trusts it and narrows the variable inside the `if`.")

```ts try types
function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function shout(v: unknown) {
  if (isString(v)) {
    type _inside = Expect<Equal<typeof v, string>>;   // narrowed!
    return v.toUpperCase();
  }
  type _outside = Expect<Equal<typeof v, unknown>>;   // still unknown out here
  return '';
}
```

> **Watch out** The predicate is a **promise**, not a check. If you write `x is string` but return something that isn't really a string test, TypeScript believes you anyway. Keep guards tiny and obviously correct.

Useful relatives:

- **`.filter(isNonNull)`** — with a predicate signature, `filter` returns the *narrowed* array type instead of `(T | null)[]`.
- **Assertion functions** — `function assert(x: unknown): asserts x is string` narrows *after* the call, throwing if it's wrong.
- **`never` for exhaustiveness** — `function assertNever(x: never): never { throw … }`. Passing what is left of a `switch` makes a **missing case a compile error**.

```ts try types
function isNonNull<T>(x: T): x is NonNullable<T> {
  return x !== null && x !== undefined;
}

const cleaned = [1, null, 2, undefined].filter(isNonNull);
type _c = Expect<Equal<typeof cleaned, number[]>>;

function assertNever(x: never): never {
  throw new Error(`Unexpected: ${String(x)}`);
}

type Mode = 'light' | 'dark';
function label(m: Mode): string {
  switch (m) {
    case 'light': return 'Light';
    case 'dark': return 'Dark';
    default: return assertNever(m);   // add a third Mode and this line turns red
  }
}
```

Prefer **`unknown` over `any`** for input you don't trust: `unknown` *forces* you to narrow before using it; `any` silently lets everything through.

## 2. Event maps: connect a name to a payload

The most reusable generic shape is a **map from names to payloads**, with methods generic over the *name*:

![An event map relates each event name to its arguments; emit requires exactly those arguments](fig:event-map "`K extends keyof E` picks the event; `...args: E[K]` turns its tuple into the argument list.")

```ts try types
type Events = {
  login: [user: string];
  logout: [];
  message: [from: string, body: string];
};

declare class Emitter<E extends Record<string, unknown[]>> {
  on<K extends keyof E>(event: K, listener: (...args: E[K]) => void): () => void;
  emit<K extends keyof E>(event: K, ...args: E[K]): void;
}

declare const bus: Emitter<Events>;

bus.on('message', (from, body) => {
  type _from = Expect<Equal<typeof from, string>>;   // inferred from the event name!
  type _body = Expect<Equal<typeof body, string>>;
});

bus.emit('login', 'ada');
bus.emit('logout');

// @ts-expect-error  42 is not a string
bus.emit('login', 42);
// @ts-expect-error  there is no 'nope' event
bus.emit('nope');
```

The mechanism is `K extends keyof E` plus the indexed access `E[K]`, with **tuples used as argument lists** (`...args: E[K]`). You'll meet this in typed `EventEmitter`s, Redux action maps, `addEventListener` (via `WindowEventMap`) and RPC clients.

## 3. Template-literal types: derive types from strings

If your API's *runtime string* carries information, the compiler can read it. A route path such as `'/users/:id/posts/:postId'` declares its own parameters:

![The compiler reads a path string, extracts the parameter names, and buildPath must receive exactly those](fig:route-params "From the string alone the compiler learns that `id` and `postId` are required — and that anything else is a mistake.")

Step through how the parameter names get extracted:

```stepper Reading params out of a route string
code:
  type Params<S extends string> =
    S extends `${string}:${infer P}/${infer Rest}`
      ? P | Params<`/${Rest}`>
      : S extends `${string}:${infer P}`
        ? P
        : never;
  type R = Params<'/users/:id/posts/:postId'>;
---
line: 7
say: We start with the whole path. The first pattern means "some text, a colon, a name `P`, a slash, then the rest".
Input S: /users/:id/posts/:postId
Matches first pattern:
P (a name found):
Result so far:
---
line: 2-3
say: It matches: the text before the colon is `/users/`, then `P` is everything up to the next slash: `id`. The remainder is `posts/:postId`. So the answer is `id` **or** whatever `Params<'/posts/:postId'>` gives.
Matches first pattern: yes
P (a name found): id
Result so far: id | Params<"/posts/:postId">
---
line: 2
say: Recursive call with `'/posts/:postId'`. Try the first pattern: after the colon there is `postId` but **no further slash**, so it does not match.
Input S: /posts/:postId
Matches first pattern: no
P (a name found):
---
line: 4-5
say: The second pattern is "some text, a colon, then a name `P` (to the end)". That matches: `P` is `postId`.
P (a name found): postId
Result so far: id | postId
---
line: 7
say: No more params. The final type is the union `'id' | 'postId'`. `buildPath` can now demand an object with exactly those keys.
Input S: (done)
Result so far: id | postId
```

```ts try types
type Params<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}` ? P | Params<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P
  : never;

type P = Params<'/users/:id/posts/:postId'>;
type _p = Expect<Equal<P, 'id' | 'postId'>>;

type NoParams = Params<'/about'>;
type _n = Expect<Equal<NoParams, never>>;
```

Routers (TanStack Router, Hono), CSS-in-TS and i18n libraries are built on this.

## Tips for getting unstuck

- Reproduce with the **smallest** example, and read the failing message — the compiler's wording is your teacher.
- When inference gives `unknown`, you usually need a type parameter bound to the **whole argument** (`T extends …`) instead of a piece of it.
- **Excess property errors** only fire on *fresh object literals* assigned to a known type, not on a variable holding one.
- `as` casts are a last resort — a cast is a claim the compiler can't check.

## Common mistakes

1. **A type predicate that lies** (`x is Foo` for a sloppy check).
2. **`any` in a signature** — the error disappears and so does the safety.
3. **Making an event emitter loosely typed** (`on(event: string, cb: Function)`) — every typo compiles.
4. **Forgetting `E extends Record<string, unknown[]>`** — without the constraint, `...args: E[K]` isn't known to be an array.
5. **Casting the result** (`as Params`) instead of letting the compiler derive it.

## Quick check

```check
Q: What does a return type of `x is string` tell the compiler?
A) The function returns the string "x"
B) `x` is always a string
C) When the function returns `true`, `x` can be treated as a string in that branch *
D) `x` must be a string when calling the function
Why: A type predicate is a promise about what a `true` result means. The compiler narrows the argument in branches where the guard returned true.
---
Q: Why is `unknown` safer than `any` for untrusted input?
A) It forces you to narrow the value before using it *
B) It is faster at runtime
C) It allows any operation
D) It is removed by the compiler
Why: `unknown` allows nothing until you check it; `any` allows everything, hiding mistakes.
---
Q: With `emit<K extends keyof E>(event: K, ...args: E[K])`, why does `emit('login', 42)` fail when `login: [user: string]`?
A) `login` is not a valid name
B) `emit` only accepts one argument
C) Numbers can't be passed to functions
D) The arguments must match the tuple for that event, and 42 is not a string *
Why: `E['login']` is `[user: string]`, so the rest arguments must be exactly one string.
---
Q: What is `assertNever(x: never): never` for?
A) Logging errors in production
B) Making a forgotten case in a switch a compile-time error *
C) Converting values to `never`
D) Stopping the program
Why: After handling every case, the leftover is `never`. If a case is missing, the leftover has a real type, and passing it to `assertNever` fails to compile.
---
Q: Which statement about `Params<'/users/:id'>` (the route-param type) is true?
A) It is computed at runtime when the route is called
B) It is the string `'/users/:id'` itself
C) It is computed by the compiler from the string literal, at compile time, and produces `'id'` *
D) It requires the path to be stored in an enum
Why: Template literal types plus `infer` let the compiler parse a string literal type — no runtime code involved.
```

## Recap

- **Type predicates** (`x is T`) teach the compiler new narrowing; they're *promises*, so keep them tiny. `.filter(isNonNull)` and `assertNever` are the everyday uses.
- Prefer **`unknown`** to `any`; narrow before use.
- **Event maps**: `Events` maps name → argument tuple; `K extends keyof E` + `...args: E[K]` makes `on` and `emit` fully typed.
- **Template-literal + `infer`** can read strings: route params, CSS units, i18n keys.
- Reproduce small, read the error, avoid casts.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a type guard | Section 1: `x is string` |
| Type guards & exhaustiveness | Section 1: all four helpers |
| Typed event emitter | Section 2, plus a normal class body that really stores and calls listeners |
| Route params from a path string | Section 3 and the stepper; a mapped type to turn names into `{ name: string }` |

%% exercise ts-guided-isnumber | Guided: a type guard | 1 | ts | types |  | 5 | guided
Write `isNumber(x: unknown)` so that, when it returns `true`, TypeScript knows `x` is a `number` — including when used with `.filter(...)`.

The body is already right; the problem is the **return type**. Right now it says only `boolean`, which teaches the compiler nothing.

%% worked
**A similar problem, solved: `isDate`.**

```ts
function isDate(x: unknown): x is Date {       // ① the return type is a TYPE PREDICATE:  <parameter> is <Type>
  return x instanceof Date;                    // ② the body is an ordinary check that returns a boolean
}

declare const v: unknown;
if (isDate(v)) {
  v.getFullYear();                             // ③ v is narrowed to Date inside the if
}

const dates = [new Date(), 'x', 3].filter(isDate);   // Date[]
```

`: boolean` says "I return true or false". `: x is Date` says "I return true or false, **and if true, x is a Date**". Only the return type changes; the body stays the same.

%% explain
- **Narrowing**: inside `if (isNumber(v))`, `v` has type `number`.
- **`filter`**: `mixed.filter(isNumber)` gives `number[]`.
- **It still works as a normal function** returning a boolean.

%% nudge
- What is the syntax for "if this returns true, `x` is a number"?
- Do you need to change the body, or only the signature?

%% starter
```ts
function isNumber(x: unknown): boolean {
  // Step 1 — the check in the body is fine. Leave it.
  // Step 2 — change the RETURN TYPE from `boolean` to a type predicate:   x is number
  return typeof x === 'number';
}
```

%% tests
```ts
//! isNumber narrows unknown to number
declare const v: unknown;
if (isNumber(v)) {
  type _a = Expect<Equal<typeof v, number>>;
}
//! filter(isNumber) yields number[]
const nums = [1, 'a', 2, null].filter(isNumber);
type _b = Expect<Equal<typeof nums, number[]>>;
//! still returns a boolean when called
const ok = isNumber(3) && !isNumber('3');
type _c = Expect<Equal<typeof ok, boolean>>;
```

%% hints
- `function isNumber(x: unknown): x is number { … }`

%% solution
```ts
function isNumber(x: unknown): x is number {
  return typeof x === 'number';
}
```

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

%% worked
**A similar problem, solved: four helper signatures for arrays of strings.**

```ts
// 1) A type predicate — teaches narrowing
function isNonEmpty(s: string | undefined): s is string {
  return s !== undefined && s !== '';
}

// 2) A generic predicate — `NonNullable<T>` removes null and undefined from T
function isPresent<T>(x: T): x is NonNullable<T> {
  return x !== null && x !== undefined;
}
[1, null, 2].filter(isPresent);   // number[]

// 3) A key guard — narrows a loose string to the actual keys of an object
function hasKey<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return key in obj;
}

// 4) `never` as a parameter type means "only accepts the leftover of an exhaustive check"
function fail(x: never): never {
  throw new Error('unexpected ' + String(x));
}
```

In the exercise, each function already has a correct **body** but a weak return type (`boolean`, `unknown`). Your job is only to write the stronger signatures.

%% explain
- **`isString(x: unknown)`** narrows to `string`.
- **`isNonNull<T>(x: T)`** narrows to `NonNullable<T>`, so `.filter(isNonNull)` removes `null | undefined`.
- **`isKeyOf(obj, key)`** narrows a `PropertyKey` to `keyof typeof obj`.
- **`assertNever(x: never): never`** rejects any argument that isn't `never` — and makes a forgotten `case` a compile error.

%% nudge
- Which return type form makes a function a *guard*?
- What type should `assertNever`'s parameter be, so that passing `'x'` is an error?

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

%% worked
**A similar problem, solved: a typed key-value store** — it relates a **key** to its **value type** exactly like the emitter relates an **event** to its **arguments**.

```ts
class TypedStore<S extends Record<string, unknown>> {       // ① S maps key names to value types
  private data: Partial<S> = {};

  set<K extends keyof S>(key: K, value: S[K]): void {       // ② K = which key; S[K] = the matching value type
    this.data[key] = value;
  }
  get<K extends keyof S>(key: K): S[K] | undefined {        // ③ the return type follows the key
    return this.data[key];
  }
}

const store = new TypedStore<{ name: string; age: number }>();
store.set('age', 30);        // ✓
// store.set('age', 'x');    // ✗ 'x' is not a number
```

For the emitter, replace "value" with "argument tuple": `on<K extends keyof E>(event: K, listener: (...args: E[K]) => void)` and `emit<K extends keyof E>(event: K, ...args: E[K])`. The constraint is `E extends Record<string, unknown[]>` because each payload is a *list*. The runtime part is a normal listener list per event, and `on` returns a function that removes just that listener.

%% explain
- **`on(event, listener)`**: listener parameters are inferred from the event name; returns an unsubscribe function.
- **`emit(event, ...args)`**: arguments must match the event's tuple exactly.
- **Unknown event names** are compile errors; `Events` is constrained to `Record<string, unknown[]>`.
- **Runtime behaviour**: listeners run in order; unsubscribing removes only that listener.

%% nudge
- Which part of the signature ties the *event name* to the *argument list*?
- How does `on` know which listener to remove when the unsubscribe function is called?

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

%% worked
**A similar problem, solved: turning a list of names into an object type.**

```ts
type Names = 'id' | 'postId';

// A mapped type over a UNION of strings makes one property per member:
type ParamsObject = { [K in Names]: string };
//   { id: string; postId: string }

// Generic version:
type ToObject<N extends string> = { [K in N]: string };
type X = ToObject<'a' | 'b'>;   // { a: string; b: string }
```

So `RouteParams<Path>` is two jobs chained: **(1)** extract the names as a union (the `Params<S>` type from the lesson's stepper), **(2)** turn that union into an object with `[K in Names]: string` — with a special case for "no params", where the extracted union is `never` and the answer must be `Record<string, never>`.

For `buildPath(path, params)`, make `params` typed as `RouteParams<P>` where `P` is a type parameter captured from the *path argument* (`P extends string`). "Extra keys are an error" comes for free on fresh object literals; the runtime part replaces each `:name` using a regex like `/:(\w+)/g`.

%% explain
- **`RouteParams<'/users/:id/posts/:postId'>`** is `{ id: string; postId: string }`.
- **No params** gives `Record<string, never>` (can only be empty), not `{}`.
- **`buildPath`** requires *exactly* the declared params: missing or extra ones are compile errors.
- It must **work at runtime**: the string is filled in correctly.

%% nudge
- How do you turn a union of names into an object type with one property per name?
- When there are no params, which type do you return instead?

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
