import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteHeader } from '../components/bits';
import { finishMock } from '../components/MockBar';
import { allExercises, findLesson, tracks } from '../content';
import { LEVELS, mock, pickExercises, ratio, useMock, verdict, type Level } from '../lib/mock';
import { createShare, useSync } from '../lib/sync';
import { useProgress } from '../store/progress';

const mins = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

function Setup() {
  const nav = useNavigate();
  const p = useProgress();
  const [level, setLevel] = useState<Level>('mid');
  const [picked, setPicked] = useState<string[]>([]);
  const cands = useMemo(() => allExercises.map((e) => ({ id: e.exercise.id, lessonId: e.lesson.id, trackId: e.track.id, difficulty: e.exercise.difficulty, guided: e.exercise.guided })), []);
  const toggle = (id: string) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const start = () => {
    const ids = pickExercises(cands, { tracks: picked, level, solved: p.solved });
    if (!ids.length) return;
    mock.start(level, ids);
    const first = allExercises.find((e) => e.exercise.id === ids[0])!;
    nav(`/lesson/${first.lesson.id}/${first.exercise.id}`);
  };
  return (
    <>
      <p className="lede">Three problems, one clock, no hints, no solutions, no autocomplete. Like the real thing, but nobody is watching. You get a report at the end.</p>
      <h2 className="rv-h">Level</h2>
      <div className="mock-levels" role="radiogroup" aria-label="Level">
        {(Object.keys(LEVELS) as Level[]).map((l) => (
          <button key={l} role="radio" aria-checked={level === l} className={`mock-level${level === l ? ' on' : ''}`} onClick={() => setLevel(l)}>
            <b>{LEVELS[l].label}</b><small>{LEVELS[l].blurb}</small>
          </button>
        ))}
      </div>
      <h2 className="rv-h">Topics <small className="muted">(none selected = everything)</small></h2>
      <div className="mock-topics">
        {tracks.map((t) => (
          <label key={t.id} className={`mock-topic${picked.includes(t.id) ? ' on' : ''}`}>
            <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} /> {t.title}
          </label>
        ))}
      </div>
      <p className="mock-note">Scoring is simple: the share of tests you pass on each problem, averaged. It is a practice signal, not a hiring-grade assessment.</p>
      <button className="btn primary lg" onClick={start}>Start the interview ({LEVELS[level].minutes} min)</button>
    </>
  );
}

function Running({ ids }: { ids: string[] }) {
  const nav = useNavigate();
  return (
    <>
      <p className="lede">An interview is in progress. Open a problem to keep going; the clock keeps running.</p>
      <ul className="rv-list">
        {ids.map((id, i) => {
          const e = allExercises.find((x) => x.exercise.id === id)!;
          return (
            <li key={id}><Link className="rv-item" to={`/lesson/${e.lesson.id}/${id}`}><span className="rv-n">{i + 1}</span><span className="rv-main"><b>{e.exercise.title}</b><small>{e.lesson.title}</small></span></Link></li>
          );
        })}
      </ul>
      <div className="sync-row" style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={() => { finishMock(); }}>Finish and see the report</button>
        <button className="btn ghost" onClick={() => { if (confirm('Abandon this interview without a report?')) { mock.clear(); nav('/mock'); } }}>Abandon</button>
      </div>
    </>
  );
}

function Report() {
  const s = useMock()!;
  const p = useProgress();
  const sync = useSync();
  const result = p.mocks.find((m) => m.id === s.resultId);
  const [withCode, setWithCode] = useState(false);
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');
  if (!result) return <p>Report unavailable.</p>;
  const rows = result.items.map((i) => {
    const e = allExercises.find((x) => x.exercise.id === i.ex);
    return { ...i, title: e?.exercise.title ?? i.ex, lessonId: e?.lesson.id ?? '', lessonTitle: e?.lesson.title ?? '', difficulty: e?.exercise.difficulty ?? 1 };
  });
  const weak = rows.filter((r) => ratio(r) < 1);
  const share = async () => {
    setErr('');
    try {
      const payload = {
        score: result.score, minutes: result.minutes, at: result.at, level: s.level,
        items: rows.map((r) => ({
          title: r.title, lesson: r.lessonTitle, difficulty: r.difficulty, passed: r.passed, total: r.total, ms: r.ms,
          ...(withCode && p.drafts[r.ex] ? { code: p.drafts[r.ex].slice(0, 8000) } : {}),
        })),
      };
      const id = await createShare('mock', payload);
      setLink(new URL(`#/s/${id}`, document.baseURI).toString());
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <div className="mock-score"><span className="mock-big" data-testid="mock-score">{result.score}</span><span>/100<br /><small>{verdict(result.score)}</small></span></div>
      <ul className="rv-list">
        {rows.map((r) => (
          <li key={r.ex} className="rv-item">
            <span className={`rv-n${ratio(r) === 1 ? ' ok' : ''}`}>{ratio(r) === 1 ? '✓' : '·'}</span>
            <span className="rv-main"><b>{r.title}</b><small>{r.lessonTitle}</small></span>
            <span className="rv-tag">{r.passed}/{r.total} tests{r.ms ? ` · ${mins(r.ms)}` : ''}</span>
          </li>
        ))}
      </ul>
      {weak.length > 0 && (
        <>
          <h2 className="rv-h">Revisit</h2>
          <ul className="mock-weak">
            {weak.map((r) => <li key={r.ex}>Re-read <Link to={`/lesson/${r.lessonId}`}>{findLesson(r.lessonId)?.lesson.title}</Link> and retry <Link to={`/lesson/${r.lessonId}/${r.ex}`}>{r.title}</Link>.</li>)}
          </ul>
        </>
      )}
      <div className="sync-row" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={() => { mock.clear(); }}>Run another interview</button>
        <Link className="btn" to="/review">Go to review</Link>
      </div>
      {sync.hasProfile ? (
        <div className="mock-share">
          <h2 className="rv-h">Share this result</h2>
          <p className="muted">Creates a public, read-only page. It shows the score and problem names — no account details.</p>
          <label className="check-line"><input type="checkbox" checked={withCode} onChange={(e) => setWithCode(e.target.checked)} /> Include my final code</label>
          <div className="sync-row"><button className="btn" onClick={share} disabled={!!link}>Create share link</button></div>
          {link && <p><code className="recovery" data-testid="share-link">{link}</code></p>}
          {err && <p className="sync-err" role="alert">{err}</p>}
        </div>
      ) : sync.status !== 'unavailable' ? (
        <p className="muted" style={{ marginTop: 14 }}>Turn on Sync (top right) to get a link you can share.</p>
      ) : null}
    </>
  );
}

export default function Mock() {
  const s = useMock();
  useProgress();
  return (
    <>
      <SiteHeader />
      <main className="wrap review">
        <p className="eyebrow">Practice under pressure</p>
        <h1 className="display sm">Mock interview</h1>
        {!s ? <Setup /> : s.finishedAt ? <Report /> : <Running ids={s.exIds} />}
      </main>
    </>
  );
}
