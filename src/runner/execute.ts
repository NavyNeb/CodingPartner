import type { Exercise } from '../content/types';
import { compile } from './transform';
import harnessSrc from './harness.js?raw';
import { checkTypes } from './typecheck';

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';
export interface LogLine { level: LogLevel; text: string }
export interface TestResult {
  name: string;
  suite: string[];
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  ms: number;
}
export interface RunReport {
  tests: TestResult[];
  logs: LogLine[];
  /** Load-time failure: syntax error, missing export, exception at import. */
  fatal?: string;
  /** Compiler errors inside the learner's own code (type exercises). */
  diagnostics?: { line: number; message: string }[];
  timedOut?: string;
  ms: number;
  passed: boolean;
}

const IDLE_LIMIT = 4500;
const WORKER_TAIL = `
;self.onmessage = async function (e) {
  var emit = function (m) { self.postMessage(m); };
  try {
    var report = await self.__whetstone.run(Object.assign({}, e.data, { emit: emit }));
    self.postMessage({ type: 'done', report: report });
  } catch (err) {
    self.postMessage({ type: 'crash', message: String((err && err.stack) || err) });
  }
};`;

function finish(partial: Partial<RunReport>, logs: LogLine[], t0: number): RunReport {
  const tests = partial.tests ?? [];
  const passed =
    !partial.fatal && !partial.timedOut && !(partial.diagnostics && partial.diagnostics.length) &&
    tests.length > 0 && tests.every((t) => t.status !== 'fail');
  return { tests, logs, fatal: partial.fatal, diagnostics: partial.diagnostics, timedOut: partial.timedOut, ms: Math.round(performance.now() - t0), passed };
}

export async function runExercise(ex: Exercise, code: string): Promise<RunReport> {
  const t0 = performance.now();
  if (ex.kind === 'types') return checkTypes(ex, code, t0);

  let userJs: string, testJs: string;
  try {
    userJs = compile(code, ex.lang);
  } catch (e) {
    return finish({ fatal: `Syntax error: ${(e as Error).message}` }, [], t0);
  }
  try {
    testJs = compile(ex.tests, ex.kind === 'react' ? 'tsx' : 'js');
  } catch (e) {
    return finish({ fatal: `Exercise tests failed to compile: ${(e as Error).message}` }, [], t0);
  }
  const payload = { userCode: userJs, testCode: testJs, exports: ex.exports, mode: ex.kind === 'react' ? 'react' : 'js', testTimeout: 2000 };
  return ex.kind === 'react' ? runInIframe(payload, t0) : runInWorker(payload, t0);
}

type Payload = { userCode: string; testCode: string; exports: string[]; mode: string; testTimeout: number };

function collector(t0: number, resolve: (r: RunReport) => void, kill: () => void) {
  const logs: LogLine[] = [];
  const tests: TestResult[] = [];
  let current = '';
  let timer: ReturnType<typeof setTimeout>;
  let done = false;
  const settle = (partial: Partial<RunReport>) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    kill();
    resolve(finish({ tests, ...partial }, logs, t0));
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => settle({ timedOut: current || 'the test file' }), IDLE_LIMIT);
  };
  arm();
  return {
    handle(m: any) {
      arm();
      if (m.type === 'log') logs.push({ level: m.level, text: m.text });
      else if (m.type === 'start') current = m.name;
      else if (m.type === 'test') tests.push(m.result);
      else if (m.type === 'done') settle({ tests: m.report.tests, fatal: m.report.fatal });
      else if (m.type === 'crash') settle({ fatal: m.message });
    },
    abort: (msg: string) => settle({ fatal: msg }),
  };
}

function runInWorker(payload: Payload, t0: number): Promise<RunReport> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([harnessSrc + WORKER_TAIL], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const c = collector(t0, resolve, () => { worker.terminate(); URL.revokeObjectURL(url); });
    worker.onmessage = (e) => c.handle(e.data);
    worker.onerror = (e) => c.abort(e.message || 'Worker error');
    worker.postMessage(payload);
  });
}

/* ───── React sandbox ───── */

let reactLibs: Promise<[string, string]> | null = null;
const loadReactLibs = () =>
  (reactLibs ??= Promise.all([import('../../node_modules/react/umd/react.development.js?raw'), import('../../node_modules/react-dom/umd/react-dom.development.js?raw')]).then(([a, b]) => [a.default, b.default]));

const esc = (s: string) => s.replace(/<\/script/gi, '<\\/script');

export async function buildSandboxHtml(tail: string): Promise<string> {
  const [react, dom] = await loadReactLibs();
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px system-ui,sans-serif;margin:16px}</style></head><body><div id="root"></div>
<script>${esc(react)}</script><script>${esc(dom)}</script><script>${esc(harnessSrc)}</script><script>${esc(tail)}</script></body></html>`;
}

const IFRAME_TAIL = `
window.addEventListener('message', async function (e) {
  if (!e.data || e.data.type !== 'run') return;
  var emit = function (m) { parent.postMessage(m, '*'); };
  window.addEventListener('error', function (ev) { emit({ type: 'log', level: 'error', text: String(ev.message) }); });
  window.addEventListener('unhandledrejection', function (ev) { emit({ type: 'log', level: 'error', text: 'Unhandled rejection: ' + String(ev.reason && ev.reason.message || ev.reason) }); });
  try {
    var report = await window.__whetstone.run(Object.assign({}, e.data.payload, { emit: emit }));
    emit({ type: 'done', report: report });
  } catch (err) { emit({ type: 'crash', message: String((err && err.stack) || err) }); }
});`;

export function offscreenIframe(): HTMLIFrameElement {
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.setAttribute('aria-hidden', 'true');
  f.tabIndex = -1;
  f.style.cssText = 'position:fixed;top:0;left:-9999px;width:900px;height:700px;border:0;opacity:0;pointer-events:none';
  return f;
}

async function runInIframe(payload: Payload, t0: number): Promise<RunReport> {
  const html = await buildSandboxHtml(IFRAME_TAIL);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const frame = offscreenIframe();
    const cleanup = () => { window.removeEventListener('message', onMsg); frame.remove(); URL.revokeObjectURL(url); };
    const c = collector(t0, resolve, cleanup);
    const onMsg = (e: MessageEvent) => { if (e.source === frame.contentWindow) c.handle(e.data); };
    window.addEventListener('message', onMsg);
    frame.onload = () => frame.contentWindow?.postMessage({ type: 'run', payload }, '*');
    frame.src = url;
    document.body.appendChild(frame);
  });
}

/* ───── Playground ───── */

export interface ScratchHandle { stop: () => void }

/** Run free-form JS/TS, streaming console output. Late async logs are kept for a moment after the run. */
export function runScratch(code: string, lang: 'js' | 'ts', onLog: (l: LogLine) => void, onDone: (fatal?: string) => void): ScratchHandle {
  let js: string;
  try { js = compile(code, lang); } catch (e) { onDone(`Syntax error: ${(e as Error).message}`); return { stop() {} }; }
  const url = URL.createObjectURL(new Blob([harnessSrc + WORKER_TAIL], { type: 'text/javascript' }));
  const worker = new Worker(url);
  let finished = false;
  const end = (fatal?: string) => { if (finished) return; finished = true; worker.terminate(); URL.revokeObjectURL(url); onDone(fatal); };
  let idle = setTimeout(() => end('Stopped: no output for a while (infinite loop?)'), 8000);
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'log') onLog({ level: m.level, text: m.text });
    else if (m.type === 'done') {
      clearTimeout(idle);
      if (m.report.fatal) onLog({ level: 'error', text: m.report.fatal.replace(/^Your code threw while loading:\n/, '') });
      idle = setTimeout(() => end(), 1500); // allow timers/promises scheduled by the script to log
    } else if (m.type === 'crash') end(m.message);
  };
  worker.onerror = (e) => end(e.message);
  worker.postMessage({ userCode: js, testCode: "it('run', () => {});", exports: [], mode: 'js', testTimeout: 2000 });
  return { stop: () => { clearTimeout(idle); end(); } };
}

export interface PreviewHandle { stop: () => void }

/** Mount a default-exported React component into a visible sandboxed iframe. */
export async function mountPreview(code: string, host: HTMLElement, onLog: (l: LogLine) => void): Promise<PreviewHandle> {
  const js = compile(code, 'tsx');
  const tail = `window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'mount') return;
    var emit = function (m) { parent.postMessage(m, '*'); };
    window.addEventListener('error', function (ev) { emit({ type: 'log', level: 'error', text: String(ev.message) }); });
    try { window.__whetstone.mount(e.data.code, document.getElementById('root'), emit); }
    catch (err) { emit({ type: 'log', level: 'error', text: String(err && err.message || err) }); }
  });`;
  const html = await buildSandboxHtml(tail);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.title = 'Live preview';
  frame.className = 'preview-frame';
  const onMsg = (e: MessageEvent) => { if (e.source === frame.contentWindow && e.data?.type === 'log') onLog({ level: e.data.level, text: e.data.text }); };
  window.addEventListener('message', onMsg);
  frame.onload = () => frame.contentWindow?.postMessage({ type: 'mount', code: js }, '*');
  frame.src = url;
  host.replaceChildren(frame);
  return { stop() { window.removeEventListener('message', onMsg); frame.remove(); URL.revokeObjectURL(url); } };
}
