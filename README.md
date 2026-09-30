# Whetstone

**A practice-first gym for JavaScript, TypeScript and React.** Short lessons on the ideas that actually get probed
in interviews, then live coding against real tests — from warm-ups to senior-level problems. Built for getting your
fundamentals back after leaning on AI.

- **148 exercises** in **28 lessons** (the JavaScript, TypeScript and React lessons are fully illustrated; Production and Interview are being upgraded the same way), four difficulty tiers (Warm-up → Core → Hard → Interview)
- **A real editor** (CodeMirror 6) with `Ctrl/⌘ + Enter` to run, autosaved drafts, and optional autocomplete
- **Real tests**, run in your browser — no server, nothing leaves your machine
- **Interview mode**: per-exercise countdown, no hints, no solution, no autocomplete
- **Honest progress**: opening the solution before your tests pass marks the exercise *solved with help*
- **Playground** for free JS/TS scripts (console output) and live React previews

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (hash routing — host it anywhere)
npm run verify     # run every reference solution & starter through the real harness
```

## Deploy (Vercel)

Import the repo at [vercel.com/new](https://vercel.com/new) — `vercel.json` already sets the Vite build and `dist/` output, and
hash routing means no rewrites are needed. Or from a terminal: `npx vercel --prod`.

## What's inside

| Track | Lessons | Exercises |
| --- | --- | --- |
| **JavaScript, properly** | closures · `this` & prototypes · arrays · objects & copying · promises · async patterns · event loop & timing · iterators & generators · functional patterns | 48 |
| **TypeScript, for real** | generics & narrowing · mapped/conditional/template types · typing real code | 13 |
| **React, under the hood** | rendering · state & forms · effects · custom hooks · performance · architecture · composition & a11y | 32 |
| **Production scenarios** | case studies from a live-betting platform: update firehose · 20 000-event screens · reconnects & sequence gaps · stale prices & idempotent bets · memory leaks · Web Worker RPC · multi-tab sync & leader election | 21 |
| **Interview gauntlet** | data structures & algorithms · frontend classics | 15 |

Highlights: **production incident case studies** (each starts with the symptom and metrics, then you build the fix against synthetic sockets, clocks, tabs and worker ports) · build `bind`, `new` and `instanceof` from scratch · a spec-shaped `Promise` · debounce/throttle with leading/trailing/cancel/flush ·
an `Observable` · LRU cache and trie · a virtual DOM → HTML renderer · `DeepReadonly`, `UnionToIntersection` and dot-path types ·
accessible tabs, modal (portal + focus trap) and combobox · a virtualised list · race-condition-safe data fetching.

## How it works

Everything runs client-side:

| Exercise kind | How it executes |
| --- | --- |
| **JS / TS** | Your code is stripped of types with [sucrase](https://github.com/alangpierce/sucrase) and run in a **Web Worker** together with a small Jest-style harness (`describe/it/expect`, `jest.fn`, fake timers…). A watchdog terminates the worker on infinite loops. |
| **React** | Runs in a **sandboxed iframe** with React 18 and a mini Testing Library (`render`, `screen.getByRole…`, `fireEvent`, `userEvent`, `waitFor`, `act`, `renderHook`). Real DOM, real events, real focus. |
| **Type challenges** | The **real TypeScript compiler** (`strict`) runs in a worker. Each case is a `type _ = Expect<Equal<…>>` assertion or a `// @ts-expect-error`; no compiler errors means the case passes. |

The harness is one plain-JS file (`src/runner/harness.js`) shared by the browser and by the Node verifier.

### Verification

`npm run verify` is the safety net for the curriculum itself. For **every** exercise it checks that

1. the reference **solution passes all tests**, and
2. the **starter fails** at least one test (so no test is vacuous),

using Node `vm` (JS), jsdom (React) and the TypeScript compiler (types). All exercises were additionally executed through
the built app in headless Chromium.

### Production-scenario test helpers

Exercises in the `prod` track get synthetic infrastructure in their test scope: `createFakeSocket(url)` (a controllable
WebSocket: `.open() .receive() .drop() .listenerCount()`), `createFakeChannelHub()` (BroadcastChannel across "tabs"),
`createFakePorts()` (entangled MessagePorts for worker RPC) and `flushPromises()` — combined with `jest.useFakeTimers()`.

## Adding content

Lessons are Markdown files in `src/content/lessons/` — theory first, then exercises using a tiny directive syntax:

````md
---
id: my-lesson
track: js          # js | ts | react | interview
title: My lesson
summary: One sentence.
---

Theory in Markdown…

%% exercise my-exercise | Title | 2 | js | js | exportedName | 10
Task in Markdown. (fields: id | title | difficulty 1-4 | lang js/ts/tsx | kind js/react/types | exports | minutes)

%% starter
```js
export function exportedName() {}
```

%% tests
```js
describe('exportedName', () => { it('works', () => { expect(exportedName()).toBe(1); }); });
```

%% hints
- First hint.
- Second, more specific hint.

%% solution
```js
export function exportedName() { return 1; }
```
````

Files are ordered by filename within a track. Run `npm run verify` after adding an exercise.

### Illustrated lessons

Lesson theory can embed visuals and interactive blocks (all linted by `npm run verify`):

````md
![alt text](fig:closure-backpack "Caption with ① numbered callouts")   ← SVG figure from src/figures/index.ts

```ts try types      ← TypeScript snippet checked by the real compiler (shows errors)

```js try            ← editable, runnable snippet  (```js try predict = "guess the output first"; ```tsx try = live React preview)
console.log('hi');
```

```check             ← multiple-choice concept check ("*" marks the right option)
Q: Question?
A) Wrong
B) Right *
Why: Explanation.
```

```stepper Title     ← step-through walkthrough: code lines, highlighted line, live state panels
code:
  const a = 1;
---
line: 1
say: What happens now.
Variables: a = 1
```
````

Exercises can also carry `%% worked` (a solved example of the same shape), `%% explain` (what the tests check, in plain English), `%% nudge` (a gentle "stuck? think about…"), and an 8th header field `guided` for a guided ramp-up exercise.

## Known limits

- Progress and drafts live in this browser's `localStorage` (no sync between devices).
- React exercises run in an iframe on the page's thread: a synchronous infinite loop in *React* code can freeze the tab
  (plain JS exercises run in a killable worker and are safe).
- Type challenges cover pure TypeScript (no DOM lib, no `@types/react`); React exercises are written in TSX but their
  types are stripped, not checked.
- The type checker downloads ~9 MB of compiler the first time you open a type exercise (then it's cached).
