import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { allExercises } from '../content';
import { mock, useMock } from '../lib/mock';
import { progress } from '../store/progress';

export function finishMock(): string | null {
  const r = mock.toResult();
  if (!r || !mock.get() || mock.get()!.finishedAt) return null;
  const saved = progress.addMock(r);
  mock.finish(saved.id);
  return saved.id;
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Slim bar shown in the workspace while a mock interview is running and this exercise is part of it. */
export default function MockBar({ exId }: { exId: string }) {
  const s = useMock();
  const nav = useNavigate();
  const [now, setNow] = useState(Date.now());
  const active = !!s && !s.finishedAt && s.exIds.includes(exId);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  const left = s ? Math.round((s.startedAt + s.minutes * 60_000 - now) / 1000) : 0;
  useEffect(() => {
    if (active && left <= 0) { finishMock(); nav('/mock'); }
  }, [active, left, nav]);
  if (!active || !s) return null;
  return (
    <div className="mock-bar" role="region" aria-label="Mock interview">
      <b>Mock interview</b>
      <span className={`timer${left < 120 ? ' low' : ''}`} role="timer" aria-label="Time left in the interview">{fmt(Math.max(left, 0))}</span>
      <nav className="mock-steps" aria-label="Interview problems">
        {s.exIds.map((id, i) => {
          const e = allExercises.find((x) => x.exercise.id === id);
          const r = s.results[id];
          const done = r && r.passed === r.total;
          return (
            <Link key={id} to={`/lesson/${e?.lesson.id}/${id}`} className={`mock-step${id === exId ? ' cur' : ''}${done ? ' done' : ''}`} aria-current={id === exId ? 'step' : undefined}>
              {i + 1}. {e?.exercise.title}{done ? ' ✓' : r ? ` ${r.passed}/${r.total}` : ''}
            </Link>
          );
        })}
      </nav>
      <button className="btn" onClick={() => { if (confirm('Finish the interview now and see your report?')) { finishMock(); nav('/mock'); } }}>Finish</button>
    </div>
  );
}
