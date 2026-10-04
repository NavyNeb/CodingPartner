---
id: node-data-access
track: node
title: Data access: repositories, transactions and batching
summary: Hide storage behind a repository, make multi-step writes atomic with transactions and savepoints, kill the N+1 query with a batch loader, prevent lost updates with optimistic locking, and apply schema changes with migrations.
---

## The idea in one sentence

Business code should ask for **what** it needs ("the user with this id"), and a **data layer** decides **how** to get it, safely, in as **few round trips** as possible, without losing anyone's writes.

> **Analogy** A library. You ask the librarian (the repository) for a book by title; you never walk the stacks yourself. If you need ten books, a good librarian fetches them in one trip, not ten. And two people editing the same manuscript need a rule for who wins, or one of them silently loses their work.

*(In NestJS this is a provider wrapping TypeORM, Prisma or Mongoose, `@Transaction`-style helpers, DataLoader for GraphQL and migration files. You will build the logic against an in-memory fake, so no database is needed.)*

## Repository

A **repository** is a small object with intention-revealing methods (`findById`, `create`, `update`, `remove`). Callers never see SQL, collections or connection details, so you can **swap the storage** or **fake it in tests**. One rule matters a lot: return **copies**. If you hand out the stored object itself, any caller can silently change your data.

## N+1 and batching

![The N+1 problem](fig:nd-nplus1 "Ten posts and one query per author is eleven round trips; batching makes it two.")

Loading a list and then fetching one related row **per item** is the **N+1 problem**: 1 query for the list plus N more. The fix is **batching**: collect every key requested **in the same tick**, remove duplicates, ask the database **once**, and hand each caller its own answer.

```js try predict
let queries = 0;
const users = new Map([[1, 'Ada'], [2, 'Bob'], [3, 'Cy']]);
const findUser = async (id) => { queries++; return users.get(id); };
const findUsers = async (ids) => { queries++; return ids.map((id) => users.get(id)); };

(async () => {
  const posts = [{ author: 1 }, { author: 2 }, { author: 1 }, { author: 3 }];
  await Promise.all(posts.map((post) => findUser(post.author)));
  const naive = queries;
  queries = 0;
  await findUsers([...new Set(posts.map((post) => post.author))]);
  console.log('naive', naive, 'batched', queries);
})();
```

## Transactions

![Transactions and savepoints](fig:nd-transaction "All of it commits, or none of it does; savepoints scope a nested failure.")

A **transaction** makes several writes **atomic**: they all happen or none do. The pattern is always the same: `begin`, run the work, `commit` on success, `rollback` on any error, and **rethrow** the original error. Two details separate good code from bad:

- If the rollback itself fails, the **original** error must still reach the caller.
- A transaction started **inside** another one should not begin a new one; it uses a **savepoint** so only the inner work is undone when it fails.

```stepper A transfer with a nested step
code:
  transaction(async (db) => {
    debit(A); credit(B);
    try { await transaction(logEmail); }   // nested
    catch {}                               // outer carries on
  })
---
line: 1
say: The runner calls `begin`. From here on, everything is part of **one atomic unit**.
phase: begin
---
line: 2
say: Two writes happen **inside** the transaction. Nobody else can see them yet.
phase: work
---
line: 3
say: A transaction inside a transaction becomes a **savepoint** (`sp1`), not a second `begin`.
phase: savepoint
---
line: 3
say: Suppose `logEmail` throws. The runner executes `rollbackTo sp1`: **only the inner work** is undone, and the error is rethrown to the caller.
phase: partial rollback
---
line: 4
say: The outer code **catches** it and carries on, so the outer transaction is still alive.
phase: recovered
---
line: 5
say: The outer work finishes and the runner calls `commit`: debit and credit become permanent together.
phase: commit
```

## Optimistic locking

![Optimistic locking](fig:nd-optimistic "A version number turns a silent overwrite into a detectable conflict.")

Two users edit the same record. With **last write wins**, one silently erases the other. With **optimistic locking** each row carries a **version**; an update says "apply this **if the version is still N**" and bumps it. If someone got there first, the update **matches nothing** and you get a **conflict**: reload, reapply, retry. No locks are held while a human thinks.

## Migrations

A **migration** is a numbered, versioned change to the schema with an **up** (apply) and a **down** (undo). A migrator remembers which have run, applies the pending ones **in order**, **stops at the first failure** (recording only what really succeeded), and can **roll back** the most recent ones. Schema changes live in **code review**, not in someone's terminal history.

## Quick check

```check
Q: What is the N+1 problem?
A) A query that returns N+1 rows
B) One query for a list, then one more query per item *
C) A database with too many tables
D) An index that is missing
Why: The extra per-item queries are what make it slow.
---
Q: A rollback throws while handling a failed transaction. Which error should the caller see?
A) The rollback error
B) The original error that caused the rollback *
C) Both, merged
D) None
Why: The original failure is the real diagnosis.
---
Q: What does a nested transaction use instead of a second BEGIN?
A) A new connection
B) A savepoint *
C) A lock
D) A migration
Why: Savepoints let an inner failure undo only the inner work.
---
Q: Why return copies from a repository?
A) Copies are faster
B) Callers cannot silently change stored data by mutating what they received *
C) JSON requires it
D) To save memory
Why: Shared references make the store depend on every caller's behavior.
```

## Recap

- A **repository** hides storage behind intention-revealing methods and returns **copies**.
- **N+1** = one query per item; **batch** same-tick keys, **dedupe**, query once, **cache** per loader.
- **Transactions** are atomic: `begin`, `commit`, `rollback`, **rethrow the original error**; nest with **savepoints**.
- **Optimistic locking**: a **version** column; a stale version means a **conflict**, then reload and retry.
- **Migrations**: ordered, reversible, stop at the first failure, record only what succeeded.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a repository | A `Map`, an id counter, copying with spread |
| Transaction runner | `try/catch` around `await`, a depth counter, savepoint names |
| Batch loader | A queue flushed on a microtask, a per-key promise cache |
| Optimistic locking | A version check, error classes, a retry loop |
| Migrations | Sorting, sequential `await`, recording only what succeeded |
| Tests for a batch loader | Counting calls, `Promise.allSettled`, chunk sizes |

%% exercise nod-guided-repo | Guided: a repository | 2 | js | js | createRepository | 10 | guided
`createRepository(store = new Map())` wraps a `Map` of rows and returns:

- `create(data)` assigns the next id (`1`, `2`, …), stores `{ ...data, id }` and returns a **copy** of it.
- `findById(id)` returns a **copy** of the row, or `null`.
- `list()` returns **copies** of all rows in insertion order.
- `update(id, patch)` merges `patch` into the row (the `id` can never change) and returns a **copy**, or `null` when the row does not exist.
- `remove(id)` returns `true` if a row was deleted, else `false`.

Nothing the caller does to a returned object or to the `data` it passed in may affect what is stored.

```js
const repo = createRepository();
repo.create({ name: 'Ada' });   // { name: 'Ada', id: 1 }
repo.findById(1);               // { name: 'Ada', id: 1 }
```

%% worked
**A similar problem, solved: `createShelf()`** — store copies in, hand copies out.

```js
function createShelf() {
  const items = new Map();
  let next = 1;
  return {
    add(data) {
      const item = { ...data, id: next++ };      // ① a NEW object: later changes to `data` can't reach it
      items.set(item.id, item);
      return { ...item };                         // ② hand out a copy, never the stored object
    },
    get(id) {
      const item = items.get(id);
      return item ? { ...item } : null;           // ③ copy again on the way out; null for a miss
    },
  };
}
```

Spreading creates a **shallow copy**, which is plenty for flat rows. Copying on the way **in and out** is what makes the storage private.

%% explain
- **Counter** for ids, **Map** for rows.
- **Spread** on the way in and out.
- **`id` last** in the merge on update, so a patch can't override it.

%% nudge
- Why must `update` put `id` after the patch when merging?
- Which methods must copy?

%% starter
```js
export function createRepository(store = new Map()) {
  let next = 1;
  return {
    create(data) {},
    findById(id) {},
    list() {},
    update(id, patch) {},
    remove(id) {},
  };
}
```

%% tests
```js
describe('createRepository', () => {
  it('creates rows with incrementing ids', () => {
    const repo = createRepository();
    expect(repo.create({ name: 'Ada' })).toEqual({ name: 'Ada', id: 1 });
    expect(repo.create({ name: 'Bob' })).toEqual({ name: 'Bob', id: 2 });
  });
  it('finds a row or returns null', () => {
    const repo = createRepository();
    repo.create({ name: 'Ada' });
    expect(repo.findById(1)).toEqual({ name: 'Ada', id: 1 });
    expect(repo.findById(99)).toBeNull();
  });
  it('lists rows in insertion order', () => {
    const repo = createRepository();
    repo.create({ n: 'a' });
    repo.create({ n: 'b' });
    expect(repo.list().map((r) => r.n)).toEqual(['a', 'b']);
    expect(createRepository().list()).toEqual([]);
  });
  it('updates by merging and never changes the id', () => {
    const repo = createRepository();
    repo.create({ name: 'Ada', role: 'user' });
    expect(repo.update(1, { role: 'admin', id: 99 })).toEqual({ name: 'Ada', role: 'admin', id: 1 });
    expect(repo.findById(1)).toEqual({ name: 'Ada', role: 'admin', id: 1 });
    expect(repo.update(5, { role: 'x' })).toBeNull();
  });
  it('removes rows', () => {
    const repo = createRepository();
    repo.create({ name: 'Ada' });
    expect(repo.remove(1)).toBe(true);
    expect(repo.remove(1)).toBe(false);
    expect(repo.findById(1)).toBeNull();
  });
  it('does not reuse ids after a removal', () => {
    const repo = createRepository();
    repo.create({});
    repo.remove(1);
    expect(repo.create({}).id).toBe(2);
  });
  it('keeps the store private: copies in and out', () => {
    const repo = createRepository();
    const data = { name: 'Ada' };
    const created = repo.create(data);
    data.name = 'Changed';
    created.name = 'Changed too';
    repo.findById(1).name = 'Nope';
    repo.list()[0].name = 'Nope';
    expect(repo.findById(1).name).toBe('Ada');
  });
  it('uses the store it is given', () => {
    const store = new Map();
    const repo = createRepository(store);
    repo.create({ name: 'Ada' });
    expect(store.size).toBe(1);
    expect(store.get(1)).toEqual({ name: 'Ada', id: 1 });
  });
});
```

%% hints
- `const row = { ...data, id: next++ }; store.set(row.id, row); return { ...row };`
- `update`: `const next = { ...row, ...patch, id }; store.set(id, next); return { ...next };`
- `list`: `[...store.values()].map((row) => ({ ...row }))`.

%% solution
```js
export function createRepository(store = new Map()) {
  let next = 1;
  return {
    create(data) {
      const row = { ...data, id: next++ };
      store.set(row.id, row);
      return { ...row };
    },
    findById(id) {
      const row = store.get(id);
      return row ? { ...row } : null;
    },
    list() {
      return [...store.values()].map((row) => ({ ...row }));
    },
    update(id, patch) {
      const row = store.get(id);
      if (!row) return null;
      const merged = { ...row, ...patch, id };
      store.set(id, merged);
      return { ...merged };
    },
    remove(id) {
      return store.delete(id);
    },
  };
}
```

%% exercise nod-transaction | A transaction runner with savepoints | 4 | js | js | createTransactionRunner | 42
`createTransactionRunner(db)` where `db` has async `begin()`, `commit()`, `rollback()`, `savepoint(name)`, `rollbackTo(name)` and `release(name)`. It returns `{ transaction(work), inTransaction() }` (calls do not interleave).

`transaction(work)` runs `await work(db)` and returns its result:

- **Outermost call**: `begin`, then the work, then `commit`. If the work throws, call `rollback` and **rethrow the original error**, even if `rollback` itself throws. If `commit` throws, call `rollback` (ignoring its errors) and rethrow the **commit** error.
- **Nested call** (while a transaction is open): no `begin`. It calls `savepoint(name)` with names `sp1`, `sp2`, … numbered per runner in order of creation; on success `release(name)`; if the work throws, `rollbackTo(name)` (ignoring its errors) and **rethrow**. The outer transaction stays open and may continue or commit.
- `inTransaction()` is `true` only while a transaction is open (and `false` again after a commit or a rollback, so the runner can be reused).

```js
const runner = createTransactionRunner(db);
await runner.transaction(async () => {
  await runner.transaction(async () => {});   // begin, savepoint sp1, release sp1, commit
});
```

%% worked
**A similar problem, solved: `withLock(lock, work)`** — acquire, run, release in a `finally`-like shape that never hides the real error.

```js
async function withLock(lock, work) {
  await lock.acquire();
  let result;
  try {
    result = await work();
  } catch (error) {
    try { await lock.release(); } catch { /* ① a failing release must not replace the real error */ }
    throw error;                                             // ② rethrow the ORIGINAL failure
  }
  await lock.release();                                      // ③ success path: a release failure IS the story here
  return result;
}
```

The transaction runner is this shape twice: once at the top level (`begin`/`commit`/`rollback`) and once for nested calls (`savepoint`/`release`/`rollbackTo`). A **depth counter** tells you which one applies.

%% explain
- **Depth counter** picks top-level vs nested.
- **Swallow** errors from the *cleanup* call (`rollback`, `rollbackTo`), never from the work.
- **Reset depth** on every exit path so the runner stays usable.

%% nudge
- What does `inTransaction()` return after a failed top-level transaction?
- Why must the original error survive a failing rollback?

%% starter
```js
export function createTransactionRunner(db) {
  let depth = 0;
  return {
    inTransaction() {
      return depth > 0;
    },
    async transaction(work) {
      return work(db);
    },
  };
}
```

%% tests
```js
const makeDb = ({ failCommit = false, failRollback = false } = {}) => {
  const log = [];
  return {
    log,
    async begin() { log.push('begin'); },
    async commit() { log.push('commit'); if (failCommit) throw new Error('commit failed'); },
    async rollback() { log.push('rollback'); if (failRollback) throw new Error('rollback failed'); },
    async savepoint(name) { log.push('savepoint ' + name); },
    async rollbackTo(name) { log.push('rollbackTo ' + name); },
    async release(name) { log.push('release ' + name); },
  };
};

describe('createTransactionRunner', () => {
  it('begins, runs the work with the db and commits', async () => {
    const db = makeDb();
    const runner = createTransactionRunner(db);
    let received;
    const result = await runner.transaction(async (d) => { received = d; db.log.push('work'); return 42; });
    expect(result).toBe(42);
    expect(received).toBe(db);
    expect(db.log).toEqual(['begin', 'work', 'commit']);
  });
  it('rolls back and rethrows when the work fails', async () => {
    const db = makeDb();
    const runner = createTransactionRunner(db);
    const boom = new Error('boom');
    await expect(runner.transaction(async () => { throw boom; })).rejects.toBe(boom);
    expect(db.log).toEqual(['begin', 'rollback']);
  });
  it('rethrows the original error even when rollback fails', async () => {
    const db = makeDb({ failRollback: true });
    const runner = createTransactionRunner(db);
    await expect(runner.transaction(async () => { throw new Error('original'); })).rejects.toThrow('original');
  });
  it('rolls back and rethrows when commit fails', async () => {
    const db = makeDb({ failCommit: true });
    const runner = createTransactionRunner(db);
    await expect(runner.transaction(async () => 1)).rejects.toThrow('commit failed');
    expect(db.log).toEqual(['begin', 'commit', 'rollback']);
  });
  it('still reports the commit error when that rollback fails too', async () => {
    const db = makeDb({ failCommit: true, failRollback: true });
    const runner = createTransactionRunner(db);
    await expect(runner.transaction(async () => 1)).rejects.toThrow('commit failed');
  });
  it('uses a savepoint for a nested call', async () => {
    const db = makeDb();
    const runner = createTransactionRunner(db);
    const result = await runner.transaction(async () => runner.transaction(async () => 'inner'));
    expect(result).toBe('inner');
    expect(db.log).toEqual(['begin', 'savepoint sp1', 'release sp1', 'commit']);
  });
  it('numbers savepoints per runner, in creation order, and nests them', async () => {
    const db = makeDb();
    const runner = createTransactionRunner(db);
    await runner.transaction(async () => {
      await runner.transaction(async () => {
        await runner.transaction(async () => {});
      });
      await runner.transaction(async () => {});
    });
    expect(db.log).toEqual([
      'begin', 'savepoint sp1', 'savepoint sp2', 'release sp2', 'release sp1', 'savepoint sp3', 'release sp3', 'commit',
    ]);
  });
  it('rolls back only to the savepoint when the outer work recovers', async () => {
    const db = makeDb();
    const runner = createTransactionRunner(db);
    const result = await runner.transaction(async () => {
      try { await runner.transaction(async () => { throw new Error('inner'); }); } catch {}
      return 'outer ok';
    });
    expect(result).toBe('outer ok');
    expect(db.log).toEqual(['begin', 'savepoint sp1', 'rollbackTo sp1', 'commit']);
  });
  it('rolls back everything when the inner error propagates', async () => {
    const db = makeDb();
    const runner = createTransactionRunner(db);
    await expect(runner.transaction(async () => runner.transaction(async () => { throw new Error('deep'); }))).rejects.toThrow('deep');
    expect(db.log).toEqual(['begin', 'savepoint sp1', 'rollbackTo sp1', 'rollback']);
  });
  it('rethrows the original error when rollbackTo fails', async () => {
    const db = makeDb();
    db.rollbackTo = async () => { throw new Error('rollbackTo failed'); };
    const runner = createTransactionRunner(db);
    const result = await runner.transaction(async () => {
      try { await runner.transaction(async () => { throw new Error('inner'); }); } catch (e) { return e.message; }
    });
    expect(result).toBe('inner');
  });
  it('tracks whether a transaction is open', async () => {
    const db = makeDb();
    const runner = createTransactionRunner(db);
    expect(runner.inTransaction()).toBe(false);
    await runner.transaction(async () => {
      expect(runner.inTransaction()).toBe(true);
      await runner.transaction(async () => expect(runner.inTransaction()).toBe(true));
      expect(runner.inTransaction()).toBe(true);
    });
    expect(runner.inTransaction()).toBe(false);
  });
  it('can be reused after a failure', async () => {
    const db = makeDb();
    const runner = createTransactionRunner(db);
    await runner.transaction(async () => { throw new Error('first'); }).catch(() => {});
    expect(runner.inTransaction()).toBe(false);
    db.log.length = 0;
    await runner.transaction(async () => {});
    expect(db.log).toEqual(['begin', 'commit']);
  });
  it('resets after a failed commit too', async () => {
    const db = makeDb({ failCommit: true });
    const runner = createTransactionRunner(db);
    await runner.transaction(async () => {}).catch(() => {});
    expect(runner.inTransaction()).toBe(false);
  });
});
```

%% hints
- Top level: `await db.begin(); depth = 1; try { result = await work(db) } catch (e) { depth = 0; try { await db.rollback() } catch {} throw e }`.
- Then `depth = 0` and `try { await db.commit() } catch (e) { try { await db.rollback() } catch {} throw e }`.
- Nested: `const name = 'sp' + ++savepoints; await db.savepoint(name); depth++; ...` with `depth--` on both exits.

%% solution
```js
export function createTransactionRunner(db) {
  let depth = 0;
  let savepoints = 0;

  return {
    inTransaction() {
      return depth > 0;
    },
    async transaction(work) {
      if (depth === 0) {
        await db.begin();
        depth = 1;
        let result;
        try {
          result = await work(db);
        } catch (error) {
          depth = 0;
          try { await db.rollback(); } catch {}
          throw error;
        }
        depth = 0;
        try {
          await db.commit();
        } catch (error) {
          try { await db.rollback(); } catch {}
          throw error;
        }
        return result;
      }

      const name = 'sp' + ++savepoints;
      await db.savepoint(name);
      depth++;
      let result;
      try {
        result = await work(db);
      } catch (error) {
        depth--;
        try { await db.rollbackTo(name); } catch {}
        throw error;
      }
      depth--;
      await db.release(name);
      return result;
    },
  };
}
```

%% exercise nod-batch-loader | A batch loader (DataLoader) | 4 | js | js | createBatchLoader | 45
`createBatchLoader(batchFn, { maxBatchSize = Infinity } = {})` returns `{ load(key), clear(key) }`.

- `load(key)` returns a promise for the value of `key`. All keys requested **in the same tick** (before the microtask queue runs) are sent together in **one** `batchFn(keys)` call (schedule the flush with `Promise.resolve().then(...)`).
- Keys are **deduplicated**: loading the same key twice returns the **same promise** and `key` appears once in the batch. Keys keep the order they were first requested in.
- `batchFn` is async and must return an array **of the same length**, aligned with `keys`. An `Error` instance at a position **rejects only that key**; any other value resolves it.
- If `batchFn` throws/rejects, **every** key in that batch rejects with that error. If it returns a wrong-length array (or a non-array), every key rejects with `Error('batch function must return an array of the same length')`.
- Results are **cached**: a key that already loaded (or is loading) is not fetched again. A key that **failed** is **not** cached, so loading it later retries. `clear(key)` forgets a key.
- A tick with more than `maxBatchSize` keys is split into several `batchFn` calls of at most that size, in order.

```js
const loader = createBatchLoader(async (ids) => db.usersByIds(ids));
const [a, b] = await Promise.all([loader.load(1), loader.load(2)]); // ONE query: [1, 2]
```

%% worked
**A similar problem, solved: `createCoalescer(fetchAll)`** — queue callers, flush once on a microtask, answer each caller from one shared result.

```js
function createCoalescer(fetchAll) {
  let queue = [];
  let scheduled = false;
  return {
    get() {
      return new Promise((resolve) => {
        queue.push(resolve);                                  // ① remember who is waiting
        if (!scheduled) {
          scheduled = true;
          Promise.resolve().then(async () => {                // ② flush after the current synchronous code finishes
            const waiting = queue;
            queue = [];
            scheduled = false;
            const value = await fetchAll();                   // ③ ONE call for all of them
            for (const resolve of waiting) resolve(value);
          });
        }
      });
    },
  };
}
```

A loader adds **keys**: remember `{ key, resolve, reject }` per request, send the keys, then answer each waiter from **its position** in the result. The per-key **promise cache** gives you deduplication for free.

%% explain
- **Cache of promises** by key (dedupe + memoize).
- **Queue** of entries flushed once per tick; **slice** by `maxBatchSize`.
- **Dispatch**: call `batchFn`, validate, then settle each entry by index.

%% nudge
- Where does deduplication come from if you cache promises at `load` time?
- What happens to the cache entry of a key that failed?

%% starter
```js
export function createBatchLoader(batchFn, { maxBatchSize = Infinity } = {}) {
  return {
    load(key) {
      return batchFn([key]).then((values) => values[0]);
    },
    clear(key) {},
  };
}
```

%% tests
```js
describe('createBatchLoader', () => {
  const setup = (opts) => {
    const calls = [];
    const loader = createBatchLoader(async (keys) => { calls.push([...keys]); return keys.map((k) => k * 10); }, opts);
    return { loader, calls };
  };

  it('batches loads from the same tick into one call', async () => {
    const { loader, calls } = setup();
    const values = await Promise.all([loader.load(1), loader.load(2), loader.load(3)]);
    expect(values).toEqual([10, 20, 30]);
    expect(calls).toEqual([[1, 2, 3]]);
  });
  it('does not call the batch function synchronously', async () => {
    const { loader, calls } = setup();
    const p = loader.load(1);
    expect(calls).toEqual([]);
    await p;
  });
  it('dedupes keys and returns one value per request', async () => {
    const { loader, calls } = setup();
    const values = await Promise.all([loader.load(1), loader.load(2), loader.load(1)]);
    expect(values).toEqual([10, 20, 10]);
    expect(calls).toEqual([[1, 2]]);
  });
  it('returns the same promise for the same key', () => {
    const { loader } = setup();
    expect(loader.load(1)).toBe(loader.load(1));
  });
  it('uses separate batches for separate ticks', async () => {
    const { loader, calls } = setup();
    await loader.load(1);
    await loader.load(2);
    expect(calls).toEqual([[1], [2]]);
  });
  it('caches loaded keys', async () => {
    const { loader, calls } = setup();
    await loader.load(1);
    expect(await loader.load(1)).toBe(10);
    expect(calls).toEqual([[1]]);
  });
  it('forgets a key on clear', async () => {
    const { loader, calls } = setup();
    await loader.load(1);
    loader.clear(1);
    await loader.load(1);
    expect(calls).toEqual([[1], [1]]);
  });
  it('rejects only the key whose value is an Error, and does not cache it', async () => {
    const calls = [];
    const loader = createBatchLoader(async (keys) => {
      calls.push([...keys]);
      return keys.map((k) => (k === 2 && calls.length === 1 ? new Error('nope') : k));
    });
    const settled = await Promise.allSettled([loader.load(1), loader.load(2), loader.load(3)]);
    expect(settled.map((s) => s.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(settled[1].reason.message).toBe('nope');
    expect(await loader.load(2)).toBe(2);
    expect(calls).toEqual([[1, 2, 3], [2]]);
  });
  it('rejects every key when the batch function fails', async () => {
    const loader = createBatchLoader(async () => { throw new Error('db down'); });
    const settled = await Promise.allSettled([loader.load(1), loader.load(2)]);
    expect(settled.map((s) => s.status)).toEqual(['rejected', 'rejected']);
    expect(settled[0].reason.message).toBe('db down');
  });
  it('rejects every key for a wrong-length result', async () => {
    const loader = createBatchLoader(async () => [1]);
    const settled = await Promise.allSettled([loader.load('a'), loader.load('b')]);
    expect(settled.map((s) => s.reason && s.reason.message)).toEqual([
      'batch function must return an array of the same length',
      'batch function must return an array of the same length',
    ]);
    const bad = createBatchLoader(async () => 'nope');
    await expect(bad.load(1)).rejects.toThrow('same length');
  });
  it('splits a tick into chunks of maxBatchSize', async () => {
    const { loader, calls } = setup({ maxBatchSize: 2 });
    const values = await Promise.all([1, 2, 3, 4, 5].map((k) => loader.load(k)));
    expect(values).toEqual([10, 20, 30, 40, 50]);
    expect(calls).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('batches loads made after an earlier batch finished separately', async () => {
    const { loader, calls } = setup();
    await Promise.all([loader.load(1), loader.load(2)]);
    await Promise.all([loader.load(3), loader.load(1)]);
    expect(calls).toEqual([[1, 2], [3]]);
  });
});
```

%% hints
- `cache: Map(key → promise)`; in `load`, return the cached promise if present.
- Otherwise create the promise, push `{ key, resolve, reject, promise }` to `queue`, `cache.set`, and schedule one flush.
- `flush`: take the queue, split it into slices of `maxBatchSize`, and `dispatch` each.
- To fail a key: `if (cache.get(entry.key) === entry.promise) cache.delete(entry.key); entry.reject(error);`

%% solution
```js
export function createBatchLoader(batchFn, { maxBatchSize = Infinity } = {}) {
  const cache = new Map();
  let queue = [];
  let scheduled = false;

  const fail = (entry, error) => {
    if (cache.get(entry.key) === entry.promise) cache.delete(entry.key);
    entry.reject(error);
  };

  async function dispatch(batch) {
    let values;
    try {
      values = await batchFn(batch.map((entry) => entry.key));
    } catch (error) {
      for (const entry of batch) fail(entry, error);
      return;
    }
    if (!Array.isArray(values) || values.length !== batch.length) {
      const error = new Error('batch function must return an array of the same length');
      for (const entry of batch) fail(entry, error);
      return;
    }
    batch.forEach((entry, i) => {
      if (values[i] instanceof Error) fail(entry, values[i]);
      else entry.resolve(values[i]);
    });
  }

  function flush() {
    scheduled = false;
    const all = queue;
    queue = [];
    for (let i = 0; i < all.length; i += maxBatchSize) dispatch(all.slice(i, i + maxBatchSize));
  }

  return {
    load(key) {
      if (cache.has(key)) return cache.get(key);
      const entry = { key };
      entry.promise = new Promise((resolve, reject) => {
        entry.resolve = resolve;
        entry.reject = reject;
      });
      queue.push(entry);
      cache.set(key, entry.promise);
      if (!scheduled) {
        scheduled = true;
        Promise.resolve().then(flush);
      }
      return entry.promise;
    },
    clear(key) {
      cache.delete(key);
    },
  };
}
```

%% exercise nod-optimistic | Optimistic locking with retry | 3 | js | js | ConflictError, NotFoundError, updateWithVersion, retryOnConflict | 28
Rows in a `Map` store look like `{ id, version, ...fields }`.

- `ConflictError` (message `'version conflict'`) and `NotFoundError` (message `'not found'`) are `Error` subclasses.
- `updateWithVersion(store, id, expectedVersion, patch)`: a missing row throws `NotFoundError`; a row whose `version` is not `expectedVersion` throws `ConflictError` (the store is unchanged). Otherwise store a **new** row object `{ ...row, ...patch, id, version: row.version + 1 }` (so a patch can never change `id` or `version`) and return a **copy** of it. The old row object is not mutated.
- `retryOnConflict(attempt, { maxAttempts = 3 } = {})` (async) calls `attempt(n)` with `n` starting at `1` and returns its result. If it throws a `ConflictError` and attempts remain, it **tries again**; any other error, or the last conflict, is rethrown.

```js
const store = new Map([[1, { id: 1, version: 1, likes: 0 }]]);
updateWithVersion(store, 1, 1, { likes: 1 });   // { id: 1, version: 2, likes: 1 }
updateWithVersion(store, 1, 1, { likes: 2 });   // throws ConflictError
```

%% worked
**A similar problem, solved: `claimSeat(seats, seat, expectedOwner)`** — compare-and-set: change only if what you saw is still true.

```js
function claimSeat(seats, seat, expectedOwner, newOwner) {
  const current = seats.get(seat);
  if (current !== expectedOwner) throw new Error('seat changed');   // ① the check you read is stale: refuse
  seats.set(seat, newOwner);                                        // ② still what you saw: safe to write
  return newOwner;
}
```

A version number is a **cheap "has anything changed?"** that works for rows with many fields. Bumping it on every write is what makes the *next* stale writer fail.

%% explain
- **Compare** `row.version` with the expected version before writing.
- **Replace** the stored object (do not mutate the old one) and bump the version.
- **Retry loop** only for `ConflictError`.

%% nudge
- Why must a patch not be able to set `version` or `id`?
- Which errors should `retryOnConflict` retry?

%% starter
```js
export class ConflictError extends Error {
  constructor(message = 'version conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function updateWithVersion(store, id, expectedVersion, patch) {}

export async function retryOnConflict(attempt, { maxAttempts = 3 } = {}) {
  return attempt(1);
}
```

%% tests
```js
describe('updateWithVersion', () => {
  const make = () => new Map([[1, { id: 1, version: 1, likes: 0, title: 'Hi' }]]);
  it('updates with the right version and bumps it', () => {
    const store = make();
    expect(updateWithVersion(store, 1, 1, { likes: 1 })).toEqual({ id: 1, version: 2, likes: 1, title: 'Hi' });
    expect(store.get(1)).toEqual({ id: 1, version: 2, likes: 1, title: 'Hi' });
  });
  it('throws a ConflictError for a stale version and leaves the store alone', () => {
    const store = make();
    updateWithVersion(store, 1, 1, { likes: 1 });
    expect(() => updateWithVersion(store, 1, 1, { likes: 2 })).toThrow(ConflictError);
    expect(() => updateWithVersion(store, 1, 1, { likes: 2 })).toThrow('version conflict');
    expect(store.get(1).likes).toBe(1);
  });
  it('throws a NotFoundError for a missing row', () => {
    expect(() => updateWithVersion(make(), 9, 1, {})).toThrow(NotFoundError);
    expect(() => updateWithVersion(make(), 9, 1, {})).toThrow('not found');
  });
  it('never lets a patch change id or version', () => {
    const store = make();
    const row = updateWithVersion(store, 1, 1, { id: 99, version: 50, likes: 3 });
    expect(row).toMatchObject({ id: 1, version: 2, likes: 3 });
    expect(store.has(99)).toBe(false);
  });
  it('does not mutate the previous row, and returns a copy', () => {
    const store = make();
    const before = store.get(1);
    const out = updateWithVersion(store, 1, 1, { likes: 5 });
    expect(before).toEqual({ id: 1, version: 1, likes: 0, title: 'Hi' });
    out.likes = 999;
    expect(store.get(1).likes).toBe(5);
  });
  it('prevents the lost update between two readers', () => {
    const store = make();
    const a = { ...store.get(1) };
    const b = { ...store.get(1) };
    updateWithVersion(store, 1, a.version, { likes: a.likes + 1 });
    expect(() => updateWithVersion(store, 1, b.version, { likes: b.likes + 1 })).toThrow(ConflictError);
  });
});

describe('retryOnConflict', () => {
  it('returns the result and passes the attempt number', async () => {
    const attempt = jest.fn(async (n) => 'ok' + n);
    expect(await retryOnConflict(attempt)).toBe('ok1');
    expect(attempt).toHaveBeenCalledTimes(1);
  });
  it('retries on conflict until it succeeds', async () => {
    const attempt = jest.fn(async (n) => { if (n < 3) throw new ConflictError(); return 'done'; });
    expect(await retryOnConflict(attempt, { maxAttempts: 5 })).toBe('done');
    expect(attempt.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });
  it('rethrows the last conflict after maxAttempts', async () => {
    const attempt = jest.fn(async () => { throw new ConflictError(); });
    await expect(retryOnConflict(attempt, { maxAttempts: 3 })).rejects.toThrow(ConflictError);
    expect(attempt).toHaveBeenCalledTimes(3);
  });
  it('does not retry other errors', async () => {
    const attempt = jest.fn(async () => { throw new Error('other'); });
    await expect(retryOnConflict(attempt)).rejects.toThrow('other');
    expect(attempt).toHaveBeenCalledTimes(1);
  });
  it('defaults to three attempts', async () => {
    const attempt = jest.fn(async () => { throw new ConflictError(); });
    await retryOnConflict(attempt).catch(() => {});
    expect(attempt).toHaveBeenCalledTimes(3);
  });
  it('re-reads fresh data on each attempt, resolving a real conflict', async () => {
    const store = new Map([[1, { id: 1, version: 1, likes: 0 }]]);
    let interfered = false;
    const increment = async () => {
      const row = store.get(1);
      if (!interfered) { interfered = true; updateWithVersion(store, 1, 1, { likes: 10 }); }
      return updateWithVersion(store, 1, row.version, { likes: row.likes + 1 });
    };
    const out = await retryOnConflict(increment);
    expect(out).toMatchObject({ likes: 11, version: 3 });
  });
});
```

%% hints
- `if (!row) throw new NotFoundError(); if (row.version !== expectedVersion) throw new ConflictError();`
- `const next = { ...row, ...patch, id: row.id, version: row.version + 1 };`
- Loop `for (let n = 1; ; n++) { try { return await attempt(n); } catch (e) { if (!(e instanceof ConflictError) || n >= maxAttempts) throw e; } }`.

%% solution
```js
export class ConflictError extends Error {
  constructor(message = 'version conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function updateWithVersion(store, id, expectedVersion, patch) {
  const row = store.get(id);
  if (!row) throw new NotFoundError();
  if (row.version !== expectedVersion) throw new ConflictError();
  const next = { ...row, ...patch, id: row.id, version: row.version + 1 };
  store.set(id, next);
  return { ...next };
}

export async function retryOnConflict(attempt, { maxAttempts = 3 } = {}) {
  for (let n = 1; ; n++) {
    try {
      return await attempt(n);
    } catch (error) {
      if (!(error instanceof ConflictError) || n >= maxAttempts) throw error;
    }
  }
}
```

%% exercise nod-migrations | A migration runner | 4 | js | js | createMigrator | 40
`createMigrator({ migrations, state })`: `migrations` is an array of `{ name, up(schema), down(schema) }` (async or sync) and `state` is `{ applied: [names], schema: {...} }`, which the migrator keeps up to date.

- Creating a migrator with two migrations of the same `name` throws `Error('duplicate migration: <name>')`.
- `status()` returns `{ applied: [...copy], pending: [names] }` where `pending` is every migration not yet applied, **sorted by name**.
- `up()` first checks that every applied name is known, else rejects with `Error('unknown applied migration: <name>')`. Then it runs the pending migrations **one at a time, in name order**, awaiting `up(state.schema)`, **pushing each name onto `state.applied` only after it succeeds**. If one throws, it **stops** and rejects with that error; earlier ones stay applied. It resolves with the list of names applied by this call.
- `down(steps = 1)` does the same unknown-name check, then reverts up to `steps` migrations, **most recently applied first**, awaiting `down(state.schema)` and **removing each name only after it succeeds**. If one throws, it stops and rejects. It resolves with the names reverted.

```js
const state = { applied: [], schema: { tables: {} } };
const migrator = createMigrator({ state, migrations: [
  { name: '001-users', up: (s) => { s.tables.users = []; }, down: (s) => { delete s.tables.users; } },
] });
await migrator.up();   // ['001-users']
```

%% worked
**A similar problem, solved: `runSteps(steps, done)`** — do things in order, and record progress **after** each success so a failure leaves honest state.

```js
async function runSteps(steps, done) {
  const ran = [];
  for (const step of steps) {
    if (done.includes(step.name)) continue;          // ① skip what already happened
    await step.run();                                 // ② if this throws, we never reach the next line...
    done.push(step.name);                             // ③ ...so only real successes are recorded
    ran.push(step.name);
  }
  return ran;
}
```

The order of ② and ③ is the whole design: record **after** success, so after a crash the state says exactly what is really applied and the next `up()` **resumes where it stopped**.

%% explain
- **Validate** names at creation and applied names at run time.
- **Sort** pending by name; run **sequentially**; record **after** success.
- **`down`** pops from the end of `applied`.

%% nudge
- Why record the name after `up` succeeds rather than before?
- Which migration does `down()` revert, the last by name or the last applied?

%% starter
```js
export function createMigrator({ migrations, state }) {
  return {
    status() {
      return { applied: [...state.applied], pending: [] };
    },
    async up() {
      return [];
    },
    async down(steps = 1) {
      return [];
    },
  };
}
```

%% tests
```js
describe('createMigrator', () => {
  const make = (extra = {}) => {
    const trace = [];
    const mk = (name, opts = {}) => ({
      name,
      async up(schema) { trace.push('up ' + name); if (opts.failUp) throw new Error('up failed'); schema.tables[name] = true; },
      async down(schema) { trace.push('down ' + name); if (opts.failDown) throw new Error('down failed'); delete schema.tables[name]; },
    });
    const state = { applied: [], schema: { tables: {} } };
    return { trace, mk, state, ...extra };
  };

  it('rejects duplicate names at creation', () => {
    const { mk, state } = make();
    expect(() => createMigrator({ migrations: [mk('a'), mk('a')], state })).toThrow('duplicate migration: a');
  });
  it('applies pending migrations in name order, recording them', async () => {
    const { mk, state, trace } = make();
    const m = createMigrator({ migrations: [mk('003'), mk('001'), mk('002')], state });
    expect(await m.up()).toEqual(['001', '002', '003']);
    expect(trace).toEqual(['up 001', 'up 002', 'up 003']);
    expect(state.applied).toEqual(['001', '002', '003']);
    expect(state.schema.tables).toEqual({ '001': true, '002': true, '003': true });
  });
  it('does nothing when everything is applied', async () => {
    const { mk, state, trace } = make();
    const m = createMigrator({ migrations: [mk('001')], state });
    await m.up();
    trace.length = 0;
    expect(await m.up()).toEqual([]);
    expect(trace).toEqual([]);
  });
  it('reports status', async () => {
    const { mk, state } = make();
    const m = createMigrator({ migrations: [mk('002'), mk('001')], state });
    expect(m.status()).toEqual({ applied: [], pending: ['001', '002'] });
    await m.up();
    expect(m.status()).toEqual({ applied: ['001', '002'], pending: [] });
    const snapshot = m.status().applied;
    snapshot.push('x');
    expect(state.applied).toEqual(['001', '002']);
  });
  it('stops at the first failure and records only successes', async () => {
    const { mk, state, trace } = make();
    const m = createMigrator({ migrations: [mk('001'), mk('002', { failUp: true }), mk('003')], state });
    await expect(m.up()).rejects.toThrow('up failed');
    expect(state.applied).toEqual(['001']);
    expect(trace).toEqual(['up 001', 'up 002']);
    expect(m.status().pending).toEqual(['002', '003']);
  });
  it('runs migrations one at a time', async () => {
    const trace = [];
    const slow = (name) => ({
      name,
      async up() { trace.push(name + ' start'); await Promise.resolve(); await Promise.resolve(); trace.push(name + ' end'); },
      down() {},
    });
    const state = { applied: [], schema: {} };
    await createMigrator({ migrations: [slow('a'), slow('b')], state }).up();
    expect(trace).toEqual(['a start', 'a end', 'b start', 'b end']);
  });
  it('accepts synchronous migrations', async () => {
    const state = { applied: [], schema: { n: 0 } };
    const m = createMigrator({ migrations: [{ name: 'a', up: (s) => { s.n++; }, down: (s) => { s.n--; } }], state });
    await m.up();
    expect(state.schema.n).toBe(1);
  });
  it('reverts the most recent migration by default', async () => {
    const { mk, state, trace } = make();
    const m = createMigrator({ migrations: [mk('001'), mk('002')], state });
    await m.up();
    trace.length = 0;
    expect(await m.down()).toEqual(['002']);
    expect(trace).toEqual(['down 002']);
    expect(state.applied).toEqual(['001']);
    expect(state.schema.tables).toEqual({ '001': true });
  });
  it('reverts several steps, newest first, and stops when none are left', async () => {
    const { mk, state, trace } = make();
    const m = createMigrator({ migrations: [mk('001'), mk('002'), mk('003')], state });
    await m.up();
    trace.length = 0;
    expect(await m.down(2)).toEqual(['003', '002']);
    expect(await m.down(10)).toEqual(['001']);
    expect(await m.down()).toEqual([]);
    expect(trace).toEqual(['down 003', 'down 002', 'down 001']);
    expect(state.applied).toEqual([]);
  });
  it('keeps a migration applied when its down fails', async () => {
    const { mk, state } = make();
    const m = createMigrator({ migrations: [mk('001'), mk('002', { failDown: true })], state });
    await m.up();
    await expect(m.down(2)).rejects.toThrow('down failed');
    expect(state.applied).toEqual(['001', '002']);
  });
  it('can re-apply after a rollback', async () => {
    const { mk, state } = make();
    const m = createMigrator({ migrations: [mk('001'), mk('002')], state });
    await m.up();
    await m.down();
    expect(await m.up()).toEqual(['002']);
  });
  it('refuses to run when the state names an unknown migration', async () => {
    const { mk, state } = make();
    state.applied = ['001', 'ghost'];
    const m = createMigrator({ migrations: [mk('001')], state });
    await expect(m.up()).rejects.toThrow('unknown applied migration: ghost');
    await expect(m.down()).rejects.toThrow('unknown applied migration: ghost');
  });
  it('applies a newly added earlier migration and reverts by application order', async () => {
    const { mk, state } = make();
    state.applied = ['001', '003'];
    const m = createMigrator({ migrations: [mk('001'), mk('002'), mk('003')], state });
    expect(await m.up()).toEqual(['002']);
    expect(state.applied).toEqual(['001', '003', '002']);
    expect(await m.down()).toEqual(['002']);
  });
});
```

%% hints
- Check names with a `Set` at creation, and `state.applied.every((n) => names.has(n))` at run time.
- `const sorted = [...migrations].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));`
- `up`: loop `sorted`, skip applied, `await m.up(state.schema)`, **then** `state.applied.push(m.name)`.
- `down`: `while (reverted.length < steps && state.applied.length)` take the last name, find its migration, `await m.down(state.schema)`, **then** `state.applied.pop()`.

%% solution
```js
export function createMigrator({ migrations, state }) {
  const byName = new Map();
  for (const m of migrations) {
    if (byName.has(m.name)) throw new Error('duplicate migration: ' + m.name);
    byName.set(m.name, m);
  }
  const sorted = [...migrations].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const checkKnown = () => {
    for (const name of state.applied) {
      if (!byName.has(name)) throw new Error('unknown applied migration: ' + name);
    }
  };

  return {
    status() {
      return {
        applied: [...state.applied],
        pending: sorted.filter((m) => !state.applied.includes(m.name)).map((m) => m.name),
      };
    },
    async up() {
      checkKnown();
      const done = [];
      for (const m of sorted) {
        if (state.applied.includes(m.name)) continue;
        await m.up(state.schema);
        state.applied.push(m.name);
        done.push(m.name);
      }
      return done;
    },
    async down(steps = 1) {
      checkKnown();
      const reverted = [];
      while (reverted.length < steps && state.applied.length > 0) {
        const name = state.applied[state.applied.length - 1];
        await byName.get(name).down(state.schema);
        state.applied.pop();
        reverted.push(name);
      }
      return reverted;
    },
  };
}
```

%% exercise nod-check-batch-loader | Tests for a batch loader | 4 | js | js | checkBatchLoader | 38
`createBatchLoader(batchFn, { maxBatchSize })` returns `{ load(key), clear(key) }`: loads from one tick share **one** `batchFn(keys)` call, keys are deduplicated, results are cached, an `Error` at a position rejects only that key, and batches are split at `maxBatchSize`. You are given `checkBatchLoader(createBatchLoader)` (async). Write a check that passes for a correct loader and **fails** for one that: **calls the batch function once per key**, **does not dedupe repeated keys**, **forgets loaded keys immediately**, **fails every key when one fails**, **ignores maxBatchSize**, **returns values to the wrong keys**.

```js
const calls = [];
const loader = createBatchLoader(async (keys) => { calls.push([...keys]); return keys; });
await Promise.all([loader.load(1), loader.load(2)]);
expect(calls).toEqual([[1, 2]]);
```

%% worked
**A similar problem, solved: `checkCoalescer(createCoalescer)`** — **count the calls** a collaborator receives, and assert the **exact argument lists**.

```js
export async function checkCoalescer(createCoalescer) {     // createCoalescer(fetchAll)
  const calls = [];
  const c = createCoalescer(async () => { calls.push('fetch'); return 'data'; });
  const results = await Promise.all([c.get(), c.get(), c.get()]);
  expect(results).toEqual(['data', 'data', 'data']);       // ① every caller gets the value
  expect(calls).toEqual(['fetch']);                        // ② and the backend was hit ONCE, not three times
  await c.get();
  expect(calls).toHaveLength(2);                           // ③ a later tick starts a new batch
}
```

To catch "wrong keys" mutants, make each value **depend on its key** (`k * 10`) so a swap shows up. To catch "no dedupe" and "no batching", assert the **whole list of calls** with `toEqual`, not just their count.

%% explain
- **Spy log** of `batchFn` calls, compared with `toEqual`.
- **Key-dependent values** so misalignment is visible.
- **One scenario per rule**: dedupe, cache, per-key error, chunking.

%% nudge
- What assertion distinguishes "deduped" from "not deduped" in the calls log?
- How do you check the second load of a key did not hit the backend?

%% starter
```js
export async function checkBatchLoader(createBatchLoader) {
  const calls = [];
  const loader = createBatchLoader(async (keys) => { calls.push([...keys]); return keys.map((k) => k * 10); });
  expect(await loader.load(1)).toBe(10);
  // your assertions: batching, dedupe, cache, errors, maxBatchSize
}
```

%% tests
```js
const make = (f = {}) => (batchFn, { maxBatchSize = Infinity } = {}) => {
  const max = f.ignoreMax ? Infinity : maxBatchSize;
  const cache = new Map();
  let queue = [];
  let scheduled = false;
  const fail = (entry, error) => {
    if (cache.get(entry.key) === entry.promise) cache.delete(entry.key);
    entry.reject(error);
  };
  async function dispatch(batch) {
    let values;
    try { values = await batchFn(batch.map((e) => e.key)); } catch (error) { for (const e of batch) fail(e, error); return; }
    if (!Array.isArray(values) || values.length !== batch.length) {
      const error = new Error('batch function must return an array of the same length');
      for (const e of batch) fail(e, error);
      return;
    }
    if (f.reverseValues) values = [...values].reverse();
    const bad = values.find((v) => v instanceof Error);
    batch.forEach((e, i) => {
      if (f.failAll && bad) fail(e, bad);
      else if (values[i] instanceof Error) fail(e, values[i]);
      else e.resolve(values[i]);
    });
    if (f.noCache) for (const e of batch) if (cache.get(e.key) === e.promise) cache.delete(e.key);
  }
  function flush() {
    scheduled = false;
    const all = queue;
    queue = [];
    if (f.perCall) { for (const e of all) dispatch([e]); return; }
    for (let i = 0; i < all.length; i += max) dispatch(all.slice(i, i + max));
  }
  return {
    load(key) {
      if (!f.noDedupe && cache.has(key)) return cache.get(key);
      if (f.noDedupe && cache.has(key) && cache.get(key).settled) return cache.get(key);
      const entry = { key };
      entry.promise = new Promise((resolve, reject) => {
        entry.resolve = (v) => { entry.promise.settled = true; resolve(v); };
        entry.reject = reject;
      });
      queue.push(entry);
      cache.set(key, entry.promise);
      if (!scheduled) { scheduled = true; Promise.resolve().then(flush); }
      return entry.promise;
    },
    clear(key) { cache.delete(key); },
  };
};

const correct = make();
const mutants = {
  'calls the batch function once per key': make({ perCall: true }),
  'does not dedupe repeated keys': make({ noDedupe: true }),
  'forgets loaded keys immediately': make({ noCache: true }),
  'fails every key when one fails': make({ failAll: true }),
  'ignores maxBatchSize': make({ ignoreMax: true }),
  'returns values to the wrong keys': make({ reverseValues: true }),
};

describe('your checkBatchLoader', () => {
  it('passes on a correct loader', async () => {
    await checkBatchLoader(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a loader that ${name}`, async () => {
      let caught = false;
      try { await checkBatchLoader(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Values derived from keys (`k * 10`) expose swapped results.
- `await Promise.all([load(1), load(2), load(1)])` then `expect(calls).toEqual([[1, 2]])` kills both "per key" and "no dedupe".
- After that, `await loader.load(2)` and `expect(calls).toHaveLength(1)` kills "forgets keys".
- `Promise.allSettled` with one `Error` value shows whether neighbours survive.
- Five keys with `maxBatchSize: 2` must give `[[1, 2], [3, 4], [5]]`.

%% solution
```js
export async function checkBatchLoader(createBatchLoader) {
  const calls = [];
  const loader = createBatchLoader(async (keys) => {
    calls.push([...keys]);
    return keys.map((k) => k * 10);
  });
  expect(await Promise.all([loader.load(1), loader.load(2), loader.load(1)])).toEqual([10, 20, 10]);
  expect(calls).toEqual([[1, 2]]);
  expect(await loader.load(2)).toBe(20);
  expect(calls).toHaveLength(1);

  const failing = createBatchLoader(async (keys) => keys.map((k) => (k === 2 ? new Error('nope') : k)));
  const settled = await Promise.allSettled([failing.load(1), failing.load(2), failing.load(3)]);
  expect(settled.map((s) => s.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);

  const chunks = [];
  const small = createBatchLoader(async (keys) => { chunks.push([...keys]); return keys; }, { maxBatchSize: 2 });
  await Promise.all([1, 2, 3, 4, 5].map((k) => small.load(k)));
  expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
}
```
