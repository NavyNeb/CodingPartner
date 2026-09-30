import { useCallback, useEffect, useRef, useState } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { Split } from '../components/Split';
import { Icon } from '../components/Icon';
import { Logo, ThemeToggle } from '../components/bits';
import { Link } from 'react-router-dom';
import { mountPreview, runScratch, type LogLine, type PreviewHandle, type ScratchHandle } from '../runner/execute';

type Mode = 'script' | 'react';

const SAMPLES: Record<Mode, string> = {
  script: `// Scratchpad — plain JS or TypeScript. Press Ctrl/⌘ + Enter.
type User = { name: string; tags: string[] };

const users: User[] = [
  { name: 'Ada', tags: ['math', 'engines'] },
  { name: 'Grace', tags: ['navy', 'cobol'] },
];

const byTag = users.flatMap((u) => u.tags.map((t) => [t, u.name] as const));
console.log(Object.fromEntries(byTag));

setTimeout(() => console.log('…and this runs after the timer'), 300);
`,
  react: `// Live React preview. Export a component as default.
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ fontFamily: 'system-ui', padding: 8 }}>
      <h2>Clicked {count} times</h2>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
}
`,
};

const store = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch { /* ignore */ }
  return null;
};

export default function Playground() {
  const [mode, setMode] = useState<Mode>(() => (store('whetstone:pg:mode') as Mode) || 'script');
  const [codes, setCodes] = useState<Record<Mode, string>>(() => ({
    script: store('whetstone:pg:script') ?? SAMPLES.script,
    react: store('whetstone:pg:react') ?? SAMPLES.react,
  }));
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState(true);
  const preview = useRef<HTMLDivElement>(null);
  const handle = useRef<ScratchHandle | PreviewHandle | null>(null);
  const token = useRef(0);
  const code = codes[mode];

  useEffect(() => { store('whetstone:pg:mode', mode); }, [mode]);
  useEffect(() => { const t = setTimeout(() => store(`whetstone:pg:${mode}`, code), 400); return () => clearTimeout(t); }, [mode, code]);

  const stop = () => { handle.current?.stop(); handle.current = null; };

  const run = useCallback(async () => {
    stop();
    const my = ++token.current;
    setLogs([]);
    const push = (l: LogLine) => { if (my === token.current) setLogs((prev) => (prev.length > 500 ? prev : [...prev, l])); };
    if (mode === 'script') {
      setRunning(true);
      handle.current = runScratch(code, 'ts', push, (fatal) => {
        if (my !== token.current) return;
        if (fatal) push({ level: 'error', text: fatal });
        setRunning(false);
      });
    } else {
      try {
        if (preview.current) handle.current = await mountPreview(code, preview.current, push);
      } catch (e) {
        push({ level: 'error', text: `Syntax error: ${(e as Error).message}` });
      }
    }
  }, [mode, code]);

  // Live mode for React: re-mount shortly after typing stops.
  useEffect(() => {
    if (mode !== 'react' || !live) return;
    const t = setTimeout(() => void run(), 650);
    return () => clearTimeout(t);
  }, [mode, live, code, run]);

  useEffect(() => () => { token.current++; stop(); }, [mode]);

  return (
    <div className="workspace">
      <header className="ws-bar">
        <Logo />
        <span className="ws-sep" aria-hidden="true" />
        <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Roadmap</Link><Icon name="chevronRight" size={12} /><span aria-current="page">Playground</span></nav>
        <div className="seg" role="tablist" aria-label="Playground mode">
          <button role="tab" aria-selected={mode === 'script'} onClick={() => setMode('script')}>JS / TS</button>
          <button role="tab" aria-selected={mode === 'react'} onClick={() => setMode('react')}>React</button>
        </div>
        <div className="ws-bar-right">
          {mode === 'react' && (
            <button className={`chip-btn${live ? ' on' : ''}`} onClick={() => setLive(!live)} aria-pressed={live} title="Re-render automatically while you type">Live</button>
          )}
          <ThemeToggle />
        </div>
      </header>
      <main className="ws-main">
        <Split
          dir="row" storageKey="whetstone:split:pg" initial={0.5} min={0.25} max={0.75} label="Resize editor and output"
          first={
            <div className="editor-panel">
              <div className="editor-bar">
                <span className="file-name">{mode === 'script' ? 'scratch.ts' : 'App.tsx'}</span>
                <span className="grow" />
                <button className="btn ghost" onClick={() => { setCodes((c) => ({ ...c, [mode]: SAMPLES[mode] })); }}><Icon name="reset" size={14} /> Sample</button>
                <button className="btn primary" onClick={() => void run()} disabled={running}><Icon name="play" size={12} /> Run <kbd>⌘↵</kbd></button>
              </div>
              <CodeEditor key={mode} value={code} onChange={(v) => setCodes((c) => ({ ...c, [mode]: v }))} onRun={() => void run()} lang={mode === 'react' ? 'tsx' : 'ts'} label="Playground editor" />
            </div>
          }
          second={
            mode === 'react' ? (
              <Split
                dir="col" storageKey="whetstone:split:pg-out" initial={0.66} min={0.2} max={0.85} label="Resize preview and console"
                first={<div className="preview" ref={preview}><div className="empty"><b>Preview</b><p>Press Run to render your component.</p></div></div>}
                second={<ConsolePane logs={logs} />}
              />
            ) : <ConsolePane logs={logs} />
          }
        />
      </main>
    </div>
  );
}

function ConsolePane({ logs }: { logs: LogLine[] }) {
  return (
    <section className="results" aria-label="Console">
      <div className="tabs"><span className="tab static"><Icon name="terminal" size={14} /> Console{logs.length > 0 && <span className="count">{logs.length}</span>}</span></div>
      <div className="results-body">
        {logs.length === 0 ? (
          <div className="empty"><b>Nothing logged yet</b><p>Output from <code>console.log</code> appears here.</p></div>
        ) : (
          <ul className="console">{logs.map((l, i) => <li key={i} className={`log log-${l.level}`}><span className="log-level">{l.level}</span><pre>{l.text}</pre></li>)}</ul>
        )}
      </div>
    </section>
  );
}
