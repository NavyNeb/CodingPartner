/* Runs every exercise's reference solution (must pass) and starter (must fail) through the real harness.
 *   npm run verify            all exercises
 *   npm run verify -- closures  only ids containing "closures"
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { readdirSync } from 'node:fs';
import { buildTracks } from '../src/content/parse';
import { trackMeta } from '../src/content/tracks';
import { compile } from '../src/runner/transform';
import type { Exercise } from '../src/content/types';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, 'utf8');
const harnessSrc = read('src/runner/harness.js');
const coreSrc = read('src/runner/typecheck-core.js');
const reactSrc = read('node_modules/react/umd/react.development.js');
const reactDomSrc = read('node_modules/react-dom/umd/react-dom.development.js');
const ts = require('typescript');
vm.runInThisContext(coreSrc);
const typecheck = (globalThis as any).__wsTypecheck;

interface Result { tests: { name: string; suite: string[]; status: string; error?: string }[]; fatal?: string; diagnostics?: { line: number; message: string }[]; logs: string[] }

async function runJs(ex: Exercise, code: string): Promise<Result> {
  const g = globalThis as any;
  const sandbox: any = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, performance,
    structuredClone, AbortController, AbortSignal, TextEncoder, TextDecoder, URL, URLSearchParams,
  };
  void g;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(harnessSrc, ctx);
  return exec(ctx.__whetstone, ex, code, 'js');
}

async function runReact(ex: Exercise, code: string): Promise<Result> {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: new VirtualConsole() });
  const w = dom.window as any;
  w.MessageChannel = MessageChannel; // jsdom lacks it; browsers have it and React's scheduler + async act need it
  w.eval(reactSrc);
  w.eval(reactDomSrc);
  w.eval(harnessSrc);
  const res = await exec(w.__whetstone, ex, code, 'react');
  w.close();
  return res;
}

async function exec(h: any, ex: Exercise, code: string, mode: string): Promise<Result> {
  const logs: string[] = [];
  const userCode = compile(code, ex.lang);
  const testCode = compile(ex.tests, ex.kind === 'react' ? 'tsx' : 'js');
  const report = await Promise.race([
    h.run({ userCode, testCode, exports: ex.exports, mode, testTimeout: 1500, emit: (m: any) => { if (m.type === 'log') logs.push(`[${m.level}] ${m.text}`); } }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('verify: run took > 30s')), 30000)),
  ]);
  return { tests: report.tests, fatal: report.fatal, logs };
}

function runTypes(ex: Exercise, code: string): Result {
  const r = typecheck.check(ts, (name: string) => { try { return readFileSync(root + 'node_modules/typescript/lib/' + name, 'utf8'); } catch { return undefined; } }, code, ex.tests);
  return { tests: r.cases.map((c: any) => ({ name: c.name, suite: [], status: c.pass ? 'pass' : 'fail', error: c.error })), diagnostics: r.diagnostics, logs: [] };
}

async function run(ex: Exercise, code: string): Promise<Result> {
  if (ex.kind === 'types') return runTypes(ex, code);
  return ex.kind === 'react' ? runReact(ex, code) : runJs(ex, code);
}

function loadSources(): Record<string, string> {
  const dir = root + 'src/content/lessons/';
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) out[`./lessons/${f}`] = readFileSync(dir + f, 'utf8');
  return out;
}
const tracks = buildTracks(loadSources(), trackMeta);
process.on('unhandledRejection', () => { /* starters often leave promises dangling; the browser only logs these */ });
const filter = process.argv[2];
let failures = 0, total = 0, tests = 0;
const seen = new Set<string>();
const t0 = Date.now();
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

for (const track of tracks) for (const lesson of track.lessons) for (const ex of lesson.exercises) {
  if (filter && !ex.id.includes(filter)) continue;
  total++;
  const problems: string[] = [];
  if (seen.has(ex.id)) problems.push('duplicate id');
  seen.add(ex.id);
  if (!ex.hints.length) problems.push('no hints');
  if (!ex.exports.length && ex.kind !== 'types') problems.push('no exports declared');

  try {
    const sol = await run(ex, ex.solution);
    tests += sol.tests.length;
    if (sol.fatal) problems.push(`solution fatal: ${sol.fatal}`);
    if (sol.diagnostics?.length) problems.push(`solution type errors: ${sol.diagnostics.map((d) => `L${d.line} ${d.message}`).join(' | ')}`);
    if (!sol.tests.length && !sol.fatal) problems.push('solution ran 0 tests');
    for (const t of sol.tests) if (t.status === 'fail') problems.push(`solution fails "${[...t.suite, t.name].join(' › ')}": ${t.error?.split('\n').slice(0, 4).join(' / ')}`);
    if (problems.length && sol.logs.length) problems.push(`logs: ${sol.logs.slice(0, 3).join(' | ')}`);

    const st = await run(ex, ex.starter);
    const starterFails = !!st.fatal || !!st.diagnostics?.length || st.tests.some((t) => t.status === 'fail');
    if (!starterFails) problems.push('starter passes all tests (tests are vacuous or starter is already solved)');
    // A starter should not be fatal for JS exercises: learners need to see per-test feedback.
    if (st.fatal && ex.kind !== 'types') problems.push(`starter is fatal (should load & fail tests): ${st.fatal.split('\n')[0]}`);
  } catch (e) {
    problems.push(`crash: ${(e as Error).stack?.split('\n').slice(0, 3).join(' / ')}`);
  }
  if (problems.length) {
    failures++;
    console.log(red('✗'), ex.id);
    problems.forEach((p) => console.log('   ', p));
  } else console.log(green('✓'), ex.id, dim(`(${ex.kind})`));
}
console.log(`\n${total - failures}/${total} exercises verified · ${tests} solution tests · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failures ? 1 : 0);
