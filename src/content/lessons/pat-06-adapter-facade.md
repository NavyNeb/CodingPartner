---
id: pat-adapter-facade
track: pat
title: Adapters, facades & repositories
summary: Keeping messy outside things at arm's length: adapters that translate one interface into another, anti-corruption layers for external data, facades that give a simple front to a complicated subsystem, and repositories that hide storage.
---

## The idea in one sentence

Put a **thin layer at the border** so the messy, foreign or complicated thing on the other side never leaks into the rest of your code.

> **Analogy** A travel plug adapter and a hotel concierge. The adapter lets your charger fit a foreign socket without changing either one. The concierge turns "I'd like a nice dinner tomorrow" into calls to a restaurant, a taxi and a calendar: you ask for one thing, they coordinate many.

Three patterns, one instinct:

- **Adapter**: *translate* an interface you don't control into the one you want.
- **Facade**: *simplify* a many-part subsystem behind one easy entry point.
- **Repository**: *hide where data lives* behind domain-shaped methods.

## Adapter: same job, different plug

Your code expects `read()` in Celsius. A vendor's sensor offers `readFahrenheit()`. Don't change your code to speak Fahrenheit everywhere: **wrap** the sensor once.

![The adapter pattern](fig:pat-adapter "Neither side changes: the adapter implements what you expect and calls what the vendor offers.")

```js try predict
const vendorSensor = { readFahrenheit: () => 98.6 };

function adaptSensor(sensor) {
  return {
    read: () => Math.round(((sensor.readFahrenheit() - 32) * 5 / 9) * 10) / 10,
  };
}

const sensor = adaptSensor(vendorSensor);
console.log(sensor.read());
```

Real adapters you already use: `promisify` (callback API → promise API), a storage wrapper that gives `localStorage` and a `Map` the same interface, and the `fetch` wrapper that turns HTTP errors into exceptions.

## Anti-corruption layer: adapt *data*

External APIs return data shaped for **their** convenience: odd names, numbers where booleans belong, comma-separated strings, missing fields. If that shape spreads through your app, every file must know the vendor's quirks.

![An anti-corruption layer](fig:pat-acl "Convert once at the border; the rest of the app sees only your own model.")

```stepper Adapting an API response
code:
  function adaptUser(raw) {
    return {
      id: Number(raw.user_id),
      fullName: `${raw.first_name} ${raw.last_name}`.trim(),
      active: raw.is_active === 1,
      roles: (raw.roles ?? '').split(',').map((r) => r.trim()).filter(Boolean),
    };
  }
---
line: 3
say: **Rename and convert the type.** The vendor sends the id as a string `"42"`; the app wants a number, under the name `id`.
raw.user_id: "42"
id: 42
---
line: 4
say: **Combine fields.** The app only needs a display name, so first and last are merged into one, and stray spaces are trimmed.
raw: first "Ada", last "Lovelace"
fullName: Ada Lovelace
---
line: 5
say: **Fix the meaning.** `is_active` is `1` or `0`, not a boolean. Compare once here, and nobody downstream ever writes `=== 1`.
raw.is_active: 1
active: true
---
line: 6
say: **Handle absence and structure.** A missing `roles` becomes an empty list; `"admin, editor"` becomes `['admin','editor']`. Downstream code can always call `.includes`.
raw.roles: "admin, editor"
roles: ['admin', 'editor']
```

An adapter is also the right place to **validate** (reject records with no id) and to **default** missing values, so the inside of the app can trust its data.

## Facade: one door into many rooms

A subsystem often needs several calls in a particular order, with cleanup if one fails: reserve stock, charge a card, schedule delivery. If every caller does that dance, each one will get it slightly wrong. A **facade** offers one simple method and keeps the choreography in one place.

![The facade pattern](fig:pat-facade "Callers ask for placeOrder; the facade knows the order of steps and how to undo them.")

A facade doesn't *hide* the subsystem (it can still be used directly when needed); it provides a **convenient default path**.

## Repository: hide where data lives

A **repository** exposes domain-level methods (`findByEmail`, `save`) and hides the storage (SQL, `localStorage`, an in-memory `Map`). Callers never learn the storage's shape, so you can swap it, or use a fake in tests. Two good habits: return **copies** (so callers can't mutate stored data by accident) and enforce **rules** such as unique emails inside the repository.

## Quick check

```check
Q: What does an adapter change?
A) The code that calls it
B) Neither side: it translates between two existing interfaces *
C) The vendor's code
D) The database
Why: The adapter implements the interface you expect and calls the interface the other side provides.
---
Q: Where should you convert an API's strange field types and names?
A) In every component that uses them
B) Once, in an adapter at the boundary *
C) In the browser console
D) In the database
Why: Converting at the border keeps vendor quirks from spreading through the app.
---
Q: What is the main job of a facade?
A) To add security
B) To give a simple entry point to a multi-step subsystem and coordinate it in one place *
C) To cache results
D) To replace the subsystem
Why: It simplifies use without necessarily hiding the parts underneath.
---
Q: Why should a repository return copies of stored objects?
A) To use more memory
B) So callers cannot accidentally change stored data by mutating what they received *
C) Because Maps require it
D) For sorting
Why: Otherwise a stray mutation silently edits the "database".
---
Q: Which is an adapter?
A) `promisify(fn)` turning a callback API into a promise API *
B) A for-loop
C) A CSS file
D) A unit test
Why: It converts one interface into another that callers prefer.
```

## Recap

- **Adapter**: translate an interface you don't control into the one your code wants.
- **Anti-corruption layer**: convert and validate external data **once**, at the boundary.
- **Facade**: one simple method that coordinates a multi-step subsystem, including cleanup on failure.
- **Repository**: domain-shaped methods over hidden storage; return copies; enforce rules.
- All of them keep **foreign details out of your core**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a sensor adapter | A unit conversion and rounding |
| A storage adapter | Feature detection; `JSON.stringify` and a safe `JSON.parse` |
| An API response adapter | Renaming, trimming, defaults, validation, de-duplication |
| A checkout facade | `async/await`, `try/catch`, undoing earlier steps |
| A user repository | A `Map` of JSON strings, copies, a uniqueness rule |
| `promisify` and `callbackify` | Node-style `(err, value)` callbacks |

%% exercise pat-guided-adapter | Guided: a sensor adapter | 1 | js | js | adaptSensor | 8 | guided
Your code expects a sensor with `read()` returning **Celsius**. A vendor sensor has `readFahrenheit()`. Implement `adaptSensor(vendor)` returning `{ read() }`, where `read()` converts the vendor's Fahrenheit to Celsius (`(f - 32) × 5 / 9`) **rounded to one decimal place**. It must read the vendor **each time** `read()` is called.

```js
adaptSensor({ readFahrenheit: () => 212 }).read(); // 100
adaptSensor({ readFahrenheit: () => 98.6 }).read(); // 37
```

%% worked
**A similar problem, solved: `adaptClock(legacy)`** — the legacy clock gives seconds; the app wants milliseconds.

```js
function adaptClock(legacy) {
  return {
    now: () => legacy.seconds() * 1000,       // ① implement the interface you want, by calling the one that exists
  };
}
```

The adapter has **no state of its own** here: every call goes straight through to the thing it wraps, with the conversion applied.

%% explain
- **Returns `{ read }`** with the interface your code expects.
- **Converts** `(f - 32) × 5 / 9`.
- **Rounds** to one decimal: `Math.round(x * 10) / 10`.
- **Reads fresh** on every call.

%% nudge
- Where does the Fahrenheit number come from on each call?
- How do you round to one decimal place?

%% starter
```js
export function adaptSensor(vendor) {
  return {
    read() {
      // Step 1 — const f = vendor.readFahrenheit();
      // Step 2 — convert to Celsius and round to 1 decimal
      return 0;
    },
  };
}
```

%% tests
```js
describe('adaptSensor', () => {
  it('converts Fahrenheit to Celsius', () => {
    expect(adaptSensor({ readFahrenheit: () => 212 }).read()).toBe(100);
    expect(adaptSensor({ readFahrenheit: () => 32 }).read()).toBe(0);
    expect(adaptSensor({ readFahrenheit: () => -40 }).read()).toBe(-40);
  });
  it('rounds to one decimal', () => {
    expect(adaptSensor({ readFahrenheit: () => 98.6 }).read()).toBe(37);
    expect(adaptSensor({ readFahrenheit: () => 70 }).read()).toBe(21.1);
    expect(adaptSensor({ readFahrenheit: () => 50.5 }).read()).toBe(10.3);
  });
  it('reads the vendor sensor on every call', () => {
    let f = 32;
    const vendor = { readFahrenheit: jest.fn(() => f) };
    const sensor = adaptSensor(vendor);
    expect(sensor.read()).toBe(0);
    f = 212;
    expect(sensor.read()).toBe(100);
    expect(vendor.readFahrenheit).toHaveBeenCalledTimes(2);
  });
  it('does not read until asked', () => {
    const vendor = { readFahrenheit: jest.fn(() => 32) };
    adaptSensor(vendor);
    expect(vendor.readFahrenheit).not.toHaveBeenCalled();
  });
});
```

%% hints
- `const f = vendor.readFahrenheit();`
- `return Math.round(((f - 32) * 5 / 9) * 10) / 10;`

%% solution
```js
export function adaptSensor(vendor) {
  return {
    read() {
      const f = vendor.readFahrenheit();
      return Math.round(((f - 32) * 5 / 9) * 10) / 10;
    },
  };
}
```

%% exercise pat-storage-adapter | A storage adapter | 2 | js | js | createStorage | 18
Implement `createStorage(backend)`, giving two different storage APIs the **same** interface.

- A **Web-Storage-like** backend has `getItem(key)` (returns a string or `null`), `setItem(key, string)`, `removeItem(key)`.
- A **Map-like** backend has `get(key)`, `set(key, value)`, `delete(key)`.
- The adapter returns `{ get, set, remove, has }`. Values are stored as **JSON strings** (so objects and arrays round-trip) in both kinds of backend.
- `get(key)` returns the parsed value, or `undefined` if the key is missing **or the stored text isn't valid JSON**.
- `set(key, value)` stores it; setting `undefined` **removes** the key.
- Any other backend throws `TypeError('unsupported storage backend')`.

```js
const s = createStorage(new Map());
s.set('user', { name: 'Ada' });
s.get('user'); // { name: 'Ada' }
```

%% worked
**A similar problem, solved: `createCounterStore(backend)`** — detect which API you were given, then wrap.

```js
function createCounterStore(backend) {
  const read = typeof backend.getItem === 'function'      // ① feature-detect, don't check types by name
    ? (k) => backend.getItem(k)
    : (k) => backend.get(k);
  const write = typeof backend.setItem === 'function'
    ? (k, v) => backend.setItem(k, v)
    : (k, v) => backend.set(k, v);
  return {
    inc(k) { write(k, String(Number(read(k) ?? 0) + 1)); },   // ② after this line, nothing cares which backend it is
    get: (k) => Number(read(k) ?? 0),
  };
}
```

Build small **read / write / delete** functions for each backend once, then write your logic against those. A `Map` returns `undefined` for missing keys while Web Storage returns `null`: treat both as "missing".

%% explain
- **Detect** the backend by its methods.
- **JSON** on the way in and out; invalid JSON reads as `undefined`.
- **`undefined` values** remove the key.
- **Unsupported backends** throw the exact `TypeError`.

%% nudge
- How do you cope with `null` from Web Storage and `undefined` from a Map in one place?
- What should reading `'{broken'` give?

%% starter
```js
export function createStorage(backend) {
  return {
    get(key) { return undefined; },
    set(key, value) {},
    remove(key) {},
    has(key) { return false; },
  };
}
```

%% tests
```js
const webStorage = () => {
  const data = new Map();
  return {
    raw: data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
};

describe.each([
  ['a Map', () => new Map()],
  ['a Web-Storage-like object', webStorage],
])('createStorage with %s', (label, make) => {
  it('round-trips JSON values', () => {
    const s = createStorage(make());
    s.set('user', { name: 'Ada', tags: ['x', 'y'] });
    s.set('n', 42);
    s.set('flag', false);
    s.set('nothing', null);
    expect(s.get('user')).toEqual({ name: 'Ada', tags: ['x', 'y'] });
    expect(s.get('n')).toBe(42);
    expect(s.get('flag')).toBe(false);
    expect(s.get('nothing')).toBeNull();
  });
  it('returns undefined for missing keys and reports has()', () => {
    const s = createStorage(make());
    expect(s.get('missing')).toBeUndefined();
    expect(s.has('missing')).toBe(false);
    s.set('k', 1);
    expect(s.has('k')).toBe(true);
  });
  it('removes keys, including by setting undefined', () => {
    const s = createStorage(make());
    s.set('a', 1); s.set('b', 2);
    s.remove('a');
    s.set('b', undefined);
    expect(s.has('a')).toBe(false);
    expect(s.has('b')).toBe(false);
  });
  it('stores JSON text in the backend', () => {
    const backend = make();
    const s = createStorage(backend);
    s.set('o', { a: 1 });
    const raw = typeof backend.getItem === 'function' ? backend.getItem('o') : backend.get('o');
    expect(raw).toBe('{"a":1}');
  });
  it('treats invalid stored JSON as missing', () => {
    const backend = make();
    if (typeof backend.setItem === 'function') backend.setItem('bad', '{broken');
    else backend.set('bad', '{broken');
    const s = createStorage(backend);
    expect(s.get('bad')).toBeUndefined();
  });
});

describe('createStorage', () => {
  it('rejects unsupported backends', () => {
    expect(() => createStorage({})).toThrow(TypeError);
    expect(() => createStorage(null)).toThrow('unsupported storage backend');
  });
});
```

%% hints
- Detect: `if (backend && typeof backend.getItem === 'function') { ... } else if (backend && typeof backend.get === 'function') { ... } else throw new TypeError(...)`.
- `get`: `const raw = read(key); if (raw === null || raw === undefined) return undefined; try { return JSON.parse(raw); } catch { return undefined; }`
- `has`: `read(key)` is neither `null` nor `undefined`.

%% solution
```js
export function createStorage(backend) {
  let read, write, erase;
  if (backend && typeof backend.getItem === 'function') {
    read = (k) => backend.getItem(k);
    write = (k, v) => backend.setItem(k, v);
    erase = (k) => backend.removeItem(k);
  } else if (backend && typeof backend.get === 'function') {
    read = (k) => backend.get(k);
    write = (k, v) => backend.set(k, v);
    erase = (k) => backend.delete(k);
  } else {
    throw new TypeError('unsupported storage backend');
  }
  const has = (key) => {
    const raw = read(key);
    return raw !== null && raw !== undefined;
  };
  return {
    get(key) {
      const raw = read(key);
      if (raw === null || raw === undefined) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    set(key, value) {
      if (value === undefined) erase(key);
      else write(key, JSON.stringify(value));
    },
    remove: erase,
    has,
  };
}
```

%% exercise pat-user-adapter | An API response adapter | 3 | js | js | adaptUser, adaptUsers | 22
An external API returns users like `{ user_id: '42', first_name: ' Ada ', last_name: 'Lovelace', email_address: ' ADA@Example.com ', created: '2024-01-05T10:00:00Z', is_active: 1, roles: 'admin, editor' }`. Convert them into your model.

`adaptUser(raw)` returns `{ id, fullName, email, createdAt, active, roles }`:

- `id` is `Number(raw.user_id)`; if `user_id` is missing, `null` or `''` throw `Error('user_id is required')`; if the number isn't a finite integer throw `Error('invalid user_id')`.
- `fullName` is the trimmed first and last names joined by one space (skip empty parts).
- `email` is trimmed and lower-cased (`''` if missing).
- `createdAt` is a `Date`, or `null` when missing or not a valid date.
- `active` is `true` for `1`, `'1'`, `true` and `'true'`, else `false`.
- `roles` is an array: a string is split on commas, trimmed, with empty parts dropped; an array is trimmed the same way; anything else gives `[]`.

`adaptUsers(list)` returns `{ users, rejected }`: adapt every item, **count** the ones that throw as `rejected`, and when two users have the same `id` the **later one replaces the earlier** (keeping the earlier position).

%% worked
**A similar problem, solved: `adaptProduct(raw)`** — rename, convert, default, and validate in one place.

```js
export function adaptProduct(raw) {
  if (raw.sku == null || raw.sku === '') throw new Error('sku is required');       // ① reject what the app can't use
  return {
    sku: String(raw.sku).trim(),
    priceCents: Math.round(Number(raw.price ?? 0) * 100),                          // ② convert units and types
    inStock: raw.stock === 'yes' || raw.stock === true,                            // ③ one place that knows the vendor's encoding
    tags: String(raw.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),  // ④ default and normalise
  };
}
```

For the list version, wrap each `adapt` in `try/catch` and use a `Map` keyed by `id`: re-setting an existing key keeps its **original position** but replaces the value.

%% explain
- **Validation** first (`user_id`), then conversions.
- **Normalise** names, emails, roles, booleans and dates.
- **List**: errors are counted, not thrown; duplicates replaced in place.

%% nudge
- How does a `Map` give you "later replaces earlier but keeps the position"?
- What does `new Date('nonsense').getTime()` return?

%% starter
```js
export function adaptUser(raw) {
  return { id: 0, fullName: '', email: '', createdAt: null, active: false, roles: [] };
}

export function adaptUsers(list) {
  return { users: [], rejected: 0 };
}
```

%% tests
```js
const raw = {
  user_id: '42', first_name: ' Ada ', last_name: 'Lovelace', email_address: ' ADA@Example.com ',
  created: '2024-01-05T10:00:00Z', is_active: 1, roles: 'admin, editor',
};

describe('adaptUser', () => {
  it('converts a full record', () => {
    const user = adaptUser(raw);
    expect(user.id).toBe(42);
    expect(user.fullName).toBe('Ada Lovelace');
    expect(user.email).toBe('ada@example.com');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.createdAt.toISOString()).toBe('2024-01-05T10:00:00.000Z');
    expect(user.active).toBe(true);
    expect(user.roles).toEqual(['admin', 'editor']);
  });
  it('builds fullName from whatever exists', () => {
    expect(adaptUser({ user_id: 1, first_name: 'Ada' }).fullName).toBe('Ada');
    expect(adaptUser({ user_id: 1, last_name: ' Lovelace ' }).fullName).toBe('Lovelace');
    expect(adaptUser({ user_id: 1 }).fullName).toBe('');
  });
  it('handles missing optional fields', () => {
    const user = adaptUser({ user_id: 7 });
    expect(user.email).toBe('');
    expect(user.createdAt).toBeNull();
    expect(user.active).toBe(false);
    expect(user.roles).toEqual([]);
  });
  it('treats an invalid date as null', () => {
    expect(adaptUser({ user_id: 1, created: 'not a date' }).createdAt).toBeNull();
  });
  it('understands the vendor boolean encodings', () => {
    for (const v of [1, '1', true, 'true']) expect(adaptUser({ user_id: 1, is_active: v }).active).toBe(true);
    for (const v of [0, '0', false, 'false', null, undefined, 'yes', 2]) expect(adaptUser({ user_id: 1, is_active: v }).active).toBe(false);
  });
  it('normalises roles from strings and arrays', () => {
    expect(adaptUser({ user_id: 1, roles: ' a ,, b,' }).roles).toEqual(['a', 'b']);
    expect(adaptUser({ user_id: 1, roles: [' a ', '', 'b'] }).roles).toEqual(['a', 'b']);
    expect(adaptUser({ user_id: 1, roles: null }).roles).toEqual([]);
    expect(adaptUser({ user_id: 1, roles: 5 }).roles).toEqual([]);
  });
  it('validates the id', () => {
    expect(() => adaptUser({})).toThrow('user_id is required');
    expect(() => adaptUser({ user_id: null })).toThrow('user_id is required');
    expect(() => adaptUser({ user_id: '' })).toThrow('user_id is required');
    expect(() => adaptUser({ user_id: 'abc' })).toThrow('invalid user_id');
    expect(() => adaptUser({ user_id: '1.5' })).toThrow('invalid user_id');
    expect(adaptUser({ user_id: 0 }).id).toBe(0);
  });
});

describe('adaptUsers', () => {
  it('adapts a list and counts rejected records', () => {
    const { users, rejected } = adaptUsers([{ user_id: 1, first_name: 'A' }, { first_name: 'no id' }, { user_id: 2, first_name: 'B' }, { user_id: 'x' }]);
    expect(users.map((u) => u.id)).toEqual([1, 2]);
    expect(rejected).toBe(2);
  });
  it('lets a later duplicate replace an earlier one in place', () => {
    const { users } = adaptUsers([
      { user_id: 1, first_name: 'Old' },
      { user_id: 2, first_name: 'Other' },
      { user_id: 1, first_name: 'New' },
    ]);
    expect(users.map((u) => [u.id, u.fullName])).toEqual([[1, 'New'], [2, 'Other']]);
  });
  it('handles an empty list', () => {
    expect(adaptUsers([])).toEqual({ users: [], rejected: 0 });
  });
});
```

%% hints
- `adaptUser`: validate `raw.user_id`, then `Number(...)` with `Number.isInteger`.
- Boolean: `[1, '1', true, 'true'].includes(raw.is_active)`.
- Date: `const d = raw.created ? new Date(raw.created) : null; createdAt = d && !Number.isNaN(d.getTime()) ? d : null`.
- `adaptUsers`: `const byId = new Map(); try { const u = adaptUser(r); byId.set(u.id, u); } catch { rejected++; }` then `[...byId.values()]`.

%% solution
```js
const splitRoles = (roles) => {
  const parts = Array.isArray(roles) ? roles : typeof roles === 'string' ? roles.split(',') : [];
  return parts.map((r) => String(r).trim()).filter(Boolean);
};

export function adaptUser(raw) {
  if (raw.user_id === undefined || raw.user_id === null || raw.user_id === '') {
    throw new Error('user_id is required');
  }
  const id = Number(raw.user_id);
  if (!Number.isInteger(id)) throw new Error('invalid user_id');
  const created = raw.created ? new Date(raw.created) : null;
  return {
    id,
    fullName: [raw.first_name, raw.last_name].map((s) => String(s ?? '').trim()).filter(Boolean).join(' '),
    email: String(raw.email_address ?? '').trim().toLowerCase(),
    createdAt: created && !Number.isNaN(created.getTime()) ? created : null,
    active: [1, '1', true, 'true'].includes(raw.is_active),
    roles: splitRoles(raw.roles),
  };
}

export function adaptUsers(list) {
  const byId = new Map();
  let rejected = 0;
  for (const raw of list) {
    try {
      const user = adaptUser(raw);
      byId.set(user.id, user);
    } catch {
      rejected++;
    }
  }
  return { users: [...byId.values()], rejected };
}
```

%% exercise pat-checkout-facade | A checkout facade | 3 | js | js | createCheckoutFacade | 26
Implement `createCheckoutFacade({ inventory, payments, shipping })` returning `{ placeOrder(order) }`. All three collaborators are **async**.

`placeOrder({ items, address, amount })`:

1. If `items` is empty throw `Error('no items')`; if `amount` isn't greater than 0 throw `RangeError('invalid amount')`. **Nothing** is called.
2. `reservation = await inventory.reserve(items)`.
3. `payment = await payments.charge(amount)`. If it **fails**: `await inventory.release(reservation)`, then rethrow the **original** error.
4. `shipment = await shipping.schedule(address, items)`. If it **fails**: `await payments.refund(payment)`, then `await inventory.release(reservation)`, then rethrow the original error.
5. Return `{ reservation, payment, shipment }`.

If an **undo step itself fails**, ignore that failure, still do the other undo step, and still rethrow the **original** error.

%% worked
**A similar problem, solved: `createBookingFacade({ rooms, billing })`** — do steps in order and undo the earlier ones when a later one fails.

```js
export function createBookingFacade({ rooms, billing }) {
  return {
    async book(guest) {
      const room = await rooms.hold(guest);                    // ① step 1: nothing to undo if this fails
      try {
        return { room, invoice: await billing.invoice(guest) };   // ② step 2
      } catch (error) {
        await rooms.release(room).catch(() => {});              // ③ undo step 1, ignoring undo failures
        throw error;                                            // ④ the caller sees the ORIGINAL problem
      }
    },
  };
}
```

The facade is the **only** place that knows the order of the steps and what to undo, so every caller gets the same, correct behaviour.

%% explain
- **Validate first**: no calls on bad input.
- **Order**: reserve → charge → schedule.
- **Compensation**: release on charge failure; refund then release on shipping failure.
- **Undo failures** are swallowed; the **original** error is rethrown.

%% nudge
- Which earlier steps need undoing when step 3 fails? And step 4?
- Why catch errors from the undo calls?

%% starter
```js
export function createCheckoutFacade({ inventory, payments, shipping }) {
  return {
    async placeOrder({ items, address, amount }) {
      // validate, reserve, charge, schedule; undo on failure
    },
  };
}
```

%% tests
```js
const make = (overrides = {}) => {
  const calls = [];
  const inventory = {
    reserve: jest.fn(async (items) => { calls.push('reserve'); return { id: 'r1' }; }),
    release: jest.fn(async () => { calls.push('release'); }),
  };
  const payments = {
    charge: jest.fn(async (amount) => { calls.push('charge'); return { id: 'p1', amount }; }),
    refund: jest.fn(async () => { calls.push('refund'); }),
  };
  const shipping = { schedule: jest.fn(async () => { calls.push('schedule'); return { id: 's1' }; }) };
  Object.assign(inventory, overrides.inventory);
  Object.assign(payments, overrides.payments);
  Object.assign(shipping, overrides.shipping);
  return { facade: createCheckoutFacade({ inventory, payments, shipping }), inventory, payments, shipping, calls };
};
const order = { items: ['apple'], address: '1 Main St', amount: 25 };

describe('createCheckoutFacade', () => {
  it('runs the steps in order and returns the results', async () => {
    const { facade, inventory, payments, shipping, calls } = make();
    const result = await facade.placeOrder(order);
    expect(calls).toEqual(['reserve', 'charge', 'schedule']);
    expect(result).toEqual({ reservation: { id: 'r1' }, payment: { id: 'p1', amount: 25 }, shipment: { id: 's1' } });
    expect(inventory.reserve).toHaveBeenCalledWith(['apple']);
    expect(payments.charge).toHaveBeenCalledWith(25);
    expect(shipping.schedule).toHaveBeenCalledWith('1 Main St', ['apple']);
  });
  it('validates before calling anything', async () => {
    const { facade, calls } = make();
    await expect(facade.placeOrder({ ...order, items: [] })).rejects.toThrow('no items');
    await expect(facade.placeOrder({ ...order, amount: 0 })).rejects.toThrow(RangeError);
    await expect(facade.placeOrder({ ...order, amount: -5 })).rejects.toThrow('invalid amount');
    expect(calls).toEqual([]);
  });
  it('stops when reserving fails, with nothing to undo', async () => {
    const { facade, calls } = make({ inventory: { reserve: jest.fn(async () => { throw new Error('out of stock'); }) } });
    await expect(facade.placeOrder(order)).rejects.toThrow('out of stock');
    expect(calls).toEqual([]);
  });
  it('releases the reservation when the charge fails', async () => {
    const { facade, inventory, calls } = make({ payments: { charge: jest.fn(async () => { throw new Error('card declined'); }) } });
    await expect(facade.placeOrder(order)).rejects.toThrow('card declined');
    expect(calls).toEqual(['reserve', 'release']);
    expect(inventory.release).toHaveBeenCalledWith({ id: 'r1' });
  });
  it('refunds then releases when scheduling fails', async () => {
    const { facade, payments, inventory, calls } = make({ shipping: { schedule: jest.fn(async () => { throw new Error('no couriers'); }) } });
    await expect(facade.placeOrder(order)).rejects.toThrow('no couriers');
    expect(calls).toEqual(['reserve', 'charge', 'refund', 'release']);
    expect(payments.refund).toHaveBeenCalledWith({ id: 'p1', amount: 25 });
    expect(inventory.release).toHaveBeenCalledWith({ id: 'r1' });
  });
  it('still rethrows the original error when an undo step fails', async () => {
    const { facade, inventory, calls } = make({
      shipping: { schedule: jest.fn(async () => { throw new Error('no couriers'); }) },
      payments: { refund: jest.fn(async () => { throw new Error('refund failed'); }) },
    });
    await expect(facade.placeOrder(order)).rejects.toThrow('no couriers');
    expect(inventory.release).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['reserve', 'charge', 'release']);
  });
});
```

%% hints
- `try { payment = await payments.charge(amount); } catch (e) { await inventory.release(reservation).catch(() => {}); throw e; }`
- For shipping failure: `await payments.refund(payment).catch(() => {}); await inventory.release(reservation).catch(() => {}); throw e;`

%% solution
```js
export function createCheckoutFacade({ inventory, payments, shipping }) {
  const quietly = (promise) => Promise.resolve(promise).catch(() => {});
  return {
    async placeOrder({ items, address, amount }) {
      if (!items || items.length === 0) throw new Error('no items');
      if (!(amount > 0)) throw new RangeError('invalid amount');

      const reservation = await inventory.reserve(items);

      let payment;
      try {
        payment = await payments.charge(amount);
      } catch (error) {
        await quietly(inventory.release(reservation));
        throw error;
      }

      let shipment;
      try {
        shipment = await shipping.schedule(address, items);
      } catch (error) {
        await quietly(payments.refund(payment));
        await quietly(inventory.release(reservation));
        throw error;
      }

      return { reservation, payment, shipment };
    },
  };
}
```

%% exercise pat-repository | A user repository | 3 | js | js | createRepository | 22
Implement `createRepository(store = new Map())`. The `store` is a `Map` from numeric id to a **JSON string** (that is how rows are kept). The repository hides that.

- `save(user)` stores the user and returns a **copy** of what was stored. A user **without an `id`** gets the next id: the largest existing id + 1 (`1` for an empty store). `email` must be a non-empty string (else `Error('email is required')`). If **another** user already has that email (compared **case-insensitively**) throw `Error('email already in use')`. Saving a user with an existing `id` replaces it.
- `findById(id)` returns a **copy** or `null`. `findByEmail(email)` is case-insensitive and returns a copy or `null`.
- `all()` returns copies sorted by `id`. `remove(id)` returns `true` if something was removed. `count()` is the number stored.
- Mutating anything the repository returned **must not** change what is stored.

```js
const repo = createRepository();
const ada = repo.save({ email: 'ada@x.com', name: 'Ada' }); // { id: 1, email: 'ada@x.com', name: 'Ada' }
```

%% worked
**A similar problem, solved: `createNoteRepo(store)`** — rows live as JSON; every read parses a fresh copy.

```js
export function createNoteRepo(store = new Map()) {
  return {
    save(note) {
      const id = note.id ?? Math.max(0, ...store.keys()) + 1;        // ① next id from what's already stored
      store.set(id, JSON.stringify({ ...note, id }));                // ② store text, not the caller's object
      return JSON.parse(store.get(id));                              // ③ return a copy, not a reference
    },
    find: (id) => (store.has(id) ? JSON.parse(store.get(id)) : null),
  };
}
```

Because the rows are **text**, copies come for free: every `JSON.parse` makes a new object, so the caller can do whatever they like with it. Check uniqueness by scanning the other rows and skipping the one with the **same id** (re-saving yourself isn't a conflict).

%% explain
- **Rows are JSON strings** in the `Map`.
- **New ids**: max + 1; explicit ids replace.
- **Uniqueness** is case-insensitive and ignores the user being saved.
- **Copies** in, copies out.

%% nudge
- Why does re-saving the same user with the same email not count as a duplicate?
- What does `Math.max(0, ...store.keys())` give for an empty store?

%% starter
```js
export function createRepository(store = new Map()) {
  return {
    save(user) { return user; },
    findById(id) { return null; },
    findByEmail(email) { return null; },
    all() { return []; },
    remove(id) { return false; },
    count() { return 0; },
  };
}
```

%% tests
```js
describe('createRepository', () => {
  it('assigns increasing ids and returns copies', () => {
    const repo = createRepository();
    const ada = repo.save({ email: 'ada@x.com', name: 'Ada' });
    const bo = repo.save({ email: 'bo@x.com', name: 'Bo' });
    expect(ada).toEqual({ id: 1, email: 'ada@x.com', name: 'Ada' });
    expect(bo.id).toBe(2);
    expect(repo.count()).toBe(2);
  });
  it('stores rows as JSON in the given store', () => {
    const store = new Map();
    const repo = createRepository(store);
    repo.save({ email: 'ada@x.com' });
    expect(typeof store.get(1)).toBe('string');
    expect(JSON.parse(store.get(1)).email).toBe('ada@x.com');
  });
  it('continues numbering after the largest existing id', () => {
    const store = new Map([[7, JSON.stringify({ id: 7, email: 'old@x.com' })]]);
    const repo = createRepository(store);
    expect(repo.save({ email: 'new@x.com' }).id).toBe(8);
  });
  it('finds by id and by email (case-insensitive)', () => {
    const repo = createRepository();
    repo.save({ email: 'Ada@X.com', name: 'Ada' });
    expect(repo.findById(1).name).toBe('Ada');
    expect(repo.findById(99)).toBeNull();
    expect(repo.findByEmail('ada@x.COM').id).toBe(1);
    expect(repo.findByEmail('nobody@x.com')).toBeNull();
  });
  it('replaces a user saved with an existing id', () => {
    const repo = createRepository();
    repo.save({ email: 'ada@x.com', name: 'Ada' });
    repo.save({ id: 1, email: 'ada@x.com', name: 'Ada L.' });
    expect(repo.count()).toBe(1);
    expect(repo.findById(1).name).toBe('Ada L.');
  });
  it('enforces unique emails case-insensitively', () => {
    const repo = createRepository();
    repo.save({ email: 'ada@x.com' });
    expect(() => repo.save({ email: 'ADA@x.com' })).toThrow('email already in use');
    expect(repo.count()).toBe(1);
  });
  it('requires an email', () => {
    const repo = createRepository();
    expect(() => repo.save({ name: 'x' })).toThrow('email is required');
    expect(() => repo.save({ email: '' })).toThrow('email is required');
    expect(() => repo.save({ email: 5 })).toThrow('email is required');
  });
  it('lists sorted by id and removes', () => {
    const repo = createRepository();
    repo.save({ id: 5, email: 'e@x.com' });
    repo.save({ id: 2, email: 'b@x.com' });
    repo.save({ id: 9, email: 'i@x.com' });
    expect(repo.all().map((u) => u.id)).toEqual([2, 5, 9]);
    expect(repo.remove(5)).toBe(true);
    expect(repo.remove(5)).toBe(false);
    expect(repo.all().map((u) => u.id)).toEqual([2, 9]);
  });
  it('never leaks references to stored data', () => {
    const repo = createRepository();
    const input = { email: 'ada@x.com', tags: ['a'] };
    const saved = repo.save(input);
    input.tags.push('mutated-input');
    saved.tags.push('mutated-saved');
    repo.findById(1).tags.push('mutated-found');
    repo.all()[0].tags.push('mutated-all');
    expect(repo.findById(1).tags).toEqual(['a']);
  });
});
```

%% hints
- `save`: validate, find a conflict with `all().find((u) => u.id !== id && u.email.toLowerCase() === email.toLowerCase())`, then `store.set(id, JSON.stringify({ ...user, id }))`.
- `all`: `[...store.values()].map(JSON.parse).sort((a, b) => a.id - b.id)`.
- `findByEmail`: compare lower-cased emails, and return a parsed copy.

%% solution
```js
export function createRepository(store = new Map()) {
  const all = () => [...store.values()].map((row) => JSON.parse(row)).sort((a, b) => a.id - b.id);
  return {
    save(user) {
      if (typeof user.email !== 'string' || user.email === '') throw new Error('email is required');
      const id = user.id ?? Math.max(0, ...store.keys()) + 1;
      const email = user.email.toLowerCase();
      if (all().some((u) => u.id !== id && String(u.email).toLowerCase() === email)) {
        throw new Error('email already in use');
      }
      store.set(id, JSON.stringify({ ...user, id }));
      return JSON.parse(store.get(id));
    },
    findById: (id) => (store.has(id) ? JSON.parse(store.get(id)) : null),
    findByEmail(email) {
      const wanted = String(email).toLowerCase();
      return all().find((u) => String(u.email).toLowerCase() === wanted) ?? null;
    },
    all,
    remove: (id) => store.delete(id),
    count: () => store.size,
  };
}
```

%% exercise pat-promisify | promisify and callbackify | 2 | js | js | promisify, callbackify | 16
Two classic adapters between **callback** style and **promise** style.

- `promisify(fn, { multi = false } = {})` returns a function that takes the same arguments **minus the final callback**, and returns a promise. It calls `fn` with the arguments plus a Node-style callback `(err, ...values)`. A truthy `err` **rejects** with it; otherwise it resolves with the first value (or, with `multi: true`, **an array of all values**). It forwards `this`. If `fn` **throws synchronously**, the promise rejects.
- `callbackify(asyncFn)` returns a function taking the arguments **plus a final callback**. It calls `asyncFn` with the arguments and then `callback(null, value)` on success or `callback(error)` on failure. It forwards `this`.

```js
const readFile = promisify(fs.readFile);
await readFile('a.txt');
```

%% worked
**A similar problem, solved: `fromEvent(emitter, name)`** — turning "call me later" into a promise.

```js
function fromEvent(emitter, name) {
  return new Promise((resolve, reject) => {
    emitter.once(name, resolve);          // ① the callback settles the promise
    emitter.once('error', reject);
  });
}
```

`promisify` follows the same plan: **create a promise, hand its `resolve`/`reject` to the old API through a callback**. `callbackify` goes the other way: run the async function and translate its promise into a callback call.

%% explain
- **`promisify`**: appends a `(err, ...values)` callback; rejects on `err`; resolves with one value or all of them.
- **Sync throws** become rejections; **`this`** is forwarded.
- **`callbackify`**: runs the async function; calls `callback(null, value)` or `callback(error)`.

%% nudge
- How do you add one extra argument to `...args` when calling `fn`?
- What should `promisify` do if `fn` throws before calling the callback?

%% starter
```js
export function promisify(fn, { multi = false } = {}) {
  return function (...args) {
    return Promise.resolve();
  };
}

export function callbackify(asyncFn) {
  return function (...args) {};
}
```

%% tests
```js
describe('promisify', () => {
  const add = (a, b, cb) => setTimeout(() => cb(null, a + b), 0);
  it('resolves with the value', async () => {
    await expect(promisify(add)(2, 3)).resolves.toBe(5);
  });
  it('rejects with the error', async () => {
    const fail = (cb) => cb(new Error('nope'));
    await expect(promisify(fail)()).rejects.toThrow('nope');
  });
  it('resolves undefined when there is no value', async () => {
    const done = (cb) => cb(null);
    await expect(promisify(done)()).resolves.toBeUndefined();
  });
  it('resolves with all values in multi mode', async () => {
    const two = (cb) => cb(null, 'a', 'b');
    await expect(promisify(two, { multi: true })()).resolves.toEqual(['a', 'b']);
    await expect(promisify(two)()).resolves.toBe('a');
  });
  it('forwards this and arguments', async () => {
    const obj = { base: 10, plus: promisify(function (n, cb) { cb(null, this.base + n); }) };
    await expect(obj.plus(5)).resolves.toBe(15);
  });
  it('turns a synchronous throw into a rejection', async () => {
    const boom = () => { throw new Error('sync'); };
    await expect(promisify(boom)()).rejects.toThrow('sync');
  });
  it('does not pass a callback argument of its own to fn when called', async () => {
    const fn = jest.fn((a, cb) => cb(null, a));
    await promisify(fn)('x');
    expect(fn.mock.calls[0].length).toBe(2);
    expect(fn.mock.calls[0][0]).toBe('x');
    expect(typeof fn.mock.calls[0][1]).toBe('function');
  });
});

describe('callbackify', () => {
  it('calls back with the value', async () => {
    const fn = callbackify(async (a, b) => a * b);
    const result = await new Promise((resolve) => fn(3, 4, (err, value) => resolve([err, value])));
    expect(result).toEqual([null, 12]);
  });
  it('calls back with the error', async () => {
    const fn = callbackify(async () => { throw new Error('bad'); });
    const result = await new Promise((resolve) => fn((err, value) => resolve([err && err.message, value])));
    expect(result).toEqual(['bad', undefined]);
  });
  it('forwards this', async () => {
    const obj = { k: 2, run: callbackify(async function (x) { return this.k * x; }) };
    const value = await new Promise((resolve) => obj.run(21, (err, v) => resolve(v)));
    expect(value).toBe(42);
  });
  it('round-trips with promisify', async () => {
    const original = async (n) => n + 1;
    await expect(promisify(callbackify(original))(1)).resolves.toBe(2);
  });
});
```

%% hints
- `promisify`: `return new Promise((resolve, reject) => { fn.call(this, ...args, (err, ...values) => { if (err) reject(err); else resolve(multi ? values : values[0]); }); });` (use a regular `function` so `this` is available, and the executor catches sync throws).
- `callbackify`: `const callback = args.pop(); asyncFn.apply(this, args).then((v) => callback(null, v), (e) => callback(e));`

%% solution
```js
export function promisify(fn, { multi = false } = {}) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, ...values) => {
        if (err) reject(err);
        else resolve(multi ? values : values[0]);
      });
    });
  };
}

export function callbackify(asyncFn) {
  return function (...args) {
    const callback = args.pop();
    asyncFn.apply(this, args).then(
      (value) => callback(null, value),
      (error) => callback(error),
    );
  };
}
```
