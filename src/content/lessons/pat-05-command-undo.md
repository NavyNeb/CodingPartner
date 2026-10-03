---
id: pat-command-undo
track: pat
title: Command, undo & snapshots
summary: Turning actions into objects you can store, queue, undo and replay: command objects with do and undo, two-stack undo/redo, transactional batches, snapshot timelines (memento) and priority job queues.
---

## The idea in one sentence

Turn an **action into an object** that knows how to **do itself and undo itself**, and you can store it, queue it, log it, undo it, replay it or send it elsewhere.

> **Analogy** A restaurant order slip. The waiter doesn't cook; they write the order on a slip. The slip can wait on a rail, be reordered by priority, be copied for the bar, be crossed out if you change your mind, and be kept as a receipt. The *request* became a thing.

A plain function call happens once and is gone. A **command** is the same action, but kept in your hand.

## A command is just do and undo

![The command pattern](fig:pat-command "The invoker holds commands; each command acts on the receiver and knows its own inverse.")

```js try predict
function addText(doc, text) {
  return {
    do() { doc.text += text; },
    undo() { doc.text = doc.text.slice(0, doc.text.length - text.length); },
  };
}

const doc = { text: '' };
const c1 = addText(doc, 'Hello');
const c2 = addText(doc, ', world');
c1.do(); c2.do();
console.log(doc.text);
c2.undo();
console.log(doc.text);
```

Notice that `undo` must be the **exact inverse** of `do`, and each command **remembers what it needs** (the text it added, or the text it deleted) to reverse itself.

## Undo and redo with two stacks

A history object keeps an **undo stack** and a **redo stack**.

![Two stacks](fig:pat-undo-stacks "A new action empties the redo stack: you have branched into a different future.")

```stepper Undo and redo
code:
  h.execute(add('a'));
  h.execute(add('b'));
  h.undo();
  h.execute(add('c'));
  h.redo();
---
line: 1
say: `execute` runs the command and pushes it on the **undo stack**. The redo stack is emptied.
text: a
undo stack: a
redo stack: (empty)
---
line: 2
say: Another command on top of the stack.
text: ab
undo stack: a, b
redo stack: (empty)
---
line: 3
say: `undo` pops the **top** (`b`), reverses it, and parks it on the **redo stack**.
text: a
undo stack: a
redo stack: b
---
line: 4
say: A **new** action. The redo stack is **cleared**: the old future (`b`) no longer fits after the new state, so it is dropped.
text: ac
undo stack: a, c
redo stack: (empty)
---
line: 5
say: `redo` has nothing to redo, so it does nothing and reports `false`. Every editor you use behaves like this.
text: ac
undo stack: a, c
redo stack: (empty)
```

## Command-based or snapshot-based?

Two ways to support undo:

![Commands versus snapshots](fig:pat-memento "Store the inverse action, or store a whole copy of the state.")

- **Commands** store small actions with inverses. Memory is tiny, but **every action needs a correct `undo`**.
- **Snapshots** (the **memento** pattern) store a copy of the whole state at each step. Undo is "go back to that copy": trivially correct, but memory grows. With **immutable** state (a new object per change, as in the store from the observer lesson), old versions share most of their data, so snapshots are cheap.

```js try
function createTimeline(initial) {
  const states = [initial];
  let i = 0;
  return {
    current: () => states[i],
    push(state) { states.splice(i + 1); states.push(state); i++; },
    back() { if (i > 0) i--; return states[i]; },
    forward() { if (i < states.length - 1) i++; return states[i]; },
  };
}
const t = createTimeline({ n: 0 });
t.push({ n: 1 }); t.push({ n: 2 });
console.log(t.back(), t.back(), t.forward());
```

## Commands as work items: queues

Because a command is a value, it can wait. A **job queue** holds commands (functions to run), starts them when there is capacity, and lets important ones jump ahead. The same shape runs print queues, build systems and background task runners.

## Transactions: all or nothing

A **batch** (macro) command groups several commands. If the third of five fails, the first two must be **undone** so the system isn't left half-changed. Undo the batch by undoing its parts in **reverse** order.

## Quick check

```check
Q: What does a command object contain, at minimum?
A) A name only
B) How to perform the action, and (for undo) how to reverse it *
C) A database connection
D) A class hierarchy
Why: Do and undo, plus whatever data they need.
---
Q: Why is the redo stack cleared when a new command is executed?
A) To save memory
B) The undone future no longer applies after a new action changed the state *
C) Because redo is deprecated
D) It isn't cleared
Why: Redoing an old action on top of a different state could corrupt it.
---
Q: When are snapshots a good alternative to commands?
A) When state is huge and mutable
B) When state is small or immutable, so copies are cheap and undo is trivially correct *
C) Never
D) Only for text
Why: Snapshots trade memory for simplicity; immutability makes them cheap.
---
Q: In what order does a batch undo its commands?
A) The same order as do
B) Reverse order *
C) Random
D) Alphabetical
Why: Later steps may depend on earlier ones, so unwind from the newest.
---
Q: What makes a command useful in a queue?
A) It is an object, so it can be stored, ordered and run later *
B) It runs faster
C) It cannot fail
D) It has a name
Why: An action turned into a value can wait, be prioritised, retried and logged.
```

## Recap

- A **command** is an action as an object: `do` and `undo` (plus its data).
- **Undo/redo** = two stacks; executing a new command **clears redo**.
- **Snapshots (memento)** trade memory for simplicity; **immutable state** makes them cheap.
- **Batches** run commands as a unit and **roll back** on failure.
- **Queues** run commands later, by priority, within a concurrency limit.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a history with undo | An array used as a stack; `do`/`undo` calls |
| Undo, redo and a limit | Two stacks, clearing redo, trimming the oldest |
| A text editor with history | Commands that remember the deleted text |
| A transactional batch | Reverse unwinding when a step fails |
| A snapshot timeline | An index into an array of states; truncating the future |
| A priority job queue | A waiting list sorted by priority, a running counter, promises |

%% exercise pat-guided-history | Guided: a history with undo | 1 | js | js | createHistory | 8 | guided
Implement `createHistory()`. A command is an object `{ do(), undo() }`.

- `execute(command)` calls `command.do()` and remembers the command.
- `undo()` takes the **most recent** remembered command, calls its `undo()`, forgets it, and returns `true`. When there is nothing to undo, it returns `false`.
- `canUndo()` says whether there is something to undo.

```js
const h = createHistory();
h.execute({ do: () => log('A'), undo: () => log('undo A') });
h.undo(); // runs 'undo A', returns true
```

%% worked
**A similar problem, solved: `createUndoLog()`** — a stack of cleanup functions.

```js
function createUndoLog() {
  const stack = [];
  return {
    record(fn) { stack.push(fn); },                   // ① remember how to reverse something
    rollback() {
      const fn = stack.pop();                         // ② the most recent first (last in, first out)
      if (!fn) return false;                          // ③ nothing to roll back
      fn();
      return true;
    },
  };
}
```

An array with `push` and `pop` **is** a stack: exactly what undo needs, because the last thing you did is the first thing you reverse.

%% explain
- **Execute** runs `do` and pushes the command.
- **Undo** pops the newest command, runs its `undo`, returns `true`.
- **Empty** history: `undo()` returns `false` and does nothing.

%% nudge
- Which end of the array holds the most recent command?
- What should `undo()` return when nothing is left?

%% starter
```js
export function createHistory() {
  const undoStack = [];
  return {
    execute(command) {
      // run it and remember it
    },
    undo() {
      return false;
    },
    canUndo() {
      return false;
    },
  };
}
```

%% tests
```js
describe('createHistory', () => {
  const make = (log, name) => ({ do: () => log.push('do ' + name), undo: () => log.push('undo ' + name) });
  it('executes commands', () => {
    const log = [];
    const h = createHistory();
    h.execute(make(log, 'A'));
    expect(log).toEqual(['do A']);
  });
  it('undoes the most recent command first', () => {
    const log = [];
    const h = createHistory();
    h.execute(make(log, 'A'));
    h.execute(make(log, 'B'));
    expect(h.undo()).toBe(true);
    expect(h.undo()).toBe(true);
    expect(log).toEqual(['do A', 'do B', 'undo B', 'undo A']);
  });
  it('returns false when there is nothing to undo', () => {
    const h = createHistory();
    expect(h.undo()).toBe(false);
    expect(h.canUndo()).toBe(false);
  });
  it('tracks canUndo', () => {
    const log = [];
    const h = createHistory();
    h.execute(make(log, 'A'));
    expect(h.canUndo()).toBe(true);
    h.undo();
    expect(h.canUndo()).toBe(false);
    expect(h.undo()).toBe(false);
    expect(log).toEqual(['do A', 'undo A']);
  });
  it('keeps histories separate', () => {
    const log = [];
    const a = createHistory(), b = createHistory();
    a.execute(make(log, 'A'));
    expect(b.canUndo()).toBe(false);
  });
});
```

%% hints
- `execute`: `command.do(); undoStack.push(command);`
- `undo`: `const c = undoStack.pop(); if (!c) return false; c.undo(); return true;`

%% solution
```js
export function createHistory() {
  const undoStack = [];
  return {
    execute(command) {
      command.do();
      undoStack.push(command);
    },
    undo() {
      const command = undoStack.pop();
      if (!command) return false;
      command.undo();
      return true;
    },
    canUndo() {
      return undoStack.length > 0;
    },
  };
}
```

%% exercise pat-undo-redo | Undo, redo and a limit | 3 | js | js | createHistory | 20
Extend the history. `createHistory({ limit = Infinity } = {})`; a command is `{ do(), undo() }`.

- `execute(command)` runs `do()`, pushes the command on the **undo** stack and **empties the redo stack**. If `do()` throws, the error propagates and **nothing changes** (neither stack).
- `undo()` pops from undo, calls `undo()`, pushes on **redo**, returns `true` (or `false` if empty).
- `redo()` pops from redo, calls `do()` **again**, pushes back on undo, returns `true` (or `false` if empty).
- `limit` caps the **undo** stack: when it grows beyond `limit`, the **oldest** command is dropped (it can no longer be undone).
- `canUndo()`, `canRedo()` and `clear()` (empties both stacks without calling anything).

```js
const h = createHistory({ limit: 2 });
// after executing A, B, C only B and C can be undone
```

%% worked
**A similar problem, solved: `createBackForward()`** — two stacks like a browser's back and forward buttons.

```js
function createBackForward(start) {
  const back = [], forward = [];
  let current = start;
  return {
    visit(page) { back.push(current); current = page; forward.length = 0; },   // ① a new visit clears "forward"
    goBack() { if (!back.length) return current; forward.push(current); current = back.pop(); return current; },
    goForward() { if (!forward.length) return current; back.push(current); current = forward.pop(); return current; },
  };
}
```

Same machine: **moving the top item from one stack to the other**, and **clearing the second stack when something new happens**. In your history, remember to run `do()` **before** touching the stacks, so a failing command leaves everything unchanged.

%% explain
- **Execute**: run `do` first; then push and clear redo.
- **Undo / redo** move a command between the stacks, calling `undo()` / `do()`.
- **Limit** drops from the **bottom** (oldest) of the undo stack.
- **Failure** in `do` leaves both stacks untouched.

%% nudge
- Which array method removes the oldest item?
- What goes wrong if you clear the redo stack before `do()` succeeds?

%% starter
```js
export function createHistory({ limit = Infinity } = {}) {
  const undoStack = [];
  const redoStack = [];
  return {
    execute(command) {},
    undo() { return false; },
    redo() { return false; },
    canUndo() { return false; },
    canRedo() { return false; },
    clear() {},
  };
}
```

%% tests
```js
const make = (log, name) => ({ do: () => log.push('do ' + name), undo: () => log.push('undo ' + name) });

describe('createHistory', () => {
  it('undoes and redoes in order', () => {
    const log = [];
    const h = createHistory();
    h.execute(make(log, 'A'));
    h.execute(make(log, 'B'));
    expect(h.undo()).toBe(true);
    expect(h.redo()).toBe(true);
    expect(log).toEqual(['do A', 'do B', 'undo B', 'do B']);
  });
  it('reports empty stacks', () => {
    const h = createHistory();
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(false);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });
  it('a new command clears redo', () => {
    const log = [];
    const h = createHistory();
    h.execute(make(log, 'A'));
    h.execute(make(log, 'B'));
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.execute(make(log, 'C'));
    expect(h.canRedo()).toBe(false);
    expect(h.redo()).toBe(false);
    h.undo();
    h.undo();
    expect(log.slice(-2)).toEqual(['undo C', 'undo A']);
  });
  it('limit drops the oldest commands', () => {
    const log = [];
    const h = createHistory({ limit: 2 });
    h.execute(make(log, 'A'));
    h.execute(make(log, 'B'));
    h.execute(make(log, 'C'));
    expect(h.undo()).toBe(true);
    expect(h.undo()).toBe(true);
    expect(h.undo()).toBe(false);
    expect(log.filter((l) => l.startsWith('undo'))).toEqual(['undo C', 'undo B']);
  });
  it('a failing do changes nothing', () => {
    const log = [];
    const h = createHistory();
    h.execute(make(log, 'A'));
    h.undo();
    expect(h.canRedo()).toBe(true);
    expect(() => h.execute({ do() { throw new Error('nope'); }, undo() {} })).toThrow('nope');
    expect(h.canRedo()).toBe(true);
    expect(h.canUndo()).toBe(false);
    h.redo();
    expect(h.canUndo()).toBe(true);
  });
  it('clear empties both stacks without calling undo', () => {
    const log = [];
    const h = createHistory();
    h.execute(make(log, 'A'));
    h.execute(make(log, 'B'));
    h.undo();
    h.clear();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(log).toEqual(['do A', 'do B', 'undo B']);
  });
});
```

%% hints
- `execute`: `command.do(); undoStack.push(command); redoStack.length = 0; if (undoStack.length > limit) undoStack.shift();`
- `undo`: `const c = undoStack.pop(); if (!c) return false; c.undo(); redoStack.push(c); return true;`
- `redo` mirrors `undo`, but calls `c.do()` and pushes onto `undoStack`.

%% solution
```js
export function createHistory({ limit = Infinity } = {}) {
  const undoStack = [];
  const redoStack = [];
  return {
    execute(command) {
      command.do();
      undoStack.push(command);
      redoStack.length = 0;
      while (undoStack.length > limit) undoStack.shift();
    },
    undo() {
      const command = undoStack.pop();
      if (!command) return false;
      command.undo();
      redoStack.push(command);
      return true;
    },
    redo() {
      const command = redoStack.pop();
      if (!command) return false;
      command.do();
      undoStack.push(command);
      return true;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
  };
}
```

%% exercise pat-editor | A text editor with history | 3 | js | js | createEditor | 24
Implement `createEditor(initial = '')` with:

- `text()` returns the current text.
- `insert(index, text)` inserts `text` at `index` (`0` to the current length, otherwise `RangeError`). Inserting an **empty** string does nothing and is **not** recorded.
- `remove(index, length)` deletes `length` characters starting at `index` (`index >= 0`, `length >= 0`, `index + length <=` text length, otherwise `RangeError`). A `length` of `0` does nothing and is not recorded.
- `undo()` and `redo()` return `true` if they did something, else `false`. Undoing a `remove` brings back the **exact removed text**. A **new edit** clears the redo history. An invalid edit changes nothing and isn't recorded.

```js
const e = createEditor('hello');
e.remove(1, 3);   // 'ho'
e.undo();         // 'hello'
```

%% worked
**A similar problem, solved: `createCounterEditor()`** — a command that **remembers what it changed**.

```js
function setValue(state, next) {
  const previous = state.value;                       // ① capture BEFORE changing: that is what undo restores
  return {
    do() { state.value = next; },
    undo() { state.value = previous; },
  };
}
```

For `remove`, capture the **deleted substring** when you create the command: `undo` is then just "insert it back at the same index". The two commands are inverses of each other: `insert(i, t)` is undone by `remove(i, t.length)`, and `remove(i, n)` by `insert(i, removedText)`.

%% explain
- **Insert** and **remove** are commands with `do`/`undo`, each capturing what it needs.
- **Empty edits** are no-ops and aren't recorded.
- **Validation** happens before anything is recorded.
- **Undo/redo stacks**; a new edit clears redo.

%% nudge
- What does the `remove` command need to remember so its `undo` can work?
- Where should validation happen: before or after creating the command?

%% starter
```js
export function createEditor(initial = '') {
  let text = initial;
  const undoStack = [];
  const redoStack = [];
  return {
    text: () => text,
    insert(index, str) {},
    remove(index, length) {},
    undo() { return false; },
    redo() { return false; },
  };
}
```

%% tests
```js
describe('createEditor', () => {
  it('inserts and removes text', () => {
    const e = createEditor('hello');
    e.insert(5, ' world');
    expect(e.text()).toBe('hello world');
    e.remove(0, 6);
    expect(e.text()).toBe('world');
    e.insert(0, '>> ');
    expect(e.text()).toBe('>> world');
  });
  it('undoes and redoes in order', () => {
    const e = createEditor('');
    e.insert(0, 'abc');
    e.insert(3, 'def');
    e.remove(1, 2);
    expect(e.text()).toBe('adef');
    expect(e.undo()).toBe(true);
    expect(e.text()).toBe('abcdef');
    expect(e.undo()).toBe(true);
    expect(e.text()).toBe('abc');
    expect(e.redo()).toBe(true);
    expect(e.text()).toBe('abcdef');
    expect(e.redo()).toBe(true);
    expect(e.text()).toBe('adef');
  });
  it('restores exactly the removed text', () => {
    const e = createEditor('the quick brown fox');
    e.remove(4, 6);
    expect(e.text()).toBe('the brown fox');
    e.undo();
    expect(e.text()).toBe('the quick brown fox');
  });
  it('reports nothing to undo or redo', () => {
    const e = createEditor('x');
    expect(e.undo()).toBe(false);
    expect(e.redo()).toBe(false);
    expect(e.text()).toBe('x');
  });
  it('a new edit clears the redo history', () => {
    const e = createEditor('');
    e.insert(0, 'a');
    e.insert(1, 'b');
    e.undo();
    e.insert(1, 'c');
    expect(e.text()).toBe('ac');
    expect(e.redo()).toBe(false);
    e.undo();
    e.undo();
    expect(e.text()).toBe('');
    expect(e.undo()).toBe(false);
  });
  it('validates and records nothing for invalid or empty edits', () => {
    const e = createEditor('abc');
    expect(() => e.insert(4, 'x')).toThrow(RangeError);
    expect(() => e.insert(-1, 'x')).toThrow(RangeError);
    expect(() => e.remove(2, 5)).toThrow(RangeError);
    expect(() => e.remove(-1, 1)).toThrow(RangeError);
    expect(() => e.remove(0, -1)).toThrow(RangeError);
    e.insert(1, '');
    e.remove(1, 0);
    expect(e.text()).toBe('abc');
    expect(e.undo()).toBe(false);
  });
  it('keeps editors independent', () => {
    const a = createEditor('a'), b = createEditor('b');
    a.insert(1, '!');
    expect(b.text()).toBe('b');
    expect(b.undo()).toBe(false);
  });
});
```

%% hints
- Insert command: `do: () => { text = text.slice(0, i) + s + text.slice(i); }`, `undo: () => { text = text.slice(0, i) + text.slice(i + s.length); }`.
- Remove command: capture `const removed = text.slice(i, i + n);` when creating the command.
- A shared `run(command)`: `command.do(); undoStack.push(command); redoStack.length = 0;`

%% solution
```js
export function createEditor(initial = '') {
  let text = initial;
  const undoStack = [];
  const redoStack = [];

  const insertAt = (i, s) => { text = text.slice(0, i) + s + text.slice(i); };
  const removeAt = (i, n) => { text = text.slice(0, i) + text.slice(i + n); };

  function run(command) {
    command.do();
    undoStack.push(command);
    redoStack.length = 0;
  }

  return {
    text: () => text,
    insert(index, str) {
      if (!Number.isInteger(index) || index < 0 || index > text.length) throw new RangeError('bad index');
      if (str === '') return;
      run({ do: () => insertAt(index, str), undo: () => removeAt(index, str.length) });
    },
    remove(index, length) {
      if (!Number.isInteger(index) || !Number.isInteger(length) || index < 0 || length < 0 || index + length > text.length) {
        throw new RangeError('bad range');
      }
      if (length === 0) return;
      const removed = text.slice(index, index + length);
      run({ do: () => removeAt(index, length), undo: () => insertAt(index, removed) });
    },
    undo() {
      const command = undoStack.pop();
      if (!command) return false;
      command.undo();
      redoStack.push(command);
      return true;
    },
    redo() {
      const command = redoStack.pop();
      if (!command) return false;
      command.do();
      undoStack.push(command);
      return true;
    },
  };
}
```

%% exercise pat-batch | A transactional batch | 3 | js | js | batch | 18
Implement `batch(commands)`, returning a **command** `{ do(), undo() }` that groups the given commands (each `{ do(), undo() }`).

- `do()` runs each command's `do()` **in order**. If one **throws**, the commands that already ran are **undone in reverse order** and the **original error** is rethrown. After a failed `do()`, the batch counts as *not done*.
- `undo()` calls each command's `undo()` in **reverse** order. It does nothing if the batch is not currently done.
- `do()` when already done does nothing (so it can't run twice by accident).
- An empty batch is fine.

```js
const b = batch([addItem, chargeCard, sendEmail]);
b.do();   // if sendEmail throws: chargeCard.undo(), then addItem.undo(), then rethrow
```

%% worked
**A similar problem, solved: `runAll(steps)`** — roll back the completed part when a step fails.

```js
function runAll(steps) {
  const done = [];
  try {
    for (const step of steps) { step.run(); done.push(step); }     // ① remember what has completed
  } catch (error) {
    while (done.length) done.pop().revert();                       // ② undo only those, newest first
    throw error;                                                   // ③ then report the original failure
  }
}
```

Note that the command that **failed** is not in `done`: it never completed, so it has nothing to revert. `batch` is this loop wrapped in a command, with a `done` flag.

%% explain
- **`do`**: run in order, tracking those that completed.
- **On failure**: undo completed ones in reverse, rethrow the original error.
- **`undo`**: reverse order; only if currently done.
- **Idempotent `do`**: ignored when already done.

%% nudge
- Which commands need undoing when the third one fails?
- What state flag stops `undo()` from running after a failed `do()`?

%% starter
```js
export function batch(commands) {
  let isDone = false;
  return {
    do() {},
    undo() {},
  };
}
```

%% tests
```js
const cmd = (log, name, { failOnDo = false } = {}) => ({
  do() { if (failOnDo) throw new Error(name + ' failed'); log.push('do ' + name); },
  undo() { log.push('undo ' + name); },
});

describe('batch', () => {
  it('runs do in order and undo in reverse', () => {
    const log = [];
    const b = batch([cmd(log, 'A'), cmd(log, 'B'), cmd(log, 'C')]);
    b.do();
    b.undo();
    expect(log).toEqual(['do A', 'do B', 'do C', 'undo C', 'undo B', 'undo A']);
  });
  it('rolls back completed commands when one fails, and rethrows', () => {
    const log = [];
    const b = batch([cmd(log, 'A'), cmd(log, 'B'), cmd(log, 'C', { failOnDo: true }), cmd(log, 'D')]);
    expect(() => b.do()).toThrow('C failed');
    expect(log).toEqual(['do A', 'do B', 'undo B', 'undo A']);
  });
  it('does not undo after a failed do', () => {
    const log = [];
    const b = batch([cmd(log, 'A'), cmd(log, 'B', { failOnDo: true })]);
    expect(() => b.do()).toThrow();
    log.length = 0;
    b.undo();
    expect(log).toEqual([]);
  });
  it('ignores a second do and a second undo', () => {
    const log = [];
    const b = batch([cmd(log, 'A')]);
    b.do(); b.do();
    expect(log).toEqual(['do A']);
    b.undo(); b.undo();
    expect(log).toEqual(['do A', 'undo A']);
  });
  it('can be redone after being undone', () => {
    const log = [];
    const b = batch([cmd(log, 'A'), cmd(log, 'B')]);
    b.do(); b.undo(); b.do();
    expect(log).toEqual(['do A', 'do B', 'undo B', 'undo A', 'do A', 'do B']);
  });
  it('handles an empty batch and does not undo before do', () => {
    const b = batch([]);
    expect(() => { b.do(); b.undo(); }).not.toThrow();
    const log = [];
    const c = batch([cmd(log, 'A')]);
    c.undo();
    expect(log).toEqual([]);
  });
  it('works as a command inside a history-like caller', () => {
    const log = [];
    const inner = batch([cmd(log, 'A'), cmd(log, 'B')]);
    const outer = batch([inner, cmd(log, 'C')]);
    outer.do();
    outer.undo();
    expect(log).toEqual(['do A', 'do B', 'do C', 'undo C', 'undo B', 'undo A']);
  });
});
```

%% hints
- `do`: `if (isDone) return; const done = []; try { for (const c of commands) { c.do(); done.push(c); } } catch (e) { while (done.length) done.pop().undo(); throw e; } isDone = true;`
- `undo`: `if (!isDone) return; for (let i = commands.length - 1; i >= 0; i--) commands[i].undo(); isDone = false;`

%% solution
```js
export function batch(commands) {
  let isDone = false;
  return {
    do() {
      if (isDone) return;
      const done = [];
      try {
        for (const command of commands) {
          command.do();
          done.push(command);
        }
      } catch (error) {
        while (done.length) done.pop().undo();
        throw error;
      }
      isDone = true;
    },
    undo() {
      if (!isDone) return;
      for (let i = commands.length - 1; i >= 0; i--) commands[i].undo();
      isDone = false;
    },
  };
}
```

%% exercise pat-timeline | A snapshot timeline | 2 | js | js | createTimeline | 16
Implement `createTimeline(initial)`, a **snapshot** history (memento). It stores whole states.

- `current()` returns the current state; `index()` its position (0 for the first); `length()` how many states are stored.
- `push(state)` adds a new state **after the current one**, dropping any "future" states. If `state` is `Object.is`-equal to the current one, nothing happens.
- `back()` and `forward()` move one step and return the state now current. At the start or end they stay put and return the current state.
- `jump(i)` moves to position `i` and returns that state; an invalid position throws `RangeError`.
- `canBack()` and `canForward()`.

```js
const t = createTimeline('a');
t.push('b'); t.push('c');
t.back(); // 'b'
```

%% worked
**A similar problem, solved: `createTabs()`** — an array plus a pointer, truncating when you branch.

```js
function createTabs(first) {
  const pages = [first];
  let i = 0;
  return {
    open(page) { pages.length = i + 1; pages.push(page); i++; },    // ① cut off everything after the pointer, then append
    prev() { if (i > 0) i--; return pages[i]; },                    // ② clamp at the ends
    next() { if (i < pages.length - 1) i++; return pages[i]; },
  };
}
```

`pages.length = i + 1` truncates an array in place: the neat way to drop the future.

%% explain
- **An array of states and an index.**
- **Push** truncates the future, appends, advances; ignores equal states.
- **Back / forward** clamp at the ends; **jump** validates.

%% nudge
- How do you drop every item after position `i` in an array?
- Why should pushing an equal state be ignored?

%% starter
```js
export function createTimeline(initial) {
  const states = [initial];
  let i = 0;
  return {
    current: () => states[i],
    index: () => i,
    length: () => states.length,
    push(state) {},
    back() { return states[i]; },
    forward() { return states[i]; },
    jump(position) { return states[i]; },
    canBack: () => false,
    canForward: () => false,
  };
}
```

%% tests
```js
describe('createTimeline', () => {
  it('starts with the initial state', () => {
    const t = createTimeline({ n: 0 });
    expect(t.current()).toEqual({ n: 0 });
    expect(t.index()).toBe(0);
    expect(t.length()).toBe(1);
    expect(t.canBack()).toBe(false);
    expect(t.canForward()).toBe(false);
  });
  it('pushes states and moves back and forward', () => {
    const t = createTimeline('a');
    t.push('b'); t.push('c');
    expect(t.current()).toBe('c');
    expect(t.length()).toBe(3);
    expect(t.back()).toBe('b');
    expect(t.back()).toBe('a');
    expect(t.forward()).toBe('b');
    expect(t.canBack()).toBe(true);
    expect(t.canForward()).toBe(true);
  });
  it('clamps at the ends', () => {
    const t = createTimeline('a');
    t.push('b');
    expect(t.forward()).toBe('b');
    t.back();
    expect(t.back()).toBe('a');
    expect(t.index()).toBe(0);
  });
  it('pushing after going back drops the future', () => {
    const t = createTimeline('a');
    t.push('b'); t.push('c');
    t.back();
    t.push('x');
    expect(t.length()).toBe(3);
    expect(t.canForward()).toBe(false);
    expect(t.back()).toBe('b');
    expect(t.forward()).toBe('x');
  });
  it('ignores a push equal to the current state', () => {
    const t = createTimeline('a');
    t.push('a');
    expect(t.length()).toBe(1);
    const obj = { n: 1 };
    const u = createTimeline(obj);
    u.push(obj);
    expect(u.length()).toBe(1);
    u.push({ n: 1 });
    expect(u.length()).toBe(2);
  });
  it('jumps to a position and validates it', () => {
    const t = createTimeline('a');
    t.push('b'); t.push('c');
    expect(t.jump(0)).toBe('a');
    expect(t.index()).toBe(0);
    expect(t.jump(2)).toBe('c');
    expect(() => t.jump(3)).toThrow(RangeError);
    expect(() => t.jump(-1)).toThrow(RangeError);
    expect(() => t.jump(0.5)).toThrow(RangeError);
  });
});
```

%% hints
- `push`: `if (Object.is(state, states[i])) return; states.length = i + 1; states.push(state); i++;`
- `back`: `if (i > 0) i--; return states[i];` (mirror for forward).
- `jump`: validate with `Number.isInteger(p) && p >= 0 && p < states.length`.

%% solution
```js
export function createTimeline(initial) {
  const states = [initial];
  let i = 0;
  return {
    current: () => states[i],
    index: () => i,
    length: () => states.length,
    push(state) {
      if (Object.is(state, states[i])) return;
      states.length = i + 1;
      states.push(state);
      i++;
    },
    back() {
      if (i > 0) i--;
      return states[i];
    },
    forward() {
      if (i < states.length - 1) i++;
      return states[i];
    },
    jump(position) {
      if (!Number.isInteger(position) || position < 0 || position >= states.length) {
        throw new RangeError('no such position');
      }
      i = position;
      return states[i];
    },
    canBack: () => i > 0,
    canForward: () => i < states.length - 1,
  };
}
```

%% exercise pat-job-queue | A priority job queue | 4 | js | js | createJobQueue | 34
Implement `createJobQueue({ concurrency = 1 } = {})`. A **job** is a function returning a value or a promise.

- `add(job, { priority = 0 } = {})` returns a **promise** that settles with the job's result (or rejection).
- At most `concurrency` jobs run at once. A job starts as soon as there is a free slot (it may start a microtask later).
- Waiting jobs are started by **higher priority first**; equal priorities run in the order they were added.
- `size()` is the number of jobs **waiting**; `pending()` the number **running**.
- `idle()` returns a promise that resolves when nothing is waiting or running (immediately if already so).
- A `concurrency` that is not an integer ≥ 1 throws `RangeError`. A failing job doesn't stop the queue.

```js
const q = createJobQueue({ concurrency: 2 });
q.add(() => fetchUser(1)); q.add(() => fetchUser(2), { priority: 5 });
```

%% worked
**A similar problem, solved: `createLimiter(max)`** — limit how many async functions run at once.

```js
function createLimiter(max) {
  let running = 0;
  const waiting = [];
  const pump = () => {
    while (running < max && waiting.length) {
      const run = waiting.shift();
      running++;
      run().finally(() => { running--; pump(); });        // ① when one finishes, start the next
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    waiting.push(() => Promise.resolve().then(fn).then(resolve, reject));   // ② wrap: any outcome settles the caller's promise
    pump();
  });
}
```

Priority is a small change: instead of `shift()`, pick the waiting job with the **highest priority, then the lowest sequence number**. `idle()` keeps a list of resolvers and calls them whenever `running === 0 && waiting.length === 0` after a job finishes.

%% explain
- **Waiting list** with `priority` and an increasing sequence number.
- **A pump** starts jobs while `running < concurrency`.
- **Each job's promise** resolves or rejects with its outcome; failures don't stop the pump.
- **`idle()`** waits for empty-and-not-running.

%% nudge
- How do you break ties between equal priorities?
- When exactly should the `idle` waiters be released?

%% starter
```js
export function createJobQueue({ concurrency = 1 } = {}) {
  return {
    add(job, { priority = 0 } = {}) { return Promise.resolve(); },
    size: () => 0,
    pending: () => 0,
    idle: () => Promise.resolve(),
  };
}
```

%% tests
```js
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe('createJobQueue', () => {
  it('runs a job and resolves with its result', async () => {
    const q = createJobQueue();
    await expect(q.add(() => 5)).resolves.toBe(5);
    await expect(q.add(async () => 'x')).resolves.toBe('x');
  });
  it('rejects with the job error and keeps going', async () => {
    const q = createJobQueue();
    const bad = q.add(() => { throw new Error('boom'); });
    const good = q.add(() => 'fine');
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe('fine');
    const asyncBad = q.add(async () => { throw new Error('later'); });
    await expect(asyncBad).rejects.toThrow('later');
  });
  it('respects the concurrency limit', async () => {
    const q = createJobQueue({ concurrency: 2 });
    const ds = [deferred(), deferred(), deferred()];
    const started = [];
    const ps = ds.map((d, i) => q.add(() => { started.push(i); return d.promise; }));
    await tick();
    expect(started).toEqual([0, 1]);
    expect(q.pending()).toBe(2);
    expect(q.size()).toBe(1);
    ds[0].resolve('a');
    await tick();
    expect(started).toEqual([0, 1, 2]);
    expect(q.size()).toBe(0);
    ds[1].resolve('b'); ds[2].resolve('c');
    await Promise.all(ps);
    await tick();
    expect(q.pending()).toBe(0);
  });
  it('runs higher priority first and FIFO among equals', async () => {
    const q = createJobQueue({ concurrency: 1 });
    const gate = deferred();
    const order = [];
    const first = q.add(() => gate.promise);
    const add = (name, priority) => q.add(() => { order.push(name); }, { priority });
    const rest = [add('low1', 0), add('low2', 0), add('high1', 5), add('high2', 5), add('mid', 2)];
    gate.resolve();
    await first;
    await Promise.all(rest);
    expect(order).toEqual(['high1', 'high2', 'mid', 'low1', 'low2']);
  });
  it('idle resolves when nothing is waiting or running', async () => {
    const q = createJobQueue({ concurrency: 1 });
    await q.idle();
    const d = deferred();
    q.add(() => d.promise);
    q.add(() => 1);
    let idle = false;
    q.idle().then(() => { idle = true; });
    await tick();
    expect(idle).toBe(false);
    d.resolve();
    await tick();
    expect(idle).toBe(true);
  });
  it('can be reused after becoming idle', async () => {
    const q = createJobQueue();
    await q.add(() => 1);
    await q.idle();
    await expect(q.add(() => 2)).resolves.toBe(2);
  });
  it('validates concurrency', () => {
    expect(() => createJobQueue({ concurrency: 0 })).toThrow(RangeError);
    expect(() => createJobQueue({ concurrency: 1.5 })).toThrow(RangeError);
    expect(() => createJobQueue({ concurrency: -2 })).toThrow(RangeError);
  });
});
```

%% hints
- `waiting.push({ job, priority, seq: seq++, resolve, reject })`; to choose: sort by `b.priority - a.priority || a.seq - b.seq` and `shift()`.
- `pump`: `while (running < concurrency && waiting.length) { const item = pick(); running++; Promise.resolve().then(item.job).then(item.resolve, item.reject).finally(() => { running--; pump(); settleIdle(); }); }`
- `settleIdle`: if `running === 0 && waiting.length === 0`, resolve all stored `idle` resolvers.

%% solution
```js
export function createJobQueue({ concurrency = 1 } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('concurrency must be an integer >= 1');
  const waiting = [];
  let running = 0;
  let seq = 0;
  let idleWaiters = [];

  function settleIdle() {
    if (running === 0 && waiting.length === 0) {
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }

  function pump() {
    while (running < concurrency && waiting.length) {
      waiting.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      const item = waiting.shift();
      running++;
      Promise.resolve()
        .then(item.job)
        .then(item.resolve, item.reject)
        .finally(() => {
          running--;
          pump();
          settleIdle();
        });
    }
  }

  return {
    add(job, { priority = 0 } = {}) {
      return new Promise((resolve, reject) => {
        waiting.push({ job, priority, seq: seq++, resolve, reject });
        pump();
      });
    },
    size: () => waiting.length,
    pending: () => running,
    idle() {
      if (running === 0 && waiting.length === 0) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
  };
}
```
