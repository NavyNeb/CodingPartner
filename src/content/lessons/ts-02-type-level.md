---
id: ts-type-level
track: ts
title: Mapped, conditional & template-literal types
summary: Transform types the way you transform data — recursion, key remapping and string manipulation at compile time.
---

Once you can read `T extends U ? X : Y` and `{ [K in keyof T]: … }` fluently, most "advanced" TypeScript is composition of four ideas.

## 1. Mapped types

```ts
type Optional<T> = { [K in keyof T]?: T[K] };
type Mutable<T> = { -readonly [K in keyof T]-?: T[K] }; // `-` removes a modifier
```

When the source is `keyof T` for a *type parameter* `T`, the mapping is **homomorphic**: it preserves optionality, `readonly`, and — importantly — maps **tuples to tuples** and arrays to arrays.

## 2. Key remapping with `as`

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
// { name: string } → { getName: () => string }
```

Remap to `never` to **drop** a key: `[K in keyof T as K extends 'id' ? never : K]`.

## 3. Recursion

Types can call themselves. This is how `DeepPartial`, `DeepReadonly`, path types and string parsers work:

```ts
type Flatten<T> = T extends readonly (infer U)[] ? Flatten<U> : T;
type X = Flatten<number[][][]>; // number
```

Watch for the recursion-depth limit (~50 instantiations for non-tail recursion, ~1000 for tail-recursive conditional types) — prefer accumulators for long strings.

## 4. Template literal types

```ts
type Route = `/users/${number}` | `/posts/${string}`;
type Head<S> = S extends `${infer H}/${string}` ? H : S;
type Camel<S extends string> =
  S extends `${infer A}_${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S;
```

Combined with `infer`, template literals let the compiler *parse* strings: route params, CSS units, event names (`on${Capitalize<E>}`), i18n keys.

## Reading strategy for type puzzles

1. Write the **expected** result for 2–3 inputs first (that's what the tests are).
2. Solve the base case, then the recursive case.
3. If a result is a union you didn't want, ask *"is this conditional distributing?"*
4. If it's `unknown`/`{}` when you expected an error, check for a missing constraint.
5. Hover in your head: what would `Equal` see? `{a:1} & {b:2}` and `{a:1; b:2}` are **not** identical to it, even though they're mutually assignable.

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

%% hints
- Step 1: `U extends any ? (arg: U) => void : never` gives `((arg: A) => void) | ((arg: B) => void)`.
- Step 2: `… extends (arg: infer I) => void ? I : never` — `I` is inferred in a **contravariant** position, so TypeScript intersects the candidates.
- Both steps need to be *one* expression; wrap step 1 in parentheses.

%% solution
```ts
type UnionToIntersection<U> = (U extends any ? (arg: U) => void : never) extends (arg: infer I) => void ? I : never;
```
