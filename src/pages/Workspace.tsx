import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { findLesson } from '../content';
import { DIFFICULTY_LABEL, type Exercise } from '../content/types';
import { runExercise, type RunReport } from '../runner/execute';
import { progress, useProgress } from '../store/progress';
import { DEFAULT_MINUTES, nextAfter, prevBefore } from '../lib/curriculum';
import { codeBlock } from '../lib/markdown';
import { CodeEditor, type EditorHandle } from '../components/CodeEditor';
import { Split } from '../components/Split';
import { ResultsPanel } from '../components/Results';
import { Icon } from '../components/Icon';
import { Logo, Pips, Prose, ThemeToggle } from '../components/bits';
import { useAssist } from '../lib/useAssist';
import MockBar from '../components/MockBar';
import { mock, useMock } from '../lib/mock';
import { NotFound } from './NotFound';

type LeftTab = 'task' | 'lesson' | 'hints' | 'tests' | 'solution';

export default function Workspace() {
  const { lessonId = '', exId = '' } = useParams();
  const found = findLesson(lessonId);
  const exercise = found?.lesson.exercises.find((e) => e.id === exId);
  if (!found || !exercise) return <NotFound />;
  return <WorkspaceInner key={exercise.id} lessonId={found.lesson.id} lessonTitle={found.lesson.title} theory={found.lesson.theory} exercise={exercise} />;
}

function WorkspaceInner({ lessonId, lessonTitle, theory, exercise }: { lessonId: string; lessonTitle: string; theory: string; exercise: Exercise }) {
  const nav = useNavigate();
  const p = useProgress();
  const editor = useRef<EditorHandle>(null);
  const [code, setCode] = useState(() => p.drafts[exercise.id] ?? exercise.starter);
  const [report, setReport] = useState<RunReport | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<LeftTab>('task');
  const [confirmReset, setConfirmReset] = useState(false);
  const [assistPref, setAssistPref] = useAssist();
  const runId = useRef(0);
  const solved = p.solved[exercise.id];
  const session = useMock();
  const inMock = !!session && !session.finishedAt && session.exIds.includes(exercise.id);
  const timed = p.timed || inMock;
  const assist = assistPref && !timed;
  const prev = prevBefore(lessonId, exercise.id);
  const next = nextAfter(lessonId, exercise.id);
  const number = (findLesson(lessonId)?.lesson.exercises.findIndex((e) => e.id === exercise.id) ?? 0) + 1;

  useEffect(() => { progress.setLast(lessonId, exercise.id); }, [lessonId, exercise.id]);

  // Debounced draft autosave (skip when the code is still the untouched starter).
  useEffect(() => {
    const t = setTimeout(() => {
      if (code === exercise.starter) progress.clearDraft(exercise.id);
      else progress.saveDraft(exercise.id, code);
    }, 500);
    return () => clearTimeout(t);
  }, [code, exercise]);

  const run = useCallback(async () => {
    const id = ++runId.current;
    setRunning(true);
    try {
      const r = await runExercise(exercise, code);
      if (id !== runId.current) return;
      setReport(r);
      const total = Math.max(r.tests.length, 1);
      progress.logAttempt({
        ex: exercise.id,
        passed: r.tests.filter((t) => t.status === 'pass').length,
        total,
        assisted: !!progress.get().solutionSeen[exercise.id],
        ms: r.ms,
      });
      mock.record(exercise.id, r.tests.filter((t) => t.status === 'pass').length, total, r.ms);
      if (r.passed) progress.markSolved(exercise.id);
    } catch (e) {
      if (id === runId.current) setReport({ tests: [], logs: [], fatal: String((e as Error).message ?? e), ms: 0, passed: false });
    } finally {
      if (id === runId.current) setRunning(false);
    }
  }, [exercise, code]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return; }
    setCode(exercise.starter);
    progress.clearDraft(exercise.id);
    setReport(null);
    setConfirmReset(false);
  };

  const errorLines = useMemo(() => report?.diagnostics?.map((d) => d.line).filter((n) => n > 0) ?? [], [report]);
  const allPassed = !!report?.passed;
  const leftTabs: { id: LeftTab; label: string; icon: string; hiddenInTimed?: boolean }[] = [
    { id: 'task', label: 'Task', icon: 'list' },
    { id: 'lesson', label: 'Lesson', icon: 'book', hiddenInTimed: true },
    { id: 'hints', label: 'Hints', icon: 'bulb', hiddenInTimed: true },
    { id: 'tests', label: 'Tests', icon: 'flask' },
    { id: 'solution', label: 'Solution', icon: 'key', hiddenInTimed: true },
  ];
  const visibleTabs = leftTabs.filter((t) => !(timed && t.hiddenInTimed));
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : 'task';

  return (
    <div className="workspace">
      <header className="ws-bar">
        <Logo />
        <span className="ws-sep" aria-hidden="true" />
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to={`/lesson/${lessonId}`}>{lessonTitle}</Link>
          <Icon name="chevronRight" size={12} />
          <span aria-current="page">{number}. {exercise.title}</span>
        </nav>
        <Pips level={exercise.difficulty} label />
        <div className="ws-bar-right">
          <Timer exercise={exercise} active={timed && !solved && !inMock} />
          <button className={`chip-btn${timed ? ' on' : ''}`} disabled={inMock} onClick={() => progress.setTimed(!timed)} aria-pressed={timed} title="Interview mode: countdown, no hints, no solution">
            <Icon name="timer" size={14} /> Timed
          </button>
          <span className="ws-sep" aria-hidden="true" />
          <button className="icon-btn" disabled={!prev} onClick={() => prev && nav(`/lesson/${prev.lesson.id}/${prev.exercise.id}`)} aria-label="Previous exercise" title="Previous exercise"><Icon name="arrowLeft" /></button>
          <button className="icon-btn" disabled={!next} onClick={() => next && nav(`/lesson/${next.lesson.id}/${next.exercise.id}`)} aria-label="Next exercise" title="Next exercise"><Icon name="arrowRight" /></button>
          <ThemeToggle />
        </div>
      </header>

      <MockBar exId={exercise.id} />

      <main className="ws-main">
        <Split
          dir="row" storageKey="whetstone:split:main" initial={0.42} min={0.22} max={0.7} label="Resize task and editor panels"
          first={
            <div className="left-panel">
              <div className="tabs" role="tablist" aria-label="Exercise sections">
                {visibleTabs.map((t) => (
                  <button key={t.id} role="tab" aria-selected={activeTab === t.id} className="tab" onClick={() => setTab(t.id)}>
                    <Icon name={t.icon} size={14} /> {t.label}
                  </button>
                ))}
              </div>
              <div className="left-body" role="tabpanel">
                {activeTab === 'task' && (
                  <article>
                    <p className="eyebrow">Exercise {number} · {DIFFICULTY_LABEL[exercise.difficulty]} · ~{exercise.minutes ?? DEFAULT_MINUTES[exercise.difficulty]} min · {exercise.kind === 'react' ? 'React' : exercise.kind === 'types' ? 'Types' : exercise.lang === 'ts' ? 'TypeScript' : 'JavaScript'}</p>
                    <h1 className="ex-title">{exercise.title}{exercise.guided && <span className="guided-chip">Guided</span>}</h1>
                    {exercise.guided && <p className="note">Guided exercise: the skeleton is filled in and the numbered steps in the comments walk you through it. Complete them one at a time, running the tests as you go.</p>}
                    <Prose md={exercise.prompt} />
                    {exercise.worked && !timed && (
                      <details className="worked">
                        <summary><Icon name="book" size={14} /> See a worked example first</summary>
                        <Prose md={exercise.worked} />
                      </details>
                    )}
                    {exercise.kind === 'types' && <p className="note">Your types are checked by the real TypeScript compiler in <code>strict</code> mode. No errors means every case passes.</p>}
                  </article>
                )}
                {activeTab === 'lesson' && (
                  <article>
                    <p className="eyebrow">Lesson</p>
                    <h1 className="ex-title">{lessonTitle}</h1>
                    <Prose md={theory} />
                  </article>
                )}
                {activeTab === 'hints' && <Hints exercise={exercise} revealed={p.hints[exercise.id] ?? 0} />}
                {activeTab === 'tests' && (
                  <article>
                    <p className="eyebrow">Test source</p>
                    {exercise.explain && (
                      <div className="explain">
                        <p className="eyebrow">What the tests check — in plain English</p>
                        <Prose md={exercise.explain} />
                      </div>
                    )}
                    <p className="muted">This is exactly what runs against your code. Read it like a spec.</p>
                    <div dangerouslySetInnerHTML={{ __html: codeBlock(exercise.tests, exercise.kind === 'react' ? 'tsx' : exercise.kind === 'types' ? 'ts' : 'js') }} />
                  </article>
                )}
                {activeTab === 'solution' && <Solution exercise={exercise} solved={!!solved} seen={!!p.solutionSeen[exercise.id]} onLoad={() => { setCode(exercise.solution); setTab('task'); }} />}
              </div>
            </div>
          }
          second={
            <Split
              dir="col" storageKey="whetstone:split:results" initial={0.58} min={0.25} max={0.85} label="Resize editor and results"
              first={
                <div className="editor-panel">
                  <div className="editor-bar">
                    <span className="file-name">{exercise.kind === 'types' ? 'types.ts' : exercise.lang === 'tsx' ? 'solution.tsx' : exercise.lang === 'ts' ? 'solution.ts' : 'solution.js'}</span>
                    <span className="grow" />
                    <button
                      className={`chip-btn${assist ? ' on' : ''}`}
                      onClick={() => setAssistPref(!assistPref)}
                      aria-pressed={assist}
                      disabled={timed}
                      title={timed ? 'Autocomplete is off in interview mode' : 'Toggle editor autocomplete'}
                    >
                      Autocomplete
                    </button>
                    <button className={`btn ghost${confirmReset ? ' danger' : ''}`} onClick={reset}>
                      <Icon name="reset" size={14} /> {confirmReset ? 'Click again to reset' : 'Reset'}
                    </button>
                    <button className="btn primary" onClick={() => void run()} disabled={running}>
                      <Icon name="play" size={12} /> {running ? 'Running…' : 'Run tests'} <kbd>⌘↵</kbd>
                    </button>
                  </div>
                  <CodeEditor ref={editor} value={code} onChange={setCode} onRun={() => void run()} lang={exercise.lang} errorLines={errorLines} label="Code editor" assist={assist} />
                </div>
              }
              second={
                <ResultsPanel
                  report={report}
                  running={running}
                  onJump={(l) => editor.current?.jumpToLine(l)}
                  footer={allPassed ? (
                    <div className="banner good" role="status">
                      <div>
                        <b>All tests pass.</b>{' '}
                        {solved?.assisted ? 'Counted as solved with help — try it again from scratch in a few days.' : 'Nice. Compare with the reference solution to see other approaches.'}
                      </div>
                      {next && <button className="btn primary sm" onClick={() => nav(`/lesson/${next.lesson.id}/${next.exercise.id}`)}>Next exercise <Icon name="arrowRight" size={14} /></button>}
                    </div>
                  ) : undefined}
                />
              }
            />
          }
        />
      </main>
    </div>
  );
}

function Hints({ exercise, revealed }: { exercise: Exercise; revealed: number }) {
  const total = exercise.hints.length;
  return (
    <article>
      <p className="eyebrow">Hints</p>
      <p className="muted">Struggle first — a hint you earn sticks. They get more specific as you go.</p>
      {exercise.nudge && (
        <div className="nudge">
          <p className="eyebrow">Stuck? Think about…</p>
          <Prose md={exercise.nudge} className="tight" />
        </div>
      )}
      <ol className="hint-list">
        {exercise.hints.slice(0, revealed).map((h, i) => (
          <li key={i}><span className="hint-n">{i + 1}</span><Prose md={h} className="tight" /></li>
        ))}
      </ol>
      {revealed < total ? (
        <button className="btn" onClick={() => progress.revealHint(exercise.id, revealed + 1)}>
          <Icon name="bulb" size={14} /> Reveal hint {revealed + 1} of {total}
        </button>
      ) : (
        <p className="muted">That’s every hint. {`The solution tab is next if you’re truly stuck.`}</p>
      )}
    </article>
  );
}

function Solution({ exercise, solved, seen, onLoad }: { exercise: Exercise; solved: boolean; seen: boolean; onLoad: () => void }) {
  const [ack, setAck] = useState(false);
  const open = solved || seen;
  if (!open) {
    return (
      <article className="gate">
        <span className="gate-icon"><Icon name="lock" size={20} /></span>
        <h2>Try before you peek</h2>
        <p>Reading a solution feels like learning; writing one is learning. If you view it before your tests pass, this exercise is marked as <em>solved with help</em>.</p>
        <label className="check">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          I’ve made a real attempt and read the hints.
        </label>
        <button className="btn" disabled={!ack} onClick={() => progress.markSolutionSeen(exercise.id)}>Show the solution</button>
      </article>
    );
  }
  return (
    <article>
      <p className="eyebrow">Reference solution</p>
      <p className="muted">One good answer, not the only one. Ask yourself: what would break if the input were empty, huge, or hostile?</p>
      <div dangerouslySetInnerHTML={{ __html: codeBlock(exercise.solution, exercise.lang) }} />
      <button className="btn" onClick={onLoad}><Icon name="copy" size={14} /> Load into editor</button>
    </article>
  );
}

function Timer({ exercise, active }: { exercise: Exercise; active: boolean }) {
  const total = (exercise.minutes ?? DEFAULT_MINUTES[exercise.difficulty]) * 60;
  const [left, setLeft] = useState(total);
  useEffect(() => { if (!active) return; setLeft(total); const id = setInterval(() => setLeft((s) => s - 1), 1000); return () => clearInterval(id); }, [active, total]);
  if (!active) return null;
  const over = left < 0;
  const abs = Math.abs(left);
  const label = `${over ? '+' : ''}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return <span className={`timer${over ? ' over' : left < 60 ? ' low' : ''}`} role="timer" aria-label={over ? 'Over time' : 'Time left'}>{label}</span>;
}
