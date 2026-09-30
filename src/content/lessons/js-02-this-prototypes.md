---
id: this-prototypes
track: js
title: this, prototypes & classes
summary: How JavaScript decides what `this` means, what `new` really does, and why classes are just a friendlier way to write prototypes.
---

## The idea in one sentence

`this` is **not** a fixed property of a function — it is decided **each time the function is called**, by *how* you call it.

> **Analogy** `this` is like the word "here". If I say "meet me here" in Paris, it means Paris. If I say it in Tokyo, it means Tokyo. The sentence didn't change; *where it was said* did. A function that uses `this` works the same way: the code is fixed, but `this` depends on the call.

That one idea explains almost every `this` bug you'll ever meet. Then we'll look at **prototypes** (how objects share behaviour) and **classes** (a nicer way to write them).

## Part 1 — What is `this`?

Look at how the function is **called**, not where it was written:

![Call shapes and what this becomes: obj.fn() gives obj, fn() gives undefined, fn.call(x) gives x, new Fn() gives a new object, an arrow function keeps the outer this](fig:this-call-site "Read the call, not the definition. The only exception is the arrow function, which has no `this` of its own.")

The most common case is **method calls**: if there's a dot before the parentheses, whatever is *left of the dot* becomes `this`.

```js try
const user = {
  name: 'Ada',
  hi() {
    return 'hi ' + this.name;
  },
};

console.log(user.hi());
```

`user.hi()` — the thing left of the dot is `user`, so `this` is `user` and `this.name` is `'Ada'`.

### The #1 bug: losing the receiver

Watch what happens when the method is **copied into a variable** and called without a dot. Predict first:

```js try predict
'use strict'; // modules and classes are always strict, so we use it here too

const user = {
  name: 'Ada',
  hi() {
    return 'hi ' + this.name;
  },
};

const hi = user.hi;   // just copies the function; the dot is gone

try {
  console.log(hi());
} catch (error) {
  console.log('error:', error.name);
}
```

![With a dot, this is user. Copying the method out removes the dot, so this is undefined](fig:lost-receiver "The method is identical in both cases. Only the call changed, and `this` is decided by the call.")

It crashes with a `TypeError`, because `this` is `undefined` and you can't read `.name` of `undefined`. The same thing happens any time you **hand a method to someone else to call later**:

```js
setTimeout(user.hi, 100);            // ❌ the timer calls it with no dot
button.addEventListener('click', user.hi);   // ❌ (here `this` becomes the button!)
items.map(user.hi);                  // ❌
```

Three fixes, in order of preference:

```js try
const user = {
  name: 'Ada',
  hi() { return 'hi ' + this.name; },
};

// 1. Wrap it in an arrow function that still uses a dot
const a = () => user.hi();

// 2. bind: makes a copy of the function with `this` locked to user
const b = user.hi.bind(user);

// 3. call/apply: choose `this` for one call
const c = user.hi.call(user);

console.log(a(), '|', b(), '|', c);
```

### Arrow functions have no `this` of their own

An arrow function doesn't get a `this` from the call. It simply **uses the `this` of the place where it was written**, like any other variable it can see. That makes them perfect for callbacks *inside* methods:

```js try
const timer = {
  seconds: 0,
  start() {
    // the arrow function borrows `this` from start(), which is `timer`
    [1, 2, 3].forEach(() => { this.seconds += 1; });
    return this.seconds;
  },
};

console.log(timer.start());
```

…and a bad choice for the method itself (an arrow there would borrow `this` from *outside* the object, which is not the object).

## Part 2 — What `new` really does

`new Dog('Rex')` looks like magic. It is four small steps. Step through it:

```stepper What new Dog('Rex') does
code:
  function Dog(name) {
    this.name = name;
  }
  Dog.prototype.bark = function () { return this.name + ' barks'; };
  const rex = new Dog('Rex');
---
line: 4
say: Every function has a `.prototype` object. We put a shared `bark` method on `Dog.prototype`. (Nothing has been created with `new` yet.)
Dog.prototype: bark()
New object:
Prototype link:
this inside Dog:
rex:
---
line: 5
say: `new` **step 1** — create a brand-new empty object.
New object: { }
---
line: 5
say: `new` **step 2** — link that object to `Dog.prototype`. Now it can "borrow" `bark` when asked for it.
Prototype link: → Dog.prototype
---
line: 1-3
say: `new` **step 3** — call `Dog` with `this` set to the new object. `this.name = name` puts `name` on it.
this inside Dog: the new object
New object: { name: "Rex" }
---
line: 5
say: `new` **step 4** — the constructor didn't return another object, so the new object is the result and is stored in `rex`.
rex: { name: "Rex" } → Dog.prototype
```

> **Good to know** If a constructor **returns an object**, that object is used instead of the new one. Returning a number or string is ignored. You'll recreate all four steps in an exercise.

## Part 3 — Prototypes: how objects share things

Every object has a hidden link to another object called its **prototype**. When you ask an object for a property, JavaScript checks:

1. the object **itself**,
2. then its **prototype**,
3. then the prototype's prototype,
4. … until it finds it or reaches `null` (the end).

That is the **prototype chain**.

![rex links to Dog.prototype, then Animal.prototype, then Object.prototype, then null](fig:proto-chain "Lookups walk the chain from left to right. ① The object itself, ② its constructor's prototype, ③ the parent's prototype, ④ the root every object shares.")

```js try predict
function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return this.name + ' makes a sound'; };

const a = new Animal('Rex');

console.log(a.speak());
console.log(a.hasOwnProperty('speak'));
console.log(Object.getPrototypeOf(a) === Animal.prototype);
```

`speak` isn't on `a` itself. It's found one step up, on `Animal.prototype` — and because `this` is decided by the call (`a.speak()`), it still sees `a.name`. That's the magic: **methods live once on the prototype and are shared by every instance**, while data (`name`) lives on each instance.

### The naming confusion (read twice!)

| You see | It means |
| --- | --- |
| `Dog.prototype` | a *template object*: every `new Dog()` will link to it |
| `Object.getPrototypeOf(rex)` | `rex`'s actual link — for `new Dog()` objects it **is** `Dog.prototype` |
| `rex.__proto__` | an old spelling of the same link (avoid in new code) |
| `x instanceof Dog` | "is `Dog.prototype` somewhere on `x`'s chain?" |

### Writing vs reading

Reading goes **up** the chain. **Writing never does**: `rex.name = 'Max'` always creates or changes a property on `rex` itself (this is called *shadowing* if the prototype had one too).

## Part 4 — Classes are a friendlier spelling

```js try
class Animal {
  constructor(name) { this.name = name; }
  speak() { return this.name + ' makes a sound'; }
}

class Dog extends Animal {
  speak() { return super.speak() + ' (woof)'; }
}

const d = new Dog('Rex');
console.log(d.speak());
console.log(d instanceof Animal);
console.log(Object.getPrototypeOf(Dog.prototype) === Animal.prototype);
```

Under the hood it's the exact same machinery: `Dog.prototype` links to `Animal.prototype`, and `super.speak()` looks the method up on the parent's prototype. Classes add a few safety features: the body is strict, calling a class without `new` throws, methods don't show up in `for…in`, and you can have real private fields (`#secret`).

**The `this` trap still applies to classes.** If you pass `obj.method` around as a callback, it loses its receiver, just like before. A common fix in React class components was an *arrow class field*: `handleClick = () => { … }`.

## Common mistakes

1. **Extracting a method** (`const f = obj.method; f()`) — fix with an arrow wrapper or `.bind`.
2. **Using an arrow function as an object method** and expecting `this` to be the object.
3. **Putting data on the prototype** (`Dog.prototype.tricks = []`) — every dog then *shares one array*. Data goes in the constructor; methods go on the prototype.
4. **Forgetting `new`** on a constructor function (`Dog('Rex')` runs with `this` undefined or the global object).
5. **Confusing `prototype` and `__proto__`** — one is a constructor's template, the other is an object's actual link.

## Quick check

```check
Q: What is `this` inside `cart.total()`?
A) Always the global object
B) The function itself
C) `cart`, because it is to the left of the dot *
D) Whatever it was when `total` was defined
Why: For a method call, `this` is the object left of the dot. It is decided at call time, not when the function was defined.
---
Q: What is wrong here?
Code:
  const counter = { n: 0, inc() { this.n++; } };
  setTimeout(counter.inc, 100);
A) The timer calls `inc` with no dot, so `this` is not `counter` *
B) `n` cannot be changed after creation
C) `setTimeout` cannot call methods
D) Nothing; it increments `counter.n`
Why: `setTimeout` receives only the function, not the object, so it calls it bare. Use `setTimeout(() => counter.inc(), 100)` or `counter.inc.bind(counter)`.
---
Q: Which statement about arrow functions is true?
A) They get `this` from the object to their left
B) `call` and `bind` change their `this`
C) They are always slower
D) They use the `this` of the place where they were written *
Why: Arrow functions have no `this` of their own, so it is looked up like any other outer variable, and `call`/`bind` can't change it.
---
Q: `rex` was created with `new Dog('Rex')`. Where is `rex.bark` found?
A) Copied onto `rex` when it was created
B) On `Dog.prototype`, shared by all dogs *
C) On `Object.prototype`
D) On the `Dog` function itself
Why: The instance doesn't hold its own copy. Lookup walks up the chain to `Dog.prototype`, where the one shared `bark` lives.
---
Q: What does `x instanceof Dog` check?
A) Whether `x` was created with the keyword `class`
B) Whether `x` has the same properties as a dog
C) Whether `Dog.prototype` appears somewhere on `x`'s prototype chain *
D) Whether `x.constructor === Dog` and nothing else
Why: `instanceof` walks `x`'s prototype chain looking for `Dog.prototype`. Properties and the `constructor` field don't matter.
```

## Recap

- **`this` is set by the call**, not the definition: `obj.fn()` → `obj`; bare `fn()` → `undefined` (strict); `call/apply/bind` → what you choose; `new` → a fresh object.
- **Extracting a method loses `this`.** Fix with an arrow wrapper, `.bind`, or an arrow class field.
- **Arrow functions** use the `this` of where they were written; great for callbacks, wrong for methods.
- **`new`** = make an object → link it to `Ctor.prototype` → run `Ctor` with `this` = it → return it (unless an object is returned).
- **Prototype chain**: property lookup goes up the chain; writes stay on the object itself.
- **Methods on the prototype are shared; data belongs on each instance.**
- **Classes** are this machinery with nicer syntax and some safety.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: bind a method | Part 1, "losing the receiver" and the arrow-wrapper fix |
| Re-implement `call()` and `apply()` | Part 1 — `this` = the object left of the dot (so borrow a dot!) |
| Wire up inheritance by hand | Part 3 and 4 — `Dog.prototype` must link to `Animal.prototype` |
| Re-implement `bind()` | Part 1 fixes, plus "what `new` does" (bound functions can be `new`-ed) |
| Re-implement `new` | Part 2 — the four steps |
| `instanceof` by hand | Part 3 — walk the chain until you find it or hit `null` |
| `EventEmitter` | Closures (a list of listeners held by the object) + method calls and `this` |

%% exercise this-guided-method | Guided: keep this working | 1 | js | js | bindMethod | 6 | guided
Write `bindMethod(obj, name)`. It returns a **new function** that, when called, calls `obj[name](...)` *as a method of `obj`* — so `this` is always `obj`, even if the returned function is handed to a timer or an event listener.

```js
const user = { name: 'Ada', hi(greeting) { return `${greeting}, ${this.name}`; } };
const hi = bindMethod(user, 'hi');
hi('Hello');   // "Hello, Ada"  — works even though there is no dot at the call
```

Follow the numbered steps in the skeleton.

%% worked
**A similar problem, solved: `logged(obj, name)`** — returns a function that calls the method and also remembers what it returned.

```js
function logged(obj, name) {
  return function (...args) {          // ① a NEW function; ...args gathers every argument
    const result = obj[name](...args); // ② a dot call: `obj` is left of the dot, so this = obj
    console.log(name, '->', result);   // ③ extra work around the call
    return result;                     // ④ hand the result back to whoever called us
  };
}
```

The key line is ②: writing `obj[name](...)` keeps the **dot** (`obj[...]` counts), so the method gets `this = obj`. If you wrote `const fn = obj[name]; fn(...args)`, you would lose the receiver — exactly the bug from the lesson.

%% explain
- **Returns a function** that can be called on its own (no dot needed).
- **`this` stays `obj`** — the method reads `this.name` from the right object, even when called bare.
- **Arguments are forwarded** and the method's **return value** is returned.
- **The method is looked up at call time** — if `obj.hi` is replaced later, the new one is used.

%% nudge
- Which way of calling the method keeps `obj` to the left of the dot?
- How do you pass along "however many arguments I was given"?

%% starter
```js
export function bindMethod(obj, name) {
  // Step 1 — return a NEW function (it can then be passed around on its own).
  return function (...args) {
    // Step 2 — call the method WITH a dot, so `this` is obj:   obj[name](...)
    // Step 3 — pass along all the arguments (...args) and return what the method returns.
  };
}
```

%% tests
```js
describe('bindMethod', () => {
  const makeUser = () => ({ name: 'Ada', hi(greeting) { return `${greeting}, ${this.name}`; } });

  it('returns a function', () => {
    expect(typeof bindMethod(makeUser(), 'hi')).toBe('function');
  });

  it('keeps this = obj even when called with no dot', () => {
    const hi = bindMethod(makeUser(), 'hi');
    expect(hi('Hello')).toBe('Hello, Ada');
  });

  it('works when handed to something else to call', () => {
    const user = makeUser();
    const holder = { run: bindMethod(user, 'hi') };
    const { run } = holder;
    expect(run('Hey')).toBe('Hey, Ada');
  });

  it('forwards every argument', () => {
    const obj = { sum(...n) { return n.reduce((a, b) => a + b, this.base); }, base: 10 };
    expect(bindMethod(obj, 'sum')(1, 2, 3)).toBe(16);
  });

  it('looks the method up when called', () => {
    const user = makeUser();
    const hi = bindMethod(user, 'hi');
    user.hi = function () { return 'replaced ' + this.name; };
    expect(hi('x')).toBe('replaced Ada');
  });
});
```

%% hints
- `return obj[name](...args);` is the whole body.
- The dot matters: `obj[name](...)` keeps `obj` as the receiver.

%% solution
```js
export function bindMethod(obj, name) {
  return function (...args) {
    return obj[name](...args);
  };
}
```

%% exercise this-call-apply | Re-implement call() and apply() | 2 | js | js | myCall, myApply | 12
Write `myCall(fn, ctx, ...args)` and `myApply(fn, ctx, argsArray)` **without** using `Function.prototype.call`, `.apply` or `.bind`.

- `fn` runs with `this === ctx` and returns its result.
- `ctx` must not end up with any leftover properties.
- If `ctx` is `null` or `undefined`, use `globalThis`.

%% starter
```js
export function myCall(fn, ctx, ...args) {
  // your code
}

export function myApply(fn, ctx, args = []) {
  // your code
}
```

%% tests
```js
describe('myCall', () => {
  it('runs fn with this = ctx and forwards arguments', () => {
    const obj = { n: 10 };
    function add(a, b) { return this.n + a + b; }
    expect(myCall(add, obj, 1, 2)).toBe(13);
  });

  it('passes the very same object as this', () => {
    const obj = {};
    expect(myCall(function () { return this; }, obj)).toBe(obj);
  });

  it('leaves no trace on ctx', () => {
    const obj = { a: 1 };
    myCall(function () {}, obj);
    expect(Object.getOwnPropertyNames(obj)).toEqual(['a']);
    expect(Object.getOwnPropertySymbols(obj)).toHaveLength(0);
  });

  it('cleans up even when fn throws', () => {
    const obj = {};
    expect(() => myCall(function () { throw new Error('x'); }, obj)).toThrow('x');
    expect(Reflect.ownKeys(obj)).toHaveLength(0);
  });

  it('falls back to globalThis for null ctx', () => {
    expect(myCall(function () { return this; }, null)).toBe(globalThis);
  });

  it('does not rely on the native call/apply/bind', () => {
    const { call, apply, bind } = Function.prototype;
    const boom = () => { throw new Error('native call/apply/bind used'); };
    Function.prototype.call = boom;
    Function.prototype.apply = boom;
    Function.prototype.bind = boom;
    let results;
    try {
      results = [
        myCall(function (x) { return this.v + x; }, { v: 1 }, 2),
        myApply(function (x) { return this.v + x; }, { v: 1 }, [2]),
      ];
    } finally {
      Function.prototype.call = call;
      Function.prototype.apply = apply;
      Function.prototype.bind = bind;
    }
    expect(results).toEqual([3, 3]);
  });
});

describe('myApply', () => {
  it('spreads the argument array', () => {
    function join() { return this.sep + Array.from(arguments).join(this.sep); }
    expect(myApply(join, { sep: '-' }, [1, 2, 3])).toBe('-1-2-3');
  });

  it('works without an argument array', () => {
    expect(myApply(function () { return this.k; }, { k: 5 })).toBe(5);
  });
});
```

%% worked
**A similar problem, solved: `withTemp(obj, key, value, fn)`** — temporarily puts a property on an object, runs `fn`, and **always** puts things back the way they were.

```js
function withTemp(obj, key, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(obj, key);   // ① remember the original state
  const old = obj[key];
  obj[key] = value;                                             // ② change it
  try {
    return fn();                                                // ③ do the work
  } finally {
    if (had) obj[key] = old; else delete obj[key];              // ④ ALWAYS restore (even if fn throws)
  }
}
```

`myCall` uses the same trick with a twist: to run `fn` with `this = ctx`, **give `ctx` a temporary method** holding `fn` and call it *with a dot*: `ctx[tempKey](...args)`. Then `this` is `ctx`. Use a **`Symbol()`** as the key so it can't clash with real properties, and remove it in `finally`. Primitives need wrapping first (`Object(ctx)`), and `null`/`undefined` become `globalThis`.

%% explain
- **`this` is `ctx`** inside `fn`, and the return value comes back.
- **Arguments** are passed on (`myCall` takes them one by one, `myApply` as an array).
- **No leftovers**: `ctx` must have no extra properties afterwards — even if `fn` throws.
- **`null` / `undefined` context** falls back to `globalThis`.
- **No cheating**: the tests check you didn't use `call`, `apply` or `bind`.

%% nudge
- How can you make `fn` run with a dot in front of it — on an object that isn't yours?
- What guarantees the temporary property is removed even when `fn` throws?

%% hints
- Temporarily make `fn` a **method of ctx**: `ctx[key] = fn; ctx[key](...args)` — a method call sets `this` for you.
- Use a `Symbol()` as the key so you can't collide with a real property.
- `try { … } finally { delete ctx[key]; }`.
- `myApply` is `myCall` with a spread.

%% solution
```js
export function myCall(fn, ctx, ...args) {
  const target = ctx == null ? globalThis : Object(ctx);
  const key = Symbol('fn');
  target[key] = fn;
  try {
    return target[key](...args);
  } finally {
    delete target[key];
  }
}

export function myApply(fn, ctx, args = []) {
  return myCall(fn, ctx, ...args);
}
```

%% exercise this-proto-chain | Wire up inheritance by hand | 2 | js | js | Animal, Dog | 12
No `class` keyword here. `Animal` is given. Make `Dog` inherit from it the pre-ES6 way:

- `new Dog('Rex')` has its own `name` (set by the parent constructor).
- `Dog.prototype` links to `Animal.prototype`, so dogs are `instanceof Animal`.
- `Dog.prototype.constructor` points back to `Dog` and is **not enumerable**.
- Dogs override `speak()` to return `"<name> barks"`, but `Animal.prototype.speak` must be untouched.
- Dogs also get their own `fetch()` returning `"<name> fetches"`.

%% starter
```js
export function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return this.name + ' makes a sound';
};
Animal.prototype.rename = function (name) {
  this.name = name;
  return this;
};

export function Dog(name) {
  // your code
}

// your code: link Dog.prototype to Animal.prototype, then add speak() and fetch()
```

%% tests
```js
describe('Dog', () => {
  it('sets its own name via the parent constructor', () => {
    const d = new Dog('Rex');
    expect(Object.keys(d)).toEqual(['name']);
    expect(d.name).toBe('Rex');
  });

  it('is an Animal and a Dog', () => {
    const d = new Dog('Rex');
    expect(d instanceof Dog).toBe(true);
    expect(d instanceof Animal).toBe(true);
    expect(Object.getPrototypeOf(Dog.prototype)).toBe(Animal.prototype);
  });

  it('overrides speak() without touching Animal', () => {
    expect(new Dog('Rex').speak()).toBe('Rex barks');
    expect(new Animal('Tom').speak()).toBe('Tom makes a sound');
  });

  it('adds fetch() only to dogs', () => {
    expect(new Dog('Rex').fetch()).toBe('Rex fetches');
    expect(new Animal('Tom').fetch).toBeUndefined();
  });

  it('inherits rename() from Animal', () => {
    const d = new Dog('Rex');
    expect(d.rename('Max').speak()).toBe('Max barks');
    expect(Object.prototype.hasOwnProperty.call(Dog.prototype, 'rename')).toBe(false);
  });

  it('restores a non-enumerable constructor', () => {
    expect(Dog.prototype.constructor).toBe(Dog);
    const enumerable = [];
    for (const k in new Dog('x')) enumerable.push(k);
    expect(enumerable).not.toContain('constructor');
  });
});
```

%% worked
**A similar problem, solved: `Square` inherits from `Shape`.**

```js
function Shape(name) { this.name = name; }
Shape.prototype.describe = function () { return this.name + ' shape'; };

function Square(side) {
  Shape.call(this, 'square');                       // ① run the parent constructor on THIS new object
  this.side = side;
}
Square.prototype = Object.create(Shape.prototype);  // ② new prototype object that links up to Shape.prototype
Object.defineProperty(Square.prototype, 'constructor', {   // ③ restore the back-link, hidden from loops
  value: Square, writable: true, configurable: true, enumerable: false,
});
Square.prototype.area = function () { return this.side * this.side; };   // ④ child-only method

new Square(3).describe();          // "square shape"  (found on Shape.prototype)
new Square(3) instanceof Shape;    // true
```

Why ② and not `Square.prototype = Shape.prototype`? That would make both share **one** object, so adding `area` would also add it to every `Shape`. `Object.create` makes a *separate* object that merely links up.

%% explain
- **Own `name`**: the parent constructor runs on the new dog (`Animal.call(this, name)`).
- **Chain**: `Dog.prototype` links to `Animal.prototype`, so `dog instanceof Animal`.
- **`constructor` back-link**: `Dog.prototype.constructor === Dog`, and it doesn't show up in `for…in` (not enumerable).
- **Override without damage**: `Dog.prototype.speak` is different, but `Animal.prototype.speak` still works as before.
- **Dog-only `fetch()`** exists on dogs but not on plain animals.

%% nudge
- Which line gives you a *new* object that links to `Animal.prototype` without being the same object?
- After replacing `Dog.prototype`, what did you lose? (Look at `constructor`.)

%% hints
- Inside `Dog`, run the parent constructor on the new object: `Animal.call(this, name)`.
- `Dog.prototype = Object.create(Animal.prototype)` creates the link without calling `Animal`.
- Replacing `.prototype` wipes `constructor`; put it back with `Object.defineProperty(Dog.prototype, 'constructor', { value: Dog, writable: true, configurable: true })` (enumerable defaults to `false`).

%% solution
```js
export function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return this.name + ' makes a sound';
};
Animal.prototype.rename = function (name) {
  this.name = name;
  return this;
};

export function Dog(name) {
  Animal.call(this, name);
}

Dog.prototype = Object.create(Animal.prototype);
Object.defineProperty(Dog.prototype, 'constructor', { value: Dog, writable: true, configurable: true });

Dog.prototype.speak = function () {
  return this.name + ' barks';
};
Dog.prototype.fetch = function () {
  return this.name + ' fetches';
};
```

%% exercise this-bind | Re-implement bind() | 3 | js | js | myBind | 18
Write `myBind(fn, ctx, ...preset)` returning a new function that:

- calls `fn` with `this === ctx`;
- passes `preset` arguments first, then the call-time arguments;
- **ignores** a different `this` supplied later (`bound.call(other)` still uses `ctx`);
- works with `new`: `new bound(...)` must construct an instance of `fn`, *ignoring* `ctx` (this is how the real `bind` behaves).

You may use `apply` and `Reflect.construct` here.

%% starter
```js
export function myBind(fn, ctx, ...preset) {
  // your code
}
```

%% tests
```js
describe('myBind', () => {
  it('fixes this', () => {
    const obj = { n: 5 };
    const get = myBind(function () { return this.n; }, obj);
    expect(get()).toBe(5);
  });

  it('keeps this even if called with another receiver', () => {
    const a = { n: 1 }, b = { n: 2 };
    const bound = myBind(function () { return this.n; }, a);
    expect(bound.call(b)).toBe(1);
    expect({ n: 3, bound }.bound()).toBe(1);
  });

  it('prepends preset arguments', () => {
    const add = myBind(function (a, b, c) { return [this.k, a, b, c]; }, { k: 'k' }, 1, 2);
    expect(add(3)).toEqual(['k', 1, 2, 3]);
  });

  it('returns the result of fn', () => {
    expect(myBind(() => 42, null)()).toBe(42);
  });

  it('can be used as a constructor and ignores ctx then', () => {
    function Point(x, y) { this.x = x; this.y = y; }
    const Bound = myBind(Point, { ignored: true }, 1);
    const p = new Bound(2);
    expect(p).toBeInstanceOf(Point);
    expect(p.x).toBe(1);
    expect(p.y).toBe(2);
    expect(p.ignored).toBeUndefined();
  });

  it('does not share preset arrays between calls', () => {
    const f = myBind(function (...a) { return a; }, null, 'p');
    expect(f(1)).toEqual(['p', 1]);
    expect(f(2)).toEqual(['p', 2]);
  });
});
```

%% worked
**A similar problem, solved: `partial(fn, ...preset)`** — pre-fills the first arguments but leaves `this` alone.

```js
function partial(fn, ...preset) {
  return function (...later) {               // ① later arguments arrive when the result is called
    return fn.apply(this, [...preset, ...later]);   // ② preset first, then the new ones; keep the caller's `this`
  };
}

const add = (a, b, c) => a + b + c;
partial(add, 1, 2)(3);    // 6
```

`myBind` adds two things. **(1) Lock `this`**: use `ctx` instead of the caller's `this` — so `bound.call(other)` can't change it. **(2) `new` support**: inside the wrapper, `new.target` tells you whether it was called with `new`. If so, build the object with `Reflect.construct(fn, args, new.target)` and ignore `ctx`.

Note the wrapper must be a normal `function` (not an arrow) to have `new.target`.

%% explain
- **`this` is `ctx`** inside `fn`.
- **Preset arguments come first**, then call-time ones.
- **Re-binding is ignored**: `bound.call(other)` still uses `ctx`.
- **`new bound(...)`** builds an instance of the original `fn`, ignoring `ctx` (like the real `bind`).

%% nudge
- How can the wrapper tell whether it was called with `new`?
- `Reflect.construct(fn, args, newTarget)` is the tool for "construct like new does".

%% hints
- `function bound(...args) { … }` — a regular function, so `new.target` is available inside.
- When `new.target` is set: `Reflect.construct(fn, allArgs, new.target === bound ? fn : new.target)`.
- Otherwise: `fn.apply(ctx, allArgs)`.

%% solution
```js
export function myBind(fn, ctx, ...preset) {
  function bound(...args) {
    const all = [...preset, ...args];
    if (new.target) return Reflect.construct(fn, all, new.target === bound ? fn : new.target);
    return fn.apply(ctx, all);
  }
  return bound;
}
```

%% exercise this-new | Re-implement new | 3 | js | js | myNew | 15
Write `myNew(Ctor, ...args)` that behaves like `new Ctor(...args)` for constructor **functions**.

- The result's prototype is `Ctor.prototype`.
- `Ctor` runs with `this` = the new object.
- If `Ctor` returns an object (or function), return **that**. A returned primitive is ignored.
- Throw a `TypeError` if `Ctor` isn't a function.

%% starter
```js
export function myNew(Ctor, ...args) {
  // your code
}
```

%% tests
```js
describe('myNew', () => {
  it('creates an instance linked to Ctor.prototype', () => {
    function Person(name) { this.name = name; }
    Person.prototype.hi = function () { return 'hi ' + this.name; };
    const p = myNew(Person, 'Ada');
    expect(p.name).toBe('Ada');
    expect(p.hi()).toBe('hi Ada');
    expect(Object.getPrototypeOf(p)).toBe(Person.prototype);
    expect(p instanceof Person).toBe(true);
  });

  it('forwards all constructor arguments', () => {
    function Sum(a, b, c) { this.total = a + b + c; }
    expect(myNew(Sum, 1, 2, 3).total).toBe(6);
  });

  it('returns an object the constructor returns explicitly', () => {
    const other = { custom: true };
    function Weird() { this.a = 1; return other; }
    expect(myNew(Weird)).toBe(other);
  });

  it('ignores a primitive return value', () => {
    function Prim() { this.a = 1; return 42; }
    expect(myNew(Prim)).toEqual({ a: 1 });
  });

  it('handles constructors that return null', () => {
    function N() { this.a = 1; return null; }
    expect(myNew(N).a).toBe(1);
  });

  it('throws for non-functions', () => {
    expect(() => myNew({})).toThrow(TypeError);
    expect(() => myNew(undefined)).toThrow(TypeError);
  });

  it('creates a fresh object every time', () => {
    function A() {}
    expect(myNew(A)).not.toBe(myNew(A));
  });
});
```

%% worked
**A similar problem, solved: `makeWithProto(proto, init)`** — create an object that links to `proto`, then fill it in by calling `init` with `this` set to it.

```js
function makeWithProto(proto, init) {
  const obj = Object.create(proto);   // ① step 1+2 of `new`: empty object linked to a prototype
  init.call(obj);                     // ② step 3: run the setup with this = obj
  return obj;                         // ③ step 4: hand back the object
}
```

`myNew` is this plus two details. **(1)** The prototype comes from `Ctor.prototype`. **(2)** The constructor's own return value matters: if it returns an **object or function**, return *that*; otherwise return your new object. Check with `typeof result === 'object' && result !== null || typeof result === 'function'`. And first verify `Ctor` is a function, else throw a `TypeError`.

%% explain
- **Right prototype**: the result links to `Ctor.prototype`.
- **`this` inside `Ctor`** is the new object, and arguments are passed through.
- **Returning an object/function** from the constructor replaces the result; returning a number/string doesn't.
- **Non-function `Ctor`** throws a `TypeError`.

%% nudge
- Which of the four steps of `new` does `Object.create(proto)` cover?
- After calling the constructor, how do you decide which value to return?

%% hints
- `Object.create(Ctor.prototype)` does step 1.
- `Ctor.apply(obj, args)` does step 2 — keep its return value.
- `typeof r === 'object' && r !== null` or `typeof r === 'function'` means "an object".

%% solution
```js
export function myNew(Ctor, ...args) {
  if (typeof Ctor !== 'function') throw new TypeError(`${String(Ctor)} is not a constructor`);
  const obj = Object.create(Ctor.prototype);
  const result = Ctor.apply(obj, args);
  const isObject = (typeof result === 'object' && result !== null) || typeof result === 'function';
  return isObject ? result : obj;
}
```

%% exercise this-instanceof | instanceof by hand | 3 | js | js | myInstanceOf | 10
Write `myInstanceOf(value, Ctor)` — walk the prototype chain.

- Primitives (and `null`/`undefined`) are never instances.
- Returns `true` if `Ctor.prototype` appears anywhere on `value`'s chain.
- Works for arrays, class hierarchies, functions (`fn instanceof Function`).
- Objects created with `Object.create(null)` are instances of nothing.
- Throw a `TypeError` if `Ctor` isn't a function.

%% starter
```js
export function myInstanceOf(value, Ctor) {
  // your code
}
```

%% tests
```js
describe('myInstanceOf', () => {
  class A {}
  class B extends A {}

  it('follows the whole chain', () => {
    const b = new B();
    expect(myInstanceOf(b, B)).toBe(true);
    expect(myInstanceOf(b, A)).toBe(true);
    expect(myInstanceOf(b, Object)).toBe(true);
    expect(myInstanceOf(new A(), B)).toBe(false);
  });

  it('understands built-ins', () => {
    expect(myInstanceOf([], Array)).toBe(true);
    expect(myInstanceOf([], Object)).toBe(true);
    expect(myInstanceOf(() => {}, Function)).toBe(true);
    expect(myInstanceOf(new Date(), Date)).toBe(true);
    expect(myInstanceOf({}, Array)).toBe(false);
  });

  it('is false for primitives and nullish values', () => {
    expect(myInstanceOf(1, Number)).toBe(false);
    expect(myInstanceOf('s', String)).toBe(false);
    expect(myInstanceOf(null, Object)).toBe(false);
    expect(myInstanceOf(undefined, Object)).toBe(false);
    expect(myInstanceOf(true, Boolean)).toBe(false);
  });

  it('is true for boxed primitives', () => {
    expect(myInstanceOf(new Number(1), Number)).toBe(true);
  });

  it('handles prototype-less objects', () => {
    expect(myInstanceOf(Object.create(null), Object)).toBe(false);
  });

  it('respects a manually changed prototype', () => {
    const o = {};
    Object.setPrototypeOf(o, A.prototype);
    expect(myInstanceOf(o, A)).toBe(true);
  });

  it('rejects a non-callable constructor', () => {
    expect(() => myInstanceOf({}, {})).toThrow(TypeError);
  });
});
```

%% worked
**A similar problem, solved: `isAncestor(obj, ancestor)`** — is `ancestor` anywhere on `obj`'s chain?

```js
function isAncestor(obj, ancestor) {
  let current = Object.getPrototypeOf(obj);   // ① start one step UP from the object
  while (current !== null) {                  // ② the chain always ends in null
    if (current === ancestor) return true;    // ③ found it
    current = Object.getPrototypeOf(current); // ④ climb one more step
  }
  return false;                               // ⑤ fell off the end: not found
}
```

For `myInstanceOf` the thing you look for is `Ctor.prototype`. Two guards first: **primitives** (and `null`/`undefined`) are never instances — check `typeof` — and `Ctor` must be a function (`TypeError` otherwise). Functions *are* objects, so `fn instanceof Function` should work.

%% explain
- **Finds `Ctor.prototype` anywhere** on the chain (arrays, class hierarchies, functions).
- **Primitives and `null`/`undefined`** are never instances.
- **`Object.create(null)` objects** have no chain, so they are instances of nothing.
- **Non-function `Ctor`** throws a `TypeError`.

%% nudge
- What value marks the end of every prototype chain?
- Which objects are allowed to be instances at all? (Think `typeof`.)

%% hints
- `Object.getPrototypeOf(x)` steps up one link; stop when you reach `null`.
- Compare each link against `Ctor.prototype` with `===`.
- Check the primitive case first: `typeof v` is `'object'` or `'function'` (and not `null`) for real objects.

%% solution
```js
export function myInstanceOf(value, Ctor) {
  if (typeof Ctor !== 'function') throw new TypeError('Right-hand side of instanceof is not callable');
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  const target = Ctor.prototype;
  let proto = Object.getPrototypeOf(value);
  while (proto !== null) {
    if (proto === target) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

%% exercise this-emitter | EventEmitter | 3 | js | js | EventEmitter | 20
Build a Node-style `EventEmitter` **class**.

- `on(event, fn)` registers a listener and returns `this` (chainable).
- `off(event, fn)` removes it (a no-op if it isn't registered) and returns `this`.
- `once(event, fn)` registers a listener that runs at most once. `off(event, fn)` with the **original** `fn` must also cancel it.
- `emit(event, ...args)` calls listeners **in registration order** with `this` bound to the emitter. Returns `true` if there were listeners, else `false`.
- `listenerCount(event)`.
- Adding/removing listeners *during* an `emit` must not skip or double-call others.

%% starter
```js
export class EventEmitter {
  // your code
}
```

%% tests
```js
describe('EventEmitter', () => {
  it('calls listeners with the emitted arguments', () => {
    const e = new EventEmitter();
    const fn = jest.fn();
    e.on('x', fn);
    e.emit('x', 1, 'two');
    expect(fn).toHaveBeenCalledWith(1, 'two');
  });

  it('calls listeners in registration order and returns a boolean', () => {
    const e = new EventEmitter();
    const order = [];
    e.on('x', () => order.push(1)).on('x', () => order.push(2));
    expect(e.emit('x')).toBe(true);
    expect(e.emit('nothing')).toBe(false);
    expect(order).toEqual([1, 2]);
  });

  it('binds this to the emitter', () => {
    const e = new EventEmitter();
    let self;
    e.on('x', function () { self = this; });
    e.emit('x');
    expect(self).toBe(e);
  });

  it('off removes a specific listener only', () => {
    const e = new EventEmitter();
    const a = jest.fn(), b = jest.fn();
    e.on('x', a).on('x', b);
    e.off('x', a);
    e.emit('x');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    expect(e.off('x', a)).toBe(e);
  });

  it('once fires a single time', () => {
    const e = new EventEmitter();
    const fn = jest.fn();
    e.once('x', fn);
    e.emit('x', 1);
    e.emit('x', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
    expect(e.listenerCount('x')).toBe(0);
  });

  it('off can cancel a once listener using the original function', () => {
    const e = new EventEmitter();
    const fn = jest.fn();
    e.once('x', fn);
    e.off('x', fn);
    e.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('counts listeners per event', () => {
    const e = new EventEmitter();
    e.on('a', () => {}).on('a', () => {}).on('b', () => {});
    expect(e.listenerCount('a')).toBe(2);
    expect(e.listenerCount('b')).toBe(1);
    expect(e.listenerCount('c')).toBe(0);
  });

  it('is safe to unsubscribe during emit', () => {
    const e = new EventEmitter();
    const second = jest.fn();
    const first = () => e.off('x', first);
    e.on('x', first);
    e.on('x', second);
    e.emit('x');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not call listeners added during the same emit', () => {
    const e = new EventEmitter();
    const late = jest.fn();
    e.on('x', () => e.on('x', late));
    e.emit('x');
    expect(late).not.toHaveBeenCalled();
    e.emit('x');
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('keeps separate emitters separate', () => {
    const a = new EventEmitter(), b = new EventEmitter();
    const fn = jest.fn();
    a.on('x', fn);
    b.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: a minimal `Bus` with `on` and `emit`.**

```js
class Bus {
  constructor() {
    this.listeners = new Map();                 // ① event name → array of functions
  }
  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
    return this;                                // ② returning `this` makes calls chainable: bus.on().on()
  }
  emit(event, ...args) {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) fn.apply(this, args);   // ③ loop over a COPY, call with this = the bus
    return true;
  }
}
```

The exercise adds `off`, `once` and `listenerCount`. Two ideas to plan for: **(a) `once`**: wrap the listener in a function that removes itself, and remember the original (`wrapper.original = fn`) so `off(event, fn)` can still find it. **(b) looping over a copy** (③) is what stops listeners that add/remove listeners during `emit` from causing skips or double-calls.

%% explain
- **`on` / `off` / `once`** return `this` (chainable); `off` on something unregistered does nothing.
- **`once`** runs at most once, and `off(event, originalFn)` cancels it before it fires.
- **`emit`** calls listeners in registration order with `this` = the emitter, and returns `true`/`false` for "were there listeners?".
- **`listenerCount(event)`** counts current listeners.
- **Safe during emit**: adding/removing listeners while emitting never skips or double-calls others.

%% nudge
- What should a `once` wrapper do before calling the real listener?
- If a listener removes itself while you're looping over the array, what happens to the next item?

%% hints
- A `Map` from event name to an array of listener functions.
- For `once`, wrap: `const wrapper = (...a) => { this.off(event, wrapper); fn.apply(this, a); }` and remember the original with `wrapper.original = fn`. Make `off` match either the function or its `.original`.
- In `emit`, iterate over a **copy**: `[...listeners].forEach(...)`.

%% solution
```js
export class EventEmitter {
  #events = new Map();

  on(event, fn) {
    if (!this.#events.has(event)) this.#events.set(event, []);
    this.#events.get(event).push(fn);
    return this;
  }

  once(event, fn) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      return fn.apply(this, args);
    };
    wrapper.original = fn;
    return this.on(event, wrapper);
  }

  off(event, fn) {
    const list = this.#events.get(event);
    if (!list) return this;
    const i = list.findIndex((l) => l === fn || l.original === fn);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this.#events.delete(event);
    return this;
  }

  emit(event, ...args) {
    const list = this.#events.get(event);
    if (!list || !list.length) return false;
    [...list].forEach((l) => l.apply(this, args));
    return true;
  }

  listenerCount(event) {
    return this.#events.get(event)?.length ?? 0;
  }
}
```
