import { useEffect, useMemo, useRef, useState } from 'react';
import { type CheckQuestion, checkKey, parseCheck, parseStepper, resolveFrames } from '../lib/blocks';
import { codeBlock, highlightToHtml, renderInline } from '../lib/markdown';
import { checkTypes } from '../runner/typecheck';
import type { Exercise } from '../content/types';
import { runScratch, mountPreview, type LogLine, type PreviewHandle, type ScratchHandle } from '../runner/execute';
import { progress } from '../store/progress';
import { CodeEditor } from './CodeEditor';
import { Icon } from './Icon';

/* ───────────────────────── Stepper: a scrubbable "GIF" ───────────────────────── */

export function Stepper({ info, body }: { info: string; body: string }) {
  const parsed = useMemo(() => {
    try { const data = parseStepper(info, body); return { data, panels: resolveFrames(data) }; }
    catch (e) { return { error: (e as Error).message }; }
  }, [info, body]);
  const [i, setI] = useState(0);
  if ('error' in parsed) return <p className="fig-missing">{parsed.error}</p>;
  const { data, panels } = parsed;
  const n = data.frames.length;
  const frame = data.frames[i];
  const prevPanels = i > 0 ? panels[i - 1] : null;
  const html = data.code.map((l) => highlightToHtml(l, 'js') || ' ');
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setI((v) => Math.min(n - 1, v + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
  };
  return (
    <figure className="stepper" tabIndex={0} onKeyDown={onKey} aria-label={`Step-by-step: ${data.title}`}>
      <header className="stepper-head">
        <span className="stepper-title"><Icon name="play" size={11} /> {data.title}</span>
        <span className="stepper-count">Step {i + 1} of {n}</span>
      </header>
      <div className="stepper-body">
        {data.code.length > 0 && (
          <pre className="code stepper-code" data-lang="js"><code>
            {html.map((h, k) => {
              const on = !!frame.line && k + 1 >= frame.line[0] && k + 1 <= frame.line[1];
              return (
                <span key={k} className={`sl${on ? ' on' : ''}`}>
                  <span className="sl-no">{k + 1}</span>
                  <span className="sl-text" dangerouslySetInnerHTML={{ __html: h }} />
                </span>
              );
            })}
          </code></pre>
        )}
        <div className="stepper-panels">
          {data.panelNames.map((name) => {
            const items = panels[i][name];
            const before = prevPanels?.[name] ?? [];
            return (
              <div key={name} className="sp">
                <div className="sp-name">{name}</div>
                <div className="sp-items">
                  {items.length === 0 && <span className="sp-empty">empty</span>}
                  {items.map((it, k) => (
                    <span key={`${it}-${k}`} className={`sp-chip${before[k] !== it ? ' fresh' : ''}`}>{it}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="stepper-say" aria-live="polite" dangerouslySetInnerHTML={{ __html: renderInline(frame.say) }} />
      <footer className="stepper-ctl">
        <button className="btn sm" onClick={() => setI(0)} disabled={i === 0} aria-label="Restart"><Icon name="reset" size={13} /></button>
        <button className="btn sm" onClick={() => setI((v) => v - 1)} disabled={i === 0}><Icon name="arrowLeft" size={13} /> Back</button>
        <span className="stepper-dots" aria-hidden="true">
          {data.frames.map((_, k) => <button key={k} tabIndex={-1} className={k === i ? 'on' : k < i ? 'done' : ''} onClick={() => setI(k)} />)}
        </span>
        <button className="btn sm primary" onClick={() => setI((v) => v + 1)} disabled={i === n - 1}>Next <Icon name="arrowRight" size={13} /></button>
      </footer>
    </figure>
  );
}

/* ───────────────────────── Concept check ───────────────────────── */

export function ConceptCheck({ body }: { body: string }) {
  const parsed = useMemo(() => {
    try { return { qs: parseCheck(body) }; } catch (e) { return { error: (e as Error).message }; }
  }, [body]);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const qs: CheckQuestion[] = 'qs' in parsed ? (parsed.qs ?? []) : [];
  const done = qs.length > 0 && qs.every((_, k) => picked[k] !== undefined);
  const key = checkKey(body);
  useEffect(() => { if (done) progress.markCheck(key); }, [done, key]);
  if ('error' in parsed) return <p className="fig-missing">{parsed.error}</p>;
  const score = qs.filter((q, k) => picked[k] === q.answer).length;
  return (
    <section className="qcheck" aria-label="Quick check">
      <header className="qcheck-head"><Icon name="bulb" size={14} /> Quick check <span>{Object.keys(picked).length}/{qs.length} answered</span></header>
      {qs.map((q, k) => {
        const p = picked[k];
        return (
          <div className="cq" key={k}>
            <p className="cq-q"><span className="cq-n">{k + 1}</span><span dangerouslySetInnerHTML={{ __html: renderInline(q.q) }} /></p>
            {q.code && <div dangerouslySetInnerHTML={{ __html: codeBlock(q.code, 'js') }} />}
            <div className="cq-opts" role="radiogroup">
              {q.options.map((o, j) => {
                const state = p === undefined ? '' : j === q.answer ? ' right' : j === p ? ' wrong' : ' dim';
                return (
                  <button key={j} role="radio" aria-checked={p === j} disabled={p !== undefined} className={`cq-opt${state}`} onClick={() => setPicked((s) => ({ ...s, [k]: j }))}>
                    <span className="cq-letter">{String.fromCharCode(65 + j)}</span>
                    <span dangerouslySetInnerHTML={{ __html: renderInline(o) }} />
                  </button>
                );
              })}
            </div>
            {p !== undefined && (
              <p className={`cq-why ${p === q.answer ? 'ok' : 'no'}`} role="status">
                <b>{p === q.answer ? 'Right. ' : 'Not quite. '}</b><span dangerouslySetInnerHTML={{ __html: renderInline(q.why) }} />
              </p>
            )}
          </div>
        );
      })}
      {done && (
        <footer className="qcheck-foot">
          <b>{score}/{qs.length} correct.</b> {score === qs.length ? 'Solid — you are ready for the exercises.' : 'Re-read the explanations above, then try the exercises — they will cement it.'}
          <button className="btn sm ghost" onClick={() => setPicked({})}>Try again</button>
        </footer>
      )}
    </section>
  );
}

/* ───────────────────────── Runnable snippet ───────────────────────── */

export default function RunnableSnippet({ code: initial, lang, predict, types = false }: { code: string; lang: string; predict: boolean; types?: boolean }) {
  const isReact = lang === 'jsx' || lang === 'tsx';
  const edLang = isReact ? 'tsx' : lang === 'ts' ? 'ts' : 'js';
  const [code, setCode] = useState(initial);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [guess, setGuess] = useState('');
  const [revealed, setRevealed] = useState(!predict);
  const handle = useRef<ScratchHandle | PreviewHandle | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => () => handle.current?.stop(), []);
  const box = useRef<HTMLElement>(null);
  const started = useRef(false);

  const run = async () => {
    handle.current?.stop();
    setLogs([]);
    setStatus('running');
    setRevealed(true);
    if (types) {
      const r = await checkTypes({ tests: '' } as Exercise, code, performance.now());
      const errs = r.fatal ? [r.fatal] : (r.diagnostics ?? []).map((d) => `line ${d.line}: ${d.message}`);
      setLogs(errs.length ? errs.map((text) => ({ level: 'error' as const, text })) : [{ level: 'log' as const, text: '✓ No type errors — the compiler accepts this code.' }]);
      setStatus('done');
      return;
    }
    if (isReact) {
      if (host.current) handle.current = await mountPreview(code, host.current, (l) => setLogs((s) => [...s, l]));
      setStatus('done');
      return;
    }
    handle.current = runScratch(code, edLang === 'ts' ? 'ts' : 'js', (l) => setLogs((s) => [...s, l]), (fatal) => {
      if (fatal) setLogs((s) => [...s, { level: 'error', text: fatal }]);
      setStatus('done');
    });
  };
  // React snippets start themselves the first time they scroll into view, so the preview is never an empty box.
  useEffect(() => {
    if (!isReact || !box.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !started.current) { started.current = true; void run(); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reset = () => { handle.current?.stop(); setCode(initial); setLogs([]); setStatus('idle'); setRevealed(!predict); };
  const actual = logs.filter((l) => l.level !== 'error').map((l) => l.text).join('\n');
  const matches = predict && status === 'done' && guess.trim() !== '' && guess.trim().replace(/\s+/g, ' ') === actual.trim().replace(/\s+/g, ' ');

  return (
    <section className="snippet" aria-label="Try it yourself" ref={box}>
      <header className="snippet-head">
        <span><Icon name="play" size={11} /> {predict ? 'Predict, then run' : 'Try it — edit and run'}</span>
        <span className="grow" />
        <button className="btn sm ghost" onClick={reset}><Icon name="reset" size={13} /> Reset</button>
        <button className="btn sm primary" onClick={() => void run()} disabled={status === 'running' && !isReact}><Icon name="play" size={11} /> Run</button>
      </header>
      <div className="snippet-ed"><CodeEditor value={code} onChange={setCode} onRun={() => void run()} lang={edLang} label="Snippet editor" assist={false} /></div>
      {predict && (
        <label className="snippet-guess">
          <span>Before you run it: what will it print? <em>(one line per console.log)</em></span>
          <textarea rows={2} value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Type your guess…" spellCheck={false} />
        </label>
      )}
      {isReact && <div className="snippet-preview" ref={host} />}
      {(!isReact || logs.length > 0) && (
        <div className="snippet-out" aria-live="polite">
          <span className="snippet-out-h">{types ? 'Type checker' : 'Console'}</span>
          {!isReact && !revealed && <p className="muted">Write your guess, then press Run.</p>}
          {!isReact && revealed && logs.length === 0 && <p className="muted">{status === 'running' ? 'Running…' : 'Nothing yet — press Run.'}</p>}
          {revealed && logs.map((l, k) => <pre key={k} className={`sn-line ${l.level}`}>{l.text}</pre>)}
          {matches && <p className="snippet-ok">Your prediction matched. Nice.</p>}
          {predict && status === 'done' && guess.trim() !== '' && !matches && <p className="snippet-no">Different from your guess — trace it line by line to see why.</p>}
        </div>
      )}
    </section>
  );
}
