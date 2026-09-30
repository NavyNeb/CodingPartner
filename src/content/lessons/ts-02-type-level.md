---
id: ts-type-level
track: ts
title: Mapped, conditional & template-literal types
summary: Transform types the way you transform data — loop over keys, rename them, recurse, and even take strings apart at compile time.
---

## The idea in one sentence

You already know how to **transform data** with `map`, `filter` and recursion — TypeScript lets you do the same thing to **types**.

> **Analogy** Think of a type as a **spreadsheet row**. A *mapped type* is a formula you drag across every column ("make each cell optional"). A *conditional type* is an `IF` cell. A *template literal type* is a text formula (`="get" & A1`). *Recursion* is a formula that refers to itself on a smaller input.

Once you can read `T extends U ? X : Y` and `{ [K in keyof T]: … }`, most "advanced" TypeScript is a mix of four ideas. Every snippet below is checked by the real compiler — press **Run**.

## 1. Mapped types: loop over the keys

```ts try types
type Optional<T> = { [K in keyof T]?: T[K] };
type Mutable<T> = { -readonly [K in keyof T]-?: T[K] };   // a leading `-` REMOVES a modifier

type User = { readonly id: number; name?: string };

type _o = Expect<Equal<Optional<{ id: number; name: string }>, { id?: number; name?: string }>>;
type _m = Expect<Equal<Mutable<User>, { id: number; name: string }>>;
```

Read `[K in keyof T]` as a `for` loop: *"for every key K of T…"*. The part after the colon is the new value type for that key. `?` and `readonly` add modifiers; `-?` and `-readonly` take them away.

When the loop is over `keyof T` for a type parameter `T`, it is **homomorphic**: it copies each key's optionality and `readonly` automatically, and it maps **tuples to tuples** and arrays to arrays.

## 2. Key remapping with `as`

You can also **rename** keys while you loop:

![Getters of name and age: each key is renamed and each value wrapped in a function](fig:mapped-table "`as` renames the key; `T[K]` looks up the value type. K takes each key in turn.")

```ts try types
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type _g = Expect<Equal<Getters<{ name: string; age: number }>, { getName: () => string; getAge: () => number }>>;

// Remapping a key to `never` DROPS it:
type WithoutId<T> = { [K in keyof T as K extends 'id' ? never : K]: T[K] };
type _w = Expect<Equal<WithoutId<{ id: number; name: string }>, { name: string }>>;
```

(`string & K` just tells TypeScript the key is text, so `Capitalize` accepts it.)

## 3. Recursion: types that call themselves

A type can refer to itself, like a recursive function. It is how `DeepPartial`, `DeepReadonly`, path types and string parsers work. You need a **base case** (stop) and a **recursive case** (smaller input):

![Flatten peels one array layer off per call until only number is left](fig:recursion-unroll "Each call unwraps one `[]` using `infer`. The base case returns the type unchanged.")

```ts try types
type Flatten<T> = T extends readonly (infer U)[] ? Flatten<U> : T;

type _f = Expect<Equal<Flatten<number[][][]>, number>>;
```

There is a recursion-depth limit (about 50 nested instantiations, or ~1000 for "tail-recursive" conditional types), so very long strings need an *accumulator* parameter. For everyday types you won't hit it.

## 4. Template literal types: parse strings

The same backtick syntax as JavaScript, but for **types**. Combined with `infer`, the compiler can *take a string literal type apart*:

![Matching hello_world_ts against Head_Rest splits it and recurses on the rest](fig:template-parse "The pattern `${infer Head}_${infer Rest}` splits at the first underscore; then the type calls itself on `Rest`.")

```stepper Turning 'a_bc_d' into camelCase, one call at a time
code:
  type Camel<S extends string> =
    S extends `${infer A}_${infer B}`
      ? `${A}${Capitalize<Camel<B>>}`
      : S;
  type R = Camel<'a_bc_d'>;
---
line: 5
say: We ask for `Camel<'a_bc_d'>`. Does the string match the pattern "text, an underscore, more text"?
Call: Camel<'a_bc_d'>
A and B:
Built so far:
---
line: 2-3
say: Yes. `A` is the text before the **first** underscore, `B` is everything after it. So the result is `a` followed by the capitalised `Camel<'bc_d'>` — a recursive call on the smaller string.
Call: Camel<'a_bc_d'>
A and B: A = "a" | B = "bc_d"
Built so far: a + Capitalize<Camel<"bc_d">>
---
line: 2-3
say: Same again for `'bc_d'`: `A = "bc"`, `B = "d"`. We now need `Camel<'d'>`.
Call: Camel<'bc_d'>
A and B: A = "bc" | B = "d"
Built so far: bc + Capitalize<Camel<"d">>
---
line: 4
say: `'d'` has no underscore, so the pattern does **not** match and we hit the base case: the answer is just `'d'`.
Call: Camel<'d'>
A and B: (no match)
Built so far: d
---
line: 3
say: Now it unwinds. `Capitalize<'d'>` is `'D'`, so `Camel<'bc_d'>` is `'bcD'`. Then `Capitalize<'bcD'>` is `'BcD'`, so the final answer is `'a'` + `'BcD'`.
Call: Camel<'a_bc_d'>
A and B: (done)
Built so far: aBcD
```

```ts try types
type Head<S> = S extends `${infer H}/${string}` ? H : S;
type Camel<S extends string> = S extends `${infer A}_${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S;

type _h = Expect<Equal<Head<'users/42/edit'>, 'users'>>;
type _c = Expect<Equal<Camel<'hello_world_ts'>, 'helloWorldTs'>>;

// Template types also describe ALLOWED strings:
type Route = `/users/${number}`;
const ok: Route = '/users/42';
// @ts-expect-error  'abc' is not a number
const bad: Route = '/users/abc';
```

Routers, CSS-in-TS and i18n libraries use exactly this to catch typos in strings at compile time.

## A detour: why function parameters flip direction

One fact powers an exercise later: function **parameters are contravariant**. A function that accepts *more* can stand in for one that accepts *less*, but not the other way round:

```ts try types
type Wide = (x: string | number) => void;
const wide: Wide = (x) => {};

const narrowSlot: (x: string) => void = wide;     // OK: wide handles strings too

// @ts-expect-error  a function that ONLY takes strings can't stand in for one that takes string | number
const wideSlot: Wide = (x: string) => {};
```

That reversal is why inferring a parameter from several functions gives the **intersection** of what they accept.

## Reading strategy for type puzzles

1. Write the **expected** result for 2–3 inputs first (that's what the tests are).
2. Solve the **base case**, then the **recursive** case.
3. Got a union you didn't want? Ask: *"is this conditional distributing?"*
4. Got `unknown` or `{}` when you expected an error? Look for a missing constraint.
5. Remember `Equal` is strict: `{ a: 1 } & { b: 2 }` and `{ a: 1; b: 2 }` are mutually assignable but **not identical** to it.

## Common mistakes

1. **Forgetting the base case** — the type never stops (or hits the depth limit).
2. **Expecting `T extends U` to be a yes/no for unions** — it distributes; wrap in `[T]` to prevent it.
3. **`keyof T` includes `string | number | symbol`** — use `string & K` (or `Extract<keyof T, string>`) before template literals.
4. **Mapping over a union of keys you built by hand** and losing `?`/`readonly` (only `keyof T` of a type parameter is homomorphic).
5. **Making types so clever nobody can read them.** Name the pieces.

## Quick check

```check
Q: What does `-readonly` do in `{ -readonly [K in keyof T]: T[K] }`?
A) Makes every property readonly
B) Removes `readonly` from every property *
C) Removes the properties
D) Makes the properties optional
Why: A leading `-` removes a modifier; `+` (or nothing) adds it. `-?` removes optionality the same way.
---
Q: What is `Getters<{ id: number }>` using the `get${Capitalize<...>}` remapping?
A) `{ id: () => number }`
B) `{ GetId: number }`
C) `{ getid: () => number }`
D) `{ getId: () => number }` *
Why: `as` renames the key to `get` + capitalised key name; the value becomes a function returning the old value type.
---
Q: Matching the string 'a_bc_d' against the pattern A, an underscore, then B (written with infer), what is B?
A) `'d'`
B) `'bc'`
C) `'bc_d'` *
D) `'_bc_d'`
Why: `A` matches the shortest text before the **first** underscore; `B` takes everything after it.
---
Q: Which of these is required for a recursive type to terminate?
A) A base case that returns without recursing *
B) A `never` default
C) The keyword `recursive`
D) A `readonly` modifier
Why: Like any recursion, the type must reach an input where it stops calling itself.
---
Q: A homomorphic mapped type over a tuple type like `[string, number]` …
A) returns a tuple with mapped element types *
B) returns an object with keys "0" and "1"
C) returns a union
D) is a compile error
Why: Mapping over `keyof T` for a type parameter `T` preserves the tuple/array structure instead of producing a plain object.
```

## Recap

- **Mapped types** `{ [K in keyof T]: … }` loop over keys; `?`, `readonly`, `-?`, `-readonly` adjust modifiers; `as` renames (or drops with `never`) keys.
- **Recursion** needs a base case and a smaller input each time.
- **Template literal types** + `infer` parse strings (`${infer A}_${infer B}`), and describe allowed strings (`/users/${number}`).
- **Distribution** and **contravariance** are the two behaviours that surprise people.
- Solve type puzzles the same way as code: examples first, base case, then recursion.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: Nullable | Mapped types (section 1) |
| `DeepReadonly` | Mapped types + recursion (sections 1 and 3), and leaving functions alone |
| `MyAwaited` | `infer` + recursion; unwrapping "thenables" |
| Getters with key remapping | Section 2 |
| `snake_case` → `camelCase` | Section 4 and the stepper |
| Dot paths of an object | Recursion + template literals + indexed access over keys |
| `UnionToIntersection` | Distribution + the contravariance detour |

%% exercise ts-guided-nullable | Guided: Nullable | 1 | ts | types |  | 5 | guided
Implement `Nullable<T>`: the same object type, but every property's type also allows `null`.

```ts
type N = Nullable<{ name: string; age: number }>;
// { name: string | null; age: number | null }
```

%% worked
**A similar problem, solved: `Stringify<T>`** — every property becomes a `string`.

```ts
type Stringify<T> = {
  [K in keyof T]: string;      // ① "for every key K of T…" ② "…the new value type is string"
};

type S = Stringify<{ id: number; ok: boolean }>;   // { id: string; ok: string }
```

`[K in keyof T]` loops over the keys; what follows the colon is the new type of each property. Use `T[K]` if you want to refer to the **old** type of that property. Because the loop is over `keyof T`, modifiers like `readonly` and `?` are kept automatically.

%% explain
- **Every property** gets `| null` added to its old type.
- **`readonly` is preserved** (a homomorphic mapped type copies modifiers).
- **Empty object** stays empty.

%% nudge
- Which part of the mapped type refers to the *old* property type?
- How do you write "the old type, or null"?

%% starter
```ts
// Step 1 — a mapped type:     { [K in keyof T]: ... }
// Step 2 — the new value is the old value (T[K]) OR null.
type Nullable<T> = any;
```

%% tests
```ts
//! adds null to every property
type _a = Expect<Equal<Nullable<{ name: string; age: number }>, { name: string | null; age: number | null }>>;
//! keeps readonly
type _b = Expect<Equal<Nullable<{ readonly id: number }>, { readonly id: number | null }>>;
//! handles an empty object
type _c = Expect<Equal<Nullable<{}>, {}>>;
//! works with union property types
type _d = Expect<Equal<Nullable<{ v: string | number }>, { v: string | number | null }>>;
```

%% hints
- `{ [K in keyof T]: T[K] | null }`

%% solution
```ts
type Nullable<T> = { [K in keyof T]: T[K] | null };
```

%% exercise ts-deep-readonly | DeepReadonly | 3 | ts | types |  | 15
Implement `DeepReadonly<T>`: make every property — at every depth, including inside tuples and arrays — `readonly`. Functions must be left as they are.

%% starter
```ts
type DeepReadonly<T> = any;
```

%% tests
```ts
//! makes a flat object readonly
type _a = Expect<Equal<DeepReadonly<{ a: string; b: number }>, { readonly a: string; readonly b: number }>>;
//! recurses into nested objects
type _b = Expect<Equal<DeepReadonly<{ x: { y: { z: boolean } } }>, { readonly x: { readonly y: { readonly z: boolean } } }>>;
//! leaves functions alone
type _c = Expect<Equal<DeepReadonly<{ f: () => void }>, { readonly f: () => void }>>;
//! recurses through tuples
type _d = Expect<Equal<DeepReadonly<{ t: ['hi', { m: ['hey'] }] }>, { readonly t: readonly ['hi', { readonly m: readonly ['hey'] }] }>>;
//! leaves primitives alone
type _e = Expect<Equal<DeepReadonly<string>, string>>;
```

%% worked
**A similar problem, solved: `DeepPartial<T>`** — every property optional, at every depth.

```ts
type DeepPartial<T> =
  T extends (...args: any[]) => any ? T           // ① base case: leave functions alone
  : T extends object                              // ② an object (or array/tuple): go inside
    ? { [K in keyof T]?: DeepPartial<T[K]> }      // ③ mapped type; each value is processed by the SAME type (recursion)
    : T;                                          // ④ base case: a primitive stays as it is
```

The recipe: **(1)** decide what the *leaves* are (primitives and functions), **(2)** for everything else use a mapped type whose values call the type again. Because the mapped type is *homomorphic*, tuples and arrays stay tuples and arrays, so you don't need a special case for them. For `DeepReadonly`, the only change is the modifier in front of the loop.

%% explain
- **Every property is `readonly`** at every depth.
- **Arrays and tuples** become readonly arrays/tuples, with readonly contents.
- **Functions stay as they are** (not turned into weird objects).
- **Primitives** are unchanged.

%% nudge
- What are the "leaf" types where the recursion should stop?
- Which modifier goes in front of `[K in keyof T]`?

%% hints
- Three branches: function → return it; object → map with `readonly` and recurse; otherwise the primitive itself.
- `T extends (...args: any[]) => any` detects functions. Check it *before* `T extends object` (functions are objects).
- A homomorphic mapped type `{ readonly [K in keyof T]: … }` handles tuples for you.

%% solution
```ts
type DeepReadonly<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
```

%% exercise ts-awaited | MyAwaited | 3 | ts | types |  | 15
Implement `MyAwaited<T>`: unwrap a promise **recursively** — `Promise<Promise<string>>` becomes `string`. It should also unwrap any "thenable": an object whose `then` takes a callback.

%% starter
```ts
type MyAwaited<T> = any;
```

%% tests
```ts
//! unwraps a promise
type _a = Expect<Equal<MyAwaited<Promise<string>>, string>>;
//! unwraps nested promises
type _b = Expect<Equal<MyAwaited<Promise<Promise<number>>>, number>>;
//! leaves non-promises alone
type _c = Expect<Equal<MyAwaited<boolean>, boolean>>;
//! unwraps thenables
type Thenable = { then: (onfulfilled: (arg: number) => any) => any };
type _d = Expect<Equal<MyAwaited<Thenable>, number>>;
//! handles union members
type _e = Expect<Equal<MyAwaited<Promise<string> | number>, string | number>>;
```

%% worked
**A similar problem, solved: `Unwrap<T>`** — peel arrays off recursively: `string[][]` → `string`.

```ts
type Unwrap<T> = T extends Array<infer U> ? Unwrap<U> : T;
//                         ① capture what's inside     ② call ourselves on it   ③ base case: not an array → stop
```

`MyAwaited` is the same idea with a **different pattern**: instead of "an array of U", match "something with a `then` method whose callback receives V":

```ts
T extends { then: (onfulfilled: infer F, ...args: any[]) => any }   // "thenable"
```

then look at the **parameter of the callback `F`** (another `infer`) to find V, and recurse on V. Everything that isn't a thenable is the base case. Two traps: a thenable whose `then` isn't callable (don't unwrap it), and distribution (`Promise<A> | B`) — the conditional distributes over unions automatically, which is what you want here.

%% explain
- **Nested promises unwrap fully** (`Promise<Promise<string>>` → `string`).
- **Plain values** come back unchanged.
- **Thenables** (objects with a callback-taking `then`) are unwrapped too.
- **Unions** of promises and values are handled member by member.

%% nudge
- Which part of a promise type holds the resolved value, and how do you capture it with `infer`?
- After unwrapping once, what must you do with the result so nested promises work?

%% hints
- Match a thenable structurally: `T extends { then: (onfulfilled: (arg: infer U) => any) => any }`.
- Then recurse on `U`, since the resolved value might itself be a promise.
- Naked `T` means the union case works for free (distribution).

%% solution
```ts
type MyAwaited<T> = T extends { then: (onfulfilled: (arg: infer U) => any) => any } ? MyAwaited<U> : T;
```

%% exercise ts-getters | Getters with key remapping | 3 | ts | types |  | 12
Implement `Getters<T>`: for every property `name: string` produce a **method** `getName: () => string`. Property names become `get` + capitalised name.

```ts
type G = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }
```

%% starter
```ts
type Getters<T> = any;
```

%% tests
```ts
//! turns properties into getter methods
type _a = Expect<Equal<Getters<{ name: string; age: number }>, { getName: () => string; getAge: () => number }>>;
//! keeps value types precise
type _b = Expect<Equal<Getters<{ ok: true; tags: string[] }>, { getOk: () => true; getTags: () => string[] }>>;
//! handles an empty object
type _c = Expect<Equal<Getters<{}>, {}>>;
```

%% worked
**A similar problem, solved: `Prefixed<T, P>`** — prefix every key with a string.

```ts
type Prefixed<T, P extends string> = {
  [K in keyof T as `${P}${string & K}`]: T[K];
  //          ① `as` renames the key using a template literal type
  //                       ② `string & K` narrows the key to text so it fits in a template
};

type X = Prefixed<{ id: number }, 'user_'>;   // { user_id: number }
```

For `Getters`, two changes: capitalise the key (`Capitalize<string & K>`) and **change the value** from `T[K]` into a function type `() => T[K]`.

%% explain
- **Each property `name: string`** becomes a method `getName: () => string`.
- **Names** are `get` + the capitalised property name.
- **Value types** are preserved inside the function's return type.

%% nudge
- Which part of the mapped type controls the *key*, and which controls the *value*?
- Which built-in capitalises the first letter of a string type?

%% hints
- Remap keys: `[K in keyof T as \`get${Capitalize<...>}\`]`.
- `keyof T` may include `number | symbol`; `Capitalize` only accepts strings. Use `string & K`.

%% solution
```ts
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
```

%% exercise ts-snake-to-camel | snake_case → camelCase | 3 | ts | types |  | 15
Implement `SnakeToCamel<S>` for string literal types.

```ts
type A = SnakeToCamel<'hello_world_ts'>; // 'helloWorldTs'
```

Input is lower-case words joined by `_`. A string without underscores is returned unchanged.

%% starter
```ts
type SnakeToCamel<S extends string> = any;
```

%% tests
```ts
//! two words
type _a = Expect<Equal<SnakeToCamel<'foo_bar'>, 'fooBar'>>;
//! many words
type _b = Expect<Equal<SnakeToCamel<'hello_world_ts_rocks'>, 'helloWorldTsRocks'>>;
//! no underscore
type _c = Expect<Equal<SnakeToCamel<'single'>, 'single'>>;
//! works across a union
type _d = Expect<Equal<SnakeToCamel<'a_b' | 'c_d'>, 'aB' | 'cD'>>;
```

%% worked
**A similar problem, solved: `SpacesToDashes<S>`** — replace each space with `-`.

```ts
type SpacesToDashes<S extends string> =
  S extends `${infer A} ${infer B}`            // ① split at the FIRST space
    ? `${A}-${SpacesToDashes<B>}`              // ② glue with a dash, recurse on the rest
    : S;                                       // ③ base case: no space left

type R = SpacesToDashes<'a b c'>;   // 'a-b-c'
```

`SnakeToCamel` is the same recursion with `_` as the split character and one extra step: the remaining part must start with a **capital letter** (`Capitalize<…>`) before it is glued on.

%% explain
- **`hello_world_ts` → `helloWorldTs`**.
- **No underscore** → unchanged.
- **Works for any number of words.**

%% nudge
- What string do you split on, and what do you do with the second half?
- Where does `Capitalize` go — around the recursive call or around `A`?

%% hints
- Split with a template pattern: `S extends \`${infer Head}_${infer Tail}\``.
- Recurse on the tail, then `Capitalize` the result before appending.
- The non-matching branch returns `S`.

%% solution
```ts
type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
  : S;
```

%% exercise ts-paths | Dot paths of an object | 4 | ts | types |  | 25
Implement `Paths<T>`: the union of all dot-separated **paths** you can use to reach a value in `T` — including the intermediate ones.

```ts
type P = Paths<{ a: { b: { c: number } }; d: string }>;
// 'a' | 'a.b' | 'a.b.c' | 'd'
```

Arrays and functions count as leaves (no path into them).

%% starter
```ts
type Paths<T> = any;
```

%% tests
```ts
//! flat object
type _a = Expect<Equal<Paths<{ a: 1; b: 2 }>, 'a' | 'b'>>;
//! nested object includes intermediate paths
type _b = Expect<Equal<Paths<{ a: { b: { c: number } }; d: string }>, 'a' | 'a.b' | 'a.b.c' | 'd'>>;
//! arrays are leaves
type _c = Expect<Equal<Paths<{ list: string[]; n: { m: 1 } }>, 'list' | 'n' | 'n.m'>>;
//! functions are leaves
type _d = Expect<Equal<Paths<{ f: () => void }>, 'f'>>;
//! a primitive has no paths
type _e = Expect<Equal<Paths<string>, never>>;
```

%% worked
**A similar problem, solved: `TwoLevel<T>`** — "key" and "key.subkey" paths, but only two levels deep.

```ts
type TwoLevel<T> = {
  [K in keyof T & string]:
    T[K] extends object
      ? K | `${K}.${keyof T[K] & string}`     // ① this key, plus every "key.child" for its children
      : K;                                     // ② a leaf: just the key
}[keyof T & string];                            // ③ index the object by ALL its keys to get a UNION of the values
```

Trick ③ is worth memorising: build an object whose **values** are the pieces you want, then `[keyof T]` flattens them into one union. `Paths<T>` replaces the hard-coded second level with a **recursive call**: for an object child, use `K | `${K}.${Paths<T[K]>}``. Remember the exercise says **arrays and functions are leaves** — test for them *before* `extends object`, because arrays and functions are objects too.

%% explain
- **Every reachable path** as a union, including intermediate ones (`'a' | 'a.b' | 'a.b.c'`).
- **Keys are strings**, joined with `.`.
- **Arrays and functions are leaves** (no paths into them).

%% nudge
- What happens if you test `T[K] extends object` for an array or a function?
- Why does indexing the mapped object by `[keyof T]` give you a union?

%% hints
- Build a mapped type over `keyof T & string` and index it with the same key union to flatten to a union.
- For each key: `K | \`${K}.${Paths<T[K]>}\`` if the value is a plain object, else just `K`.
- Treat arrays and functions specially: `T[K] extends any[] | ((...a: any[]) => any) ? K : …`.

%% solution
```ts
type Paths<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends any[] | ((...args: any[]) => any)
        ? K
        : T[K] extends object
          ? K | `${K}.${Paths<T[K]>}`
          : K;
    }[keyof T & string]
  : never;
```

%% exercise ts-union-to-intersection | UnionToIntersection | 4 | ts | types |  | 20
Implement `UnionToIntersection<U>`: `{ a: 1 } | { b: 2 }` becomes `{ a: 1 } & { b: 2 }`.

This one is a rite of passage. It relies on two facts: a distributive conditional turns a union into a union of *functions*, and **function parameters are contravariant** — inferring a parameter from a union of functions yields the *intersection* of their parameters.

%% starter
```ts
type UnionToIntersection<U> = any;
```

%% tests
```ts
//! two object types
type _a = Expect<Equal<UnionToIntersection<{ a: 1 } | { b: 2 }>, { a: 1 } & { b: 2 }>>;
//! three members
type _b = Expect<Equal<UnionToIntersection<{ a: 1 } | { b: 2 } | { c: 3 }>, { a: 1 } & { b: 2 } & { c: 3 }>>;
//! a single member is unchanged
type _c = Expect<Equal<UnionToIntersection<{ a: 1 }>, { a: 1 }>>;
//! primitives that cannot overlap collapse to never
type _d = Expect<Equal<UnionToIntersection<string | number>, never>>;
```

%% worked
**Work up to it in three small steps** (each is a separate type you can try in the editor):

```ts
// Step 1 — a union of members becomes a union of FUNCTIONS (distribution!)
type ToFns<U> = U extends any ? (arg: U) => void : never;
type F = ToFns<{ a: 1 } | { b: 2 }>;   // ((arg: { a: 1 }) => void) | ((arg: { b: 2 }) => void)

// Step 2 — infer the PARAMETER of a function type
type ParamOf<F> = F extends (arg: infer P) => void ? P : never;
type P1 = ParamOf<(arg: string) => void>;    // string

// Step 3 — the twist: ask for the parameter of a UNION of functions.
// A single `infer P` must fit every function at once, and because parameters are contravariant
// (see the detour in the lesson) the only type that does is the INTERSECTION of the parameters.
```

Hint for assembling it: step 1 must happen **inside** a bit of type that is *not* distributive anymore when step 3 runs — wrap the result of step 1 in the conditional of step 2 *as a whole* (no bare type parameter on the left of the second `extends`).

%% explain
- **`{ a: 1 } | { b: 2 }`** becomes `{ a: 1 } & { b: 2 }`.
- **Works with any number of members**, and with primitives that intersect to `never`.
- Tests use `Equal`, so the result must be *identical* to the expected intersection.

%% nudge
- Which step turns the union into something that has a *parameter position*?
- Why must the second conditional *not* distribute over its input?

%% hints
- Step 1: `U extends any ? (arg: U) => void : never` gives `((arg: A) => void) | ((arg: B) => void)`.
- Step 2: `… extends (arg: infer I) => void ? I : never` — `I` is inferred in a **contravariant** position, so TypeScript intersects the candidates.
- Both steps need to be *one* expression; wrap step 1 in parentheses.

%% solution
```ts
type UnionToIntersection<U> = (U extends any ? (arg: U) => void : never) extends (arg: infer I) => void ? I : never;
```
