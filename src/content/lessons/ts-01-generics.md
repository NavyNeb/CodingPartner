---
id: ts-generics
track: ts
title: Generics, inference & narrowing
summary: Types as functions — parameters, constraints, `infer`, and making the compiler do the work.
---

Everything here is checked by the **real TypeScript compiler** (strict mode) running in your browser. A challenge passes when the compiler stays silent on the assertions, so *no errors = green*.

## Generics are functions on types

```ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}
first([1, 2, 3]);   // T inferred as number
first(['a']);       // T inferred as string
```

`<T>` is a *type parameter*. TypeScript **infers** it from the arguments, so you rarely write `first<number>(…)` by hand. When you have to, inference failed — that's a signal to improve the signature, not to sprinkle casts.

### Constraints: `extends` means "must be assignable to"

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
longest('abc', 'de');      // string
longest([1], [1, 2, 3]);   // number[]
longest(1, 2);             // ✗ number has no length
```

### `keyof` + indexed access: the workhorse pair

```ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
get({ id: 1, name: 'Ada' }, 'name'); // string
get({ id: 1, name: 'Ada' }, 'nope'); // ✗
```

The return type `T[K]` *depends on which key you passed*. This "relate two arguments through a type parameter" move is most of practical generics.

## Conditional types and `infer`

```ts
type ElementOf<T> = T extends (infer U)[] ? U : never;
type A = ElementOf<string[]>;  // string
type B = ElementOf<number>;    // never
```

`T extends X ? A : B` is an if-statement at the type level. `infer U` declares a fresh variable that TypeScript solves for while matching. Two behaviours that trip people up:

- **Distribution.** When `T` is a *naked* type parameter and you pass a union, the conditional runs per member: `ElementOf<string[] | number[]>` is `string | number`. Wrap in a tuple (`[T] extends [X]`) to switch it off.
- **`never` vanishes.** `never` is the empty union, so a distributive conditional over `never` returns `never`.

## Narrowing: how a union becomes a specific type

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

function area(s: Shape) {
  switch (s.kind) {
    case 'circle': return Math.PI * s.radius ** 2; // s: circle
    case 'square': return s.side ** 2;             // s: square
  }
}
```

A shared literal field (the **discriminant**) lets `switch`/`if` narrow. Add a default branch that assigns to `never` and the compiler tells you when you forget a case:

```ts
const _exhaustive: never = s; // error if a Shape member is unhandled
```

Other narrowers: `typeof`, `instanceof`, `in`, truthiness, equality, and **user-defined guards** (`x is Foo`).

## How the challenges work

Each case checks that a type equals the expected one (`Expect<Equal<A, B>>`) or that something is *rejected* (`// @ts-expect-error` — which itself errors if the next line is fine). Read the failing message; the compiler's wording is your teacher.

%% exercise ts-first | First element | 1 | ts | types |  | 5
Implement `First<T>`: the type of the first element of a tuple `T`. For an empty tuple it should be `never`.

```ts
type A = First<[3, 2, 1]>; // 3
type B = First<[]>;        // never
```

%% starter
```ts
type First<T extends any[]> = any;
```

%% tests
```ts
//! picks the first element of a tuple
type _a = Expect<Equal<First<[3, 2, 1]>, 3>>;
//! keeps mixed element types
type _b = Expect<Equal<First<[string, number, boolean]>, string>>;
//! gives never for an empty tuple
type _c = Expect<Equal<First<[]>, never>>;
//! keeps literal types
type _d = Expect<Equal<First<['a', 'b']>, 'a'>>;
```

%% hints
- Match the tuple's shape: `T extends [infer F, ...any[]]`.
- The false branch of the conditional is where the empty tuple lands.

%% solution
```ts
type First<T extends any[]> = T extends [infer F, ...any[]] ? F : never;
```

%% exercise ts-rebuild-builtins | Rebuild the built-ins | 2 | ts | types |  | 15
Re-implement four utility types from the standard library **without using the originals** (`Pick`, `Readonly`, `Exclude`, `Omit` are off limits, though `Extract`-style tricks and `keyof` are fine).

- `MyPick<T, K>` — only keys `K`, where `K` must be a key of `T`.
- `MyReadonly<T>` — every property `readonly`.
- `MyExclude<T, U>` — remove from union `T` the members assignable to `U`.
- `MyOmit<T, K>` — `T` without keys `K`.

%% starter
```ts
type MyPick<T, K> = any;
type MyReadonly<T> = any;
type MyExclude<T, U> = any;
type MyOmit<T, K> = any;
```

%% tests
```ts
interface Todo { title: string; description: string; done: boolean }

//! MyPick keeps only the chosen keys
type _p1 = Expect<Equal<MyPick<Todo, 'title' | 'done'>, { title: string; done: boolean }>>;
//! MyPick rejects keys that are not on T
// @ts-expect-error
type _p2 = MyPick<Todo, 'title' | 'nope'>;
//! MyReadonly makes every property readonly
type _r1 = Expect<Equal<MyReadonly<Todo>, { readonly title: string; readonly description: string; readonly done: boolean }>>;
//! MyExclude removes matching members
type _e1 = Expect<Equal<MyExclude<'a' | 'b' | 'c', 'a'>, 'b' | 'c'>>;
//! MyExclude works with non-literal members
type _e2 = Expect<Equal<MyExclude<string | number | boolean, number | boolean>, string>>;
//! MyOmit drops the chosen keys
type _o1 = Expect<Equal<MyOmit<Todo, 'description'>, { title: string; done: boolean }>>;
//! MyOmit accepts several keys
type _o2 = Expect<Equal<MyOmit<Todo, 'description' | 'done'>, { title: string }>>;
```

%% hints
- `MyPick`: `K extends keyof T` and a mapped type `{ [P in K]: T[P] }`.
- `MyReadonly`: `{ readonly [P in keyof T]: T[P] }`.
- `MyExclude` is a *distributive* conditional: `T extends U ? never : T`.
- `MyOmit` = `MyPick<T, MyExclude<keyof T, K>>` — or use key remapping with `as`.

%% solution
```ts
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
type MyReadonly<T> = { readonly [P in keyof T]: T[P] };
type MyExclude<T, U> = T extends U ? never : T;
type MyOmit<T, K extends keyof any> = { [P in keyof T as P extends K ? never : P]: T[P] };
```

%% exercise ts-typed-pick | A typed pick() | 2 | ts | types | pick | 12
Write a real function `pick(obj, keys)` that returns a new object containing only the listed keys — and whose **type** is precise.

- The return type is `Pick<T, K>` for the passed object and keys.
- Passing a key that is not on the object is a compile error.
- The implementation must compile under `strict` without `any` escape hatches in the *signature*.

%% starter
```ts
export function pick(obj: any, keys: any[]): any {
  return obj;
}
```

%% tests
```ts
const user = { id: 1, name: 'Ada', admin: true };
//! returns exactly the picked keys
const p1 = pick(user, ['id', 'name']);
type _a = Expect<Equal<typeof p1, { id: number; name: string }>>;
//! keeps literal key precision for one key
const p2 = pick(user, ['admin']);
type _b = Expect<Equal<typeof p2, { admin: boolean }>>;
//! rejects unknown keys
// @ts-expect-error
pick(user, ['id', 'email']);
//! works on nested object types
const cfg = { server: { port: 80 }, debug: false };
const p3 = pick(cfg, ['server']);
type _c = Expect<Equal<typeof p3, { server: { port: number } }>>;
```

%% hints
- Two type parameters: `T` (the object) and `K extends keyof T` (the keys).
- `keys: K[]` — TypeScript infers `K` as a **union of the string literals** you pass.
- Build the result with `const out = {} as Pick<T, K>;` and loop over `keys`.

%% solution
```ts
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = obj[key];
  return out;
}
```

%% exercise ts-exhaustive-match | Exhaustive match() | 4 | ts | types | match | 30
Build `match(value, handlers)` for discriminated unions — a compile-time-safe alternative to `switch`.

```ts
type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number };

const area = match(shape, {
  circle: (c) => Math.PI * c.radius ** 2, // c is the circle member
  square: (s) => s.side ** 2,             // s is the square member
});
```

Requirements:
- `value` is any object with a string `kind`.
- `handlers` **must** have exactly one handler per `kind` — a missing one or an unknown one is a compile error.
- Each handler receives its **narrowed** member.
- The result type is what the handlers return.

%% starter
```ts
export function match(value: any, handlers: any): any {
  return handlers[value.kind](value);
}
```

%% tests
```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rect'; w: number; h: number };
declare const shape: Shape;

//! narrows each handler's argument and infers the result
const area = match(shape, {
  circle: (c) => c.radius ** 2 * Math.PI,
  square: (s) => s.side ** 2,
  rect: (r) => r.w * r.h,
});
type _a = Expect<Equal<typeof area, number>>;
//! requires a handler for every kind
// @ts-expect-error
match(shape, { circle: () => 1, square: () => 2 });
//! rejects handlers for kinds that do not exist
// @ts-expect-error
match(shape, { circle: () => 1, square: () => 2, rect: () => 3, hexagon: () => 4 });
//! handler arguments are narrowed (wrong property is an error)
// @ts-expect-error
match(shape, { circle: (c) => c.side, square: () => 2, rect: () => 3 });
//! works with a differently shaped union
type Ev = { kind: 'click'; x: number } | { kind: 'key'; key: string };
declare const ev: Ev;
const label = match(ev, { click: (e) => `x=${e.x}`, key: (e) => e.key });
type _b = Expect<Equal<typeof label, string>>;
```

%% hints
- Describe the handler map with a mapped type over the kinds: `{ [K in T['kind']]: (v: Extract<T, { kind: K }>) => unknown }`. `Extract<T, { kind: K }>` picks the union member whose discriminant is `K`.
- Trying to infer a return-type parameter `R` *through* that mapped type gives you `unknown`. Instead capture the **whole handlers object** as a type parameter `H extends Handlers<T>`, and return `ReturnType<H[T['kind']]>`.
- A type parameter constrained with `extends` does not get excess-property checking. Add it back by intersecting the parameter: `H & Record<Exclude<keyof H, T['kind']>, never>` — any extra key must be `never`, so any real handler fails.
- The body needs one cast; the *signature* is the point.

%% solution
```ts
type Handlers<T extends { kind: string }> = {
  [K in T['kind']]: (v: Extract<T, { kind: K }>) => unknown;
};

export function match<T extends { kind: string }, H extends Handlers<T>>(
  value: T,
  handlers: H & Record<Exclude<keyof H, T['kind']>, never>,
): ReturnType<H[T['kind']]> {
  return (handlers as unknown as Record<string, (v: T) => ReturnType<H[T['kind']]>>)[value.kind](value);
}
```
