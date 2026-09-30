---
id: ts-generics
track: ts
title: Generics, inference & narrowing
summary: How to write functions and types that work for many types at once — and how TypeScript figures out, then narrows, what a value really is.
---

## The idea in one sentence

TypeScript checks your code **before it runs**, and **generics** let one function or type work for *many* types while keeping the exact type information.

> **Analogy** A generic is a **labelled moving box**. The label says "contents: T". You don't decide what T is when you make the box — whoever packs it does. Pack books, and everything that comes out is labelled "book"; pack plates, and it's "plate". The box itself is reusable.

Everything in this track is checked by the **real TypeScript compiler** (strict mode) running in your browser. In the snippets below, press **Run** to see what the compiler thinks. "No errors" means the compiler is happy with all the assertions. `Expect<Equal<A, B>>` is a helper that only compiles when `A` and `B` are exactly the same type; `// @ts-expect-error` *requires* the next line to be an error.

## Generics: a type with a slot

Here is a function that works on an array of *anything* and returns that kind of thing:

```ts try types
function first<T>(items: T[]): T | undefined {
  return items[0];
}

const a = first([1, 2, 3]);
const b = first(['x', 'y']);

type _a = Expect<Equal<typeof a, number | undefined>>;
type _b = Expect<Equal<typeof b, string | undefined>>;
```

`<T>` declares a **type parameter**: a slot for a type. You didn't write `first<number>(…)` — TypeScript **inferred** `T` from the argument.

![T is an empty slot that TypeScript fills from the argument](fig:generic-slot "Passing number[] fills the slot with number; passing string[] fills it with string. The return type follows automatically.")

Try changing `first([1, 2, 3])` to `first([1, 'a'])` and see what the type becomes (hint: `string | number`). If you ever *have* to write the type argument by hand, inference failed — that's a sign the signature needs improving, not a reason to sprinkle casts.

### Constraints: `extends` means "must fit"

Sometimes the slot can't be *anything*. `extends` says what shape it must have:

```ts try types
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

const s = longest('abc', 'de');
const arr = longest([1], [1, 2, 3]);
type _s = Expect<Equal<typeof s, 'abc' | 'de'>>;
type _arr = Expect<Equal<typeof arr, number[]>>;

// @ts-expect-error  numbers have no `length`
longest(1, 2);
```

### `keyof` and indexed access: the workhorse pair

`keyof T` is the union of a type's key names. `T[K]` is "the type of property `K` of `T`". Together they let the **return type depend on which key you pass**:

```ts try types
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: 'Ada' };
const name = get(user, 'name');
type _name = Expect<Equal<typeof name, string>>;

// @ts-expect-error  'nope' is not a key of user
get(user, 'nope');
```

"Relate two arguments through a type parameter" is most of practical generics.

## Conditional types and `infer`

A **conditional type** is an `if` for types:

![T extends string ? "yes" : "no" picks a branch; with a union it runs once per member](fig:conditional-flow "`A extends B ? X : Y` — if A fits B, the answer is X, otherwise Y. Given a union, it runs once for each member.")

`infer U` means "whatever type sits *here*, call it `U`". It is **pattern matching on types**. Step through it:

```stepper Matching types with infer
code:
  type ElementOf<T> = T extends (infer U)[] ? U : never;
  type A = ElementOf<string[]>;
  type B = ElementOf<number>;
  type C = ElementOf<string[] | number[]>;
---
line: 2
say: We ask: does `string[]` match the pattern `(something)[]`? Yes — and the "something" is `string`, so `U` becomes `string`.
Pattern (infer U)[] matches: yes
U is: string
Result: string
---
line: 3
say: Does `number` match `(something)[]`? No, it is not an array, so the `: never` branch is taken.
Pattern (infer U)[] matches: no
U is: (not set)
Result: never
---
line: 4
say: A union is **distributed**: TypeScript runs the conditional once per member. `string[]` gives `string`, `number[]` gives `number`, and the results are joined into a union.
Pattern (infer U)[] matches: yes, for each member
U is: string, then number
Result: string | number
```

Two behaviours that trip people up:

- **Distribution.** When `T` is a bare type parameter and you pass a union, the conditional runs *per member*. Wrap in a tuple (`[T] extends [X]`) to turn that off.
- **`never` vanishes.** `never` is the empty union, so a distributive conditional over `never` returns `never`.

## Narrowing: from a wide type to a specific one

A value often has a **union** type (`string | number | null`). Checks in your code **narrow** it, branch by branch:

![A union goes through null and typeof checks and becomes smaller types in each branch](fig:narrowing-funnel "After each check the compiler knows a smaller type. You don't cast — you prove it.")

```ts try
function describe(x: string | number | null): string {
  if (x === null) return 'nothing';
  if (typeof x === 'string') return x.toUpperCase();   // x is a string here
  return x.toFixed(1);                                  // x must be a number here
}

console.log(describe(null), describe('hi'), describe(3));
```

For objects, give every member of the union a shared **literal field** (the *discriminant*), and `switch` narrows on it:

```ts try types
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.radius ** 2;   // s: the circle member
    case 'square': return s.side ** 2;               // s: the square member
    default: {
      const unreachable: never = s;   // if you add a new Shape and forget a case, THIS line becomes an error
      return unreachable;
    }
  }
}
```

That `never` trick is called an **exhaustiveness check**: once every case is handled, nothing is left, and `never` is what remains. Other narrowers: `typeof`, `instanceof`, `in`, truthiness, equality, and **user-defined type guards** (`x is Foo`, in the real-world lesson).

## How the challenges work

Each case checks that a type equals the expected one (`Expect<Equal<A, B>>`) or that something is **rejected** (`// @ts-expect-error` — which itself errors if the next line is fine). Read the failing message; the compiler's wording is your teacher.

## Common mistakes

1. **Writing `any` to make an error go away** — it switches the checks off. Use `unknown` and narrow instead.
2. **Casting with `as`** when a generic or a narrowing check would prove it. A cast is a claim the compiler can't verify.
3. **Constraining too much or too little** (`T extends string` when `number` should also work, or no constraint when you use `.length`).
4. **Forgetting distribution**: a union input silently gives a union output.
5. **Thinking types exist at runtime** — they are erased. You can't `if (x instanceof MyType)` for a `type`.

## Quick check

```check
Q: What is the type of `x` in `const x = first(['a', 'b'])` if `first<T>(items: T[]): T | undefined`?
A) `any`
B) `T`
C) `string[]`
D) `string | undefined` *
Why: TypeScript infers `T = string` from the argument, and the return type is `T | undefined`.
---
Q: What does `T extends { length: number }` mean in a generic?
A) T must have a `length` property of type number (or be assignable to that shape) *
B) T is an object with only `length`
C) T inherits from a class
D) T is always an array
Why: In a constraint, `extends` means "must be assignable to". Strings, arrays and many other types qualify.
---
Q: What is `ElementOf<string[] | number[]>` for `type ElementOf<T> = T extends (infer U)[] ? U : never`?
A) `(string | number)[]`
B) `never`
C) `string | number` *
D) `string & number`
Why: The conditional distributes over the union: `string` for one member, `number` for the other, joined by `|`.
---
Q: In `switch (s.kind)` over a union of shapes, why can `s.radius` be used inside `case 'circle'`?
A) `radius` exists on every shape
B) TypeScript narrows `s` to the circle member because `kind` is a literal discriminant *
C) `switch` turns off type checking
D) `s` is cast to `any`
Why: The literal `kind` field lets the compiler narrow the union in each branch.
---
Q: What is the purpose of `const unreachable: never = s;` in a `default:` branch?
A) It silences all errors
B) It converts `s` to a string
C) It fails to compile if a union member is not handled by any `case` *
D) It makes the code run faster
Why: If every member is handled, `s` is `never` there. If you add a new member and forget it, `s` has a real type and assigning to `never` is an error.
```

## Recap

- A **generic** (`<T>`) is a type slot. TypeScript **infers** it from the arguments.
- **`extends`** in a constraint = "must be assignable to". **`keyof T`** = union of keys; **`T[K]`** = that property's type.
- **Conditional types** (`A extends B ? X : Y`) are type-level `if`s; **`infer`** pattern-matches; **unions distribute**.
- **Narrowing** (`typeof`, equality, `in`, discriminants) turns wide unions into specific types; `never` proves you handled everything.
- Prefer `unknown` + narrowing over `any` and `as`.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: last element | `infer` pattern matching (the stepper) |
| First element | `T extends [infer F, ...any[]]` — matching tuples |
| Rebuild the built-ins | Mapped types `{ [K in keyof T]: … }`, and distribution for `Exclude` |
| A typed `pick()` | `K extends keyof T` and the `get` example |
| Exhaustive `match()` | Discriminants, `Extract<T, { kind: K }>`, and a type parameter for the whole handlers object |

%% exercise ts-guided-last | Guided: last element | 1 | ts | types |  | 5 | guided
Implement `Last<T>`: the type of the **last** element of a tuple `T`. For an empty tuple it should be `never`.

```ts
type A = Last<[3, 2, 1]>; // 1
type B = Last<[]>;        // never
```

%% worked
**A similar problem, solved: `Second<T>`** — the second element of a tuple.

```ts
type Second<T extends any[]> =
  T extends [any, infer S, ...any[]]   // ① a pattern: "a first item, then something I'll call S, then anything else"
    ? S                                // ② if the tuple matches, the answer is whatever S turned out to be
    : never;                           // ③ if it doesn't match (too short), the answer is never

type X = Second<['a', 'b', 'c']>;      // 'b'
type Y = Second<['a']>;                // never (no second element)
```

`T extends [pattern]` tests whether the tuple fits the pattern, and `infer S` **captures** the piece in that position. `...any[]` means "and any number of other items". For `Last`, move the capture to the **end**: the rest comes first (`[...any[], infer L]`).

%% explain
- **`Last<[3, 2, 1]>` is `1`**, including keeping literal types.
- **Empty tuple gives `never`.**
- **Works with mixed element types** (strings, numbers, booleans).
- The test helper `Expect<Equal<A, B>>` passes only when the two types are *exactly* equal.

%% nudge
- Where does the captured item sit in the pattern — at the start or the end?
- What should the `: …` branch give when the tuple is empty?

%% starter
```ts
// Step 1 — write the conditional:   T extends [ ... ] ? ... : ...
// Step 2 — the pattern for "anything, then the last item" is  [...any[], infer L]
// Step 3 — if it matches, the answer is L; otherwise never.
type Last<T extends any[]> = any;
```

%% tests
```ts
//! picks the last element
type _a = Expect<Equal<Last<[3, 2, 1]>, 1>>;
//! works with a single element
type _b = Expect<Equal<Last<['only']>, 'only'>>;
//! keeps mixed element types
type _c = Expect<Equal<Last<[string, number, boolean]>, boolean>>;
//! gives never for an empty tuple
type _d = Expect<Equal<Last<[]>, never>>;
```

%% hints
- `T extends [...any[], infer L] ? L : never`

%% solution
```ts
type Last<T extends any[]> = T extends [...any[], infer L] ? L : never;
```

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

%% worked
**A similar problem, solved: `Length<T>`** — how many items a tuple has. It shows the two tools you need: a **constraint** on `T` and an **indexed access**.

```ts
type Length<T extends readonly any[]> = T['length'];   // ① tuples have a literal `length` type

type N = Length<['a', 'b', 'c']>;   // 3
```

`First` needs a *pattern* instead of a property, because the thing you want is an element, not the length:

```ts
type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never;
```

**Read it aloud:** "if `T` looks like *one item called H followed by anything*, the answer is `H`; otherwise (the empty tuple) `never`." (That is almost `First` — the difference is only the names. Try writing it yourself from the pattern above before you peek at hints.)

%% explain
- **Picks the first element** of a tuple (`[3, 2, 1]` → `3`).
- **Keeps mixed element types** and **literal types** (`'a'`, not `string`).
- **Empty tuple → `never`.**

%% nudge
- What does a tuple look like when it has at least one item? Write that shape as a pattern.
- Which keyword captures a piece of the pattern so you can return it?

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

%% worked
**A similar problem, solved: `MyPartial<T>` and `MyExtract<T, U>`.**

```ts
// Mapped type: loop over every key K of T and build a new property for it
type MyPartial<T> = {
  [K in keyof T]?: T[K];      // ① same keys, same value types, but each one optional (`?`)
};

// Conditional type that distributes over a union
type MyExtract<T, U> = T extends U ? T : never;   // ② runs once per union member; keep it, or drop it (never)

type A = MyExtract<'a' | 'b' | 'c', 'a' | 'c'>;   // 'a' | 'c'
```

- **Mapped types** (`{ [K in keyof T]: … }`) rebuild an object type key by key. Add `readonly` or `?` in front to change modifiers.
- **Distribution** is what makes `MyExtract` work on unions — `never` members disappear from the result.
- `MyPick` also needs a **constraint** (`K extends keyof T`) so unknown keys are errors, and iterates over `K` instead of `keyof T`. `MyOmit` = pick the keys of `T` that are *not* in `K` (hint: use your own `MyExclude` on `keyof T`).

%% explain
- **`MyPick`** keeps only the chosen keys, and rejects keys that aren't on `T` (a compile error).
- **`MyReadonly`** makes every property `readonly`.
- **`MyExclude`** removes the union members that fit `U`.
- **`MyOmit`** drops the given keys (one or several).
- **No cheating**: the original `Pick`, `Readonly`, `Exclude`, `Omit` can't be used.

%% nudge
- Which of the four is a *conditional* type and which are *mapped* types?
- For `MyOmit`, which union of keys do you want to keep, and which of your own types can compute it?

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

%% worked
**A similar problem, solved: `values(obj, keys)`** — returns the values of chosen keys, with an exact tuple-ish type.

```ts
export function values<T, K extends keyof T>(obj: T, keys: K[]): T[K][] {
  //                   ① T = the whole object type, K = the union of keys we were given
  return keys.map((k) => obj[k]);     // ② obj[k] has type T[K], which the compiler can check
}

const user = { id: 1, name: 'Ada', admin: true };
const v = values(user, ['id', 'name']);    // (string | number)[]
// values(user, ['email']);                // ✗ error: 'email' is not a key of user
```

The recipe for "the keys I pass must exist": a type parameter for the **object** (`T`), a second for the **keys** (`K extends keyof T`), and the return type built from both (`T[K]`, `Pick<T, K>`…). For `pick`, the body must build a *new object*: start with `{} as Pick<T, K>` — the cast is OK here because you fill it in right after — and copy each key.

%% explain
- **Return type** is exactly `Pick<T, K>` for the object and keys you passed.
- **Unknown keys** are compile errors.
- **Nested objects** keep their types.
- **The function also has to work at runtime** (the signature may not use `any`).

%% nudge
- Which two type parameters does the signature need?
- What makes `'email'` an error when the object has no such key?

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

%% worked
**A similar problem, solved: `kinds<T>`** — build a type from a discriminated union. It introduces `Extract`, the tool that picks one member of a union.

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

type Kind = Shape['kind'];                          // 'circle' | 'square'  (indexed access on a union)
type Circle = Extract<Shape, { kind: 'circle' }>;   // { kind: 'circle'; radius: number }

// One handler per kind, each receiving ITS member:
type Handlers<T extends { kind: string }> = {
  [K in T['kind']]: (value: Extract<T, { kind: K }>) => unknown;
};
```

`Handlers<Shape>` is `{ circle: (value: Circle) => unknown; square: (value: Square) => unknown }` — exactly what `match` should accept. The hints describe the two remaining pieces: capture the **whole handlers object** in a type parameter `H` so the return type can be computed from it, and add an **intersection** to make extra keys errors.

%% explain
- **One handler per kind**: a missing or extra handler is a compile error.
- **Each handler receives its narrowed member** (`c.radius` for circles; `c.side` is an error).
- **Result type** is what the handlers return (`number`, `string`, …).
- **Works for any union with a string `kind`.**

%% nudge
- How can a mapped type produce one property per `kind` in the union?
- Why does capturing the handlers as a type parameter `H` help the return type?

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
