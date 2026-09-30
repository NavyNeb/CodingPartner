import type { Exercise } from '../content/types';
import type { RunReport, TestResult } from './execute';
import coreSrc from './typecheck-core.js?raw';
import tsUrl from 'typescript/lib/typescript.js?url';

// Only the lib files a `lib: ["es2022"]` program needs (DOM is deliberately left out).
const libModules = import.meta.glob(
  [
    '/node_modules/typescript/lib/lib.es5.d.ts',
    '/node_modules/typescript/lib/lib.es201[5-9]*.d.ts',
    '/node_modules/typescript/lib/lib.es202[0-2]*.d.ts',
    '/node_modules/typescript/lib/lib.decorators*.d.ts',
    '!/node_modules/typescript/lib/*.full.d.ts',
  ],
  { query: '?raw', import: 'default' },
) as Record<string, () => Promise<string>>;

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let seq = 0;
const waiting = new Map<number, (m: any) => void>();

function boot(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const abs = new URL(tsUrl, location.href).href;
    const src = `importScripts(${JSON.stringify(abs)});\n${coreSrc}
var libs = {};
self.onmessage = function (e) {
  var d = e.data;
  if (d.type === 'init') { libs = d.libs; self.postMessage({ type: 'ready' }); return; }
  try {
    var r = self.__wsTypecheck.check(self.ts, function (n) { return libs[n]; }, d.user, d.tests);
    self.postMessage({ type: 'result', id: d.id, result: r });
  } catch (err) { self.postMessage({ type: 'result', id: d.id, error: String((err && err.stack) || err) }); }
};`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    worker = w;
    const libs: Record<string, string> = {};
    await Promise.all(Object.entries(libModules).map(async ([path, load]) => { libs[path.split('/').pop()!] = await load(); }));
    await new Promise<void>((resolve, reject) => {
      w.onmessage = (e) => {
        if (e.data.type === 'ready') resolve();
        else waiting.get(e.data.id)?.(e.data);
      };
      w.onerror = (e) => reject(new Error(e.message));
      w.postMessage({ type: 'init', libs });
    });
    w.onmessage = (e) => waiting.get(e.data.id)?.(e.data);
  })().catch((err) => { ready = null; worker = null; throw err; });
  return ready;
}

const friendly = (m: string) =>
  m.replace(/Type 'false' does not satisfy the constraint 'true'\.?/, 'The two types are not equal (Expect<Equal<…>> failed).')
   .replace(/Type 'true' does not satisfy the constraint 'true'\.?/, 'Unexpected type.')
   .replace(/Unused '@ts-expect-error' directive\.?/, 'This line should be a type error, but your types accept it.');

export async function checkTypes(ex: Exercise, code: string, t0: number): Promise<RunReport> {
  const finish = (p: Partial<RunReport>): RunReport => {
    const tests = p.tests ?? [];
    const passed = !p.fatal && !p.timedOut && !(p.diagnostics?.length) && tests.length > 0 && tests.every((t) => t.status !== 'fail');
    return { tests, logs: [], ms: Math.round(performance.now() - t0), passed, ...p };
  };
  try {
    await boot();
  } catch (e) {
    return finish({ fatal: `Could not start the TypeScript compiler: ${(e as Error).message}` });
  }
  const id = ++seq;
  const msg = await new Promise<any>((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      worker?.terminate(); worker = null; ready = null;
      resolve({ timeout: true });
    }, 20000);
    waiting.set(id, (m) => { clearTimeout(timer); waiting.delete(id); resolve(m); });
    worker!.postMessage({ id, user: code, tests: ex.tests });
  });
  if (msg.timeout) return finish({ timedOut: 'the type checker' });
  if (msg.error) return finish({ fatal: msg.error });
  const { diagnostics, cases } = msg.result as { diagnostics: { line: number; message: string }[]; cases: { name: string; pass: boolean; error?: string }[] };
  const tests: TestResult[] = cases.map((c) => ({ name: c.name, suite: [], status: c.pass ? 'pass' : 'fail', error: c.error ? friendly(c.error) : undefined, ms: 0 }));
  return finish({ tests, diagnostics: diagnostics.map((d) => ({ line: d.line, message: friendly(d.message) })) });
}
