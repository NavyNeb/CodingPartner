---
id: this-prototypes
track: js
title: this, prototypes & classes
summary: How `this` is decided, what `new` really does, and why classes are prototype sugar.
---

## `this` is decided at the call site

Unlike every other variable, `this` is not looked up lexically (arrow functions excepted). It's set **when the function is called**, by the shape of the call:

| Call shape | `this` is… |
| --- | --- |
| `fn()` | `undefined` in strict mode / modules (the global object in sloppy scripts) |
| `obj.fn()` | `obj` — whatever is left of the dot |
| `fn.call(x)`, `fn.apply(x)`, `fn.bind(x)()` | `x` — explicit |
| `new Fn()` | a brand-new object |
| arrow function | whatever `this` was where the arrow was *written* |

The rule that causes most bugs: **extracting a method loses its receiver**.

```js
const user = { name: 'Ada', hi() { return `hi ${this.name}`; } };
user.hi();          // "hi Ada"
const hi = user.hi;
hi();               // TypeError / "hi undefined" — no dot, no receiver
setTimeout(user.hi, 0); // same problem: the timer calls it bare
```

Fixes, in order of preference: an arrow wrapper (`() => user.hi()`), `.bind(user)`, or define the method as an arrow class field.

## Arrow functions don't have their own `this`

They close over the surrounding `this`, like any other variable. That's why they're perfect for callbacks inside methods — and wrong for object methods and prototype methods, where you *want* the dynamic receiver.

## What `new` does

`new Fn(a, b)` performs four steps:

1. Create an empty object whose `[[Prototype]]` is `Fn.prototype`.
2. Call `Fn` with `this` set to that object.
3. If `Fn` returns an **object**, that becomes the result (a returned primitive is ignored).
4. Otherwise the new object is the result.

You'll implement it yourself below — it demystifies half of JS.

## Prototypes and the chain

Every object has an internal link to another object, its **prototype**. Reading `obj.x` checks `obj`, then `obj`'s prototype, then *its* prototype… until `null`. Writing `obj.x = 1` always creates/updates an **own** property.

```js
function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return this.name + ' makes a sound'; };

const a = new Animal('Rex');
Object.getPrototypeOf(a) === Animal.prototype; // true
a.hasOwnProperty('speak'); // false — found on the prototype
```

- `Fn.prototype` is the object that **instances** will link to. It is *not* `Fn`'s own prototype (`Object.getPrototypeOf(Fn)` is `Function.prototype`). This naming is the single most confusing thing in the language.
- `x instanceof C` means "is `C.prototype` somewhere on `x`'s chain?"
- Methods on the prototype are **shared**; properties assigned in the constructor are **per instance**.

## Classes are sugar (with a few extras)

```js
class Dog extends Animal {
  speak() { return super.speak() + ' (woof)'; }
}
```

This sets up exactly the prototype links you'd wire by hand, plus: class bodies are strict, methods are non-enumerable, calling a class without `new` throws, and `extends` links **both** the instance chain and the constructor chain (`Dog.__proto__ === Animal`). Private fields (`#x`) are the one thing prototypes can't emulate.

## Interview reflexes

- "What is `this` here?" → look at the *call*, not the definition.
- "Why does my callback lose `this`?" → it was extracted; bind it or use an arrow.
- "What's the difference between `__proto__` and `prototype`?" → the first is an object's link *up*; the second is a function's template for the links of the objects it constructs.

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
