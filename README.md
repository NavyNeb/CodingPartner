# Whetstone

**A practice-first gym for JavaScript, TypeScript and React.** Short lessons on the ideas that actually get probed
in interviews, then live coding against real tests — from warm-ups to senior-level problems. Built for getting your
fundamentals back after leaning on AI.

- **459 exercises** in **81 lessons** — every lesson is illustrated (labelled diagrams, step-through walkthroughs, runnable snippets, quick checks), every exercise has a worked example, a plain-English test explanation and a nudge, and each lesson starts with a guided warm-up, four difficulty tiers (Warm-up → Core → Hard → Interview)
- **A real editor** (CodeMirror 6) with `Ctrl/⌘ + Enter` to run, autosaved drafts, and optional autocomplete
- **Real tests**, run in your browser — your code never leaves your machine
- **Interview mode**: per-exercise countdown, no hints, no solution, no autocomplete
- **Honest progress**: opening the solution before your tests pass marks the exercise *solved with help*
- **Playground** for free JS/TS scripts (console output) and live React previews
- **Spaced review**: exercises you missed or needed help with come back after 1, 3, 7, 21 and 60 days (Leitner boxes), with a daily streak
- **Mock interviews**: three timed problems at warm-up / mid / senior level, scored by tests passed, with a report and what to revisit
- **Optional accounts without accounts**: an anonymous profile and a recovery code sync your progress across devices — no email, no password
- **Share links**: a public read-only page for a progress snapshot or a mock-interview result (code only if you choose to include it)

## Run it

```bash
npm install
npm run dev          # site on http://localhost:5173 (API calls proxy to :8787 if the server is running)
npm start            # the full app: builds nothing, serves dist/ + the sync API on http://localhost:8787
npm run build        # static site in dist/ (hash routing)
npm run verify       # every reference solution & starter through the real harness, plus lesson lint
npm test             # server API, sync-merge and review-scheduler tests (Node's built-in test runner)
npm run audit:figures  # every diagram in light, dark and phone width: overflow, overlap, contrast
```

Requires **Node 22.18+** (the server uses the built-in `node:sqlite` and runs TypeScript directly — it has **no npm dependencies**).

## Two ways to deploy

**1 · Full app (recommended): site + sync + share links.** One container serves the built site and a small API backed by SQLite.

```bash
docker build -t whetstone . && docker run -p 8080:8080 -v whetstone-data:/data whetstone
```

- **Render:** *New → Blueprint* and pick this repo (`render.yaml` is included). **A persistent disk is required for accounts to survive a redeploy**, which Render only offers on paid plans.
- **Fly.io:** `fly launch --no-deploy --copy-config`, `fly volumes create whetstone_data --size 1`, `fly deploy` (`fly.toml` is included).
- **Any VPS or home server:** the `docker run` line above, behind any HTTPS reverse proxy. Set `TRUST_PROXY=1` so rate limits see the real client address.
- Environment variables: `PORT` (default 8787), `DATA_DIR` (where `whetstone.db` lives), `DIST_DIR`, `TRUST_PROXY`.
- Back up with `npm run backup` (a consistent SQLite copy, safe while running).

**2 · Static only (Vercel, Netlify, GitHub Pages).** Import the repo — `vercel.json` already sets the Vite build and `dist/` output. Everything works except sync and share links: the site probes `/api/health`, finds nothing, and hides those controls. Progress stays in the browser.

### What the server stores

| Data | Stored as |
| --- | --- |
| Recovery code (24 characters, 120 bits) | Only its SHA-256 hash. It's shown once, so it **cannot be recovered or reset**. |
| Device tokens | Only SHA-256 hashes. Sign-out removes the token. |
| Progress | The same JSON the browser keeps: solved exercises, drafts, hints, attempts, mock results. Capped at 256 KB. |
| Share links | A snapshot you chose to publish; you can delete each one. |

No email, name, IP address or analytics. "Delete my synced data" removes the profile and every share link. Rate limits protect profile creation and recovery attempts.

**How sync works:** the browser stays the source of truth and works offline. Every change is pushed after a short pause; the server **merges** the two snapshots (earliest solve wins, latest draft wins, hints take the maximum, attempts are unioned) and returns the result. The merge function (`src/lib/syncMerge.ts`) is commutative, associative and idempotent, so devices converge whatever order they sync in — it's property-tested.

## What's inside

| Track | Lessons | Exercises |
| --- | --- | --- |
| **JavaScript, properly** | closures · `this` & prototypes · arrays · objects & copying · promises · async patterns · event loop & timing · iterators & generators · functional patterns | 48 |
| **TypeScript, for real** | generics & narrowing · mapped/conditional/template types · typing real code | 13 |
| **Data structures, from scratch** | complexity & arrays · hash tables, `Map` & `Set` · stacks, queues & ring buffers · linked lists · trees & BSTs · heaps & priority queues · graphs (BFS, DFS, topological sort, Dijkstra) · union-find, prefix sums & Fenwick trees · choosing the right structure | 45 |
| **Algorithm patterns** | recursion & divide and conquer · two pointers & sliding windows · sorting, selection & binary search on the answer · backtracking · dynamic programming (1-D, then grids, strings & knapsack) · greedy choices & intervals · spotting the pattern | 48 |
| **Testing, properly** | your first tests · choosing cases & edges · test doubles & dependency injection · async code & fake timers · React Testing Library · TDD & testability · flaky, brittle & weak tests · a capstone. Most exercises ask you to *write the tests*, graded against deliberately broken implementations | 38 |
| **Design patterns in JS/TS** | factories, builders & shared instances · strategy & state · observer, events & signals · decorators, proxies & middleware · command, undo & snapshots · adapters, facades & repositories · composite, iterator & visitor · a capstone (plugin host, pricing engine, undoable store, resilient client) | 34 |
| **Web security** | XSS & output encoding · injection, paths & untrusted input · passwords, sessions & tokens · cookies, CORS & CSRF · security headers, CSP & integrity · validation, uploads, rate limits & logs · dependencies, secrets & the supply chain · a capstone (threat modelling, authorisation, a secure request pipeline). Many exercises grade the security tests you write against vulnerable implementations | 36 |
| **Node & backend** | modules, providers & dependency injection · the request lifecycle (middleware, guards, interceptors, pipes, filters) · DTOs, validation & serialization · auth, guards & throttling · HTTP & REST semantics (routing, ETags, idempotency) · async, streams & graceful shutdown · data access (repositories, transactions, batching, migrations) · a capstone (config, logging, health, circuit breaker). Framework-neutral: no decorators, no Nest imports | 44 |
| **React, under the hood** | rendering · state & forms · effects · custom hooks · performance · architecture · composition & a11y | 32 |
| **Production scenarios** | case studies from a live-betting platform: update firehose · 20 000-event screens · reconnects & sequence gaps · stale prices & idempotent bets · memory leaks · Web Worker RPC · multi-tab sync & leader election | 21 |
| **Interview gauntlet** | data structures & algorithms · frontend classics | 15 |
| **The web platform** | the DOM, events & the rendering pipeline · networking & caching (`fetchJson`, stale-while-revalidate) · performance metrics (CLS, INP, p75, budgets) | 12 |
| **Frontend system design** | the RADIO method; feed pager, typeahead controller, optimistic outbox | 4 |

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

A **Glossary** page (`/#/glossary`) gives plain-English definitions of the terms used across the lessons, linked to where each is taught (`src/content/glossary.ts`).

## Adding content

Lessons are Markdown files in `src/content/lessons/` — theory first, then exercises using a tiny directive syntax:

````md
---
id: my-lesson
track: js          # js | ts | ds | algo | test | pat | sec | react | prod | interview | web | system
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

- Progress and drafts live in this browser's `localStorage` first. Cross-device sync needs the Node server (see above); on a static host it is off.
- Free hosting tiers usually sleep and have no persistent disk, so accounts there would disappear on redeploy. Use a host with a volume and run `npm run backup` now and then.
- Mock-interview scoring is a practice signal (tests passed ÷ total, averaged), not a hiring-grade assessment.
- React exercises run in an iframe on the page's thread: a synchronous infinite loop in *React* code can freeze the tab
  (plain JS exercises run in a killable worker and are safe).
- Type challenges cover pure TypeScript (no DOM lib, no `@types/react`); React exercises are written in TSX but their
  types are stripped, not checked.
- The type checker downloads ~9 MB of compiler the first time you open a type exercise (then it's cached).
