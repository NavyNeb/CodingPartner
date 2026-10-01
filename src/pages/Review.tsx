import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tracks } from '../content';
import { createShare, deleteShare, listShares, useSync } from '../lib/sync';
import { trackStats } from '../lib/curriculum';
import { useProgress } from '../store/progress';
import { SiteHeader } from '../components/bits';
import { useReview } from '../lib/useReview';
import { DAY } from '../lib/review';

const REASON = { unsolved: 'Not solved yet', missed: 'You missed it last time', review: 'Time to refresh' } as const;

function when(due: number, now: number) {
  const d = Math.ceil((due - now) / DAY);
  if (d <= 0) return 'due now';
  return d === 1 ? 'tomorrow' : `in ${d} days`;
}

function ShareProgress({ streak }: { streak: number }) {
  const sync = useSync();
  const p = useProgress();
  const [shares, setShares] = useState<{ id: string; kind: string; createdAt: number }[]>([]);
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');
  const refresh = () => listShares().then((r) => setShares(r.shares), () => {});
  useEffect(() => { if (sync.hasProfile) void refresh(); }, [sync.hasProfile]);
  if (!sync.hasProfile) return sync.status === 'unavailable' ? null : <p className="muted" style={{ marginTop: 24 }}>Turn on Sync (top right) to share your progress with a link.</p>;
  const create = async () => {
    setErr('');
    try {
      const all = tracks.reduce((n, t) => n + trackStats(t.id, p).total, 0);
      const id = await createShare('progress', {
        solved: Object.keys(p.solved).length, total: all, streak,
        bestMock: p.mocks.length ? Math.max(...p.mocks.map((m) => m.score)) : null,
        tracks: tracks.map((t) => ({ title: t.title, ...trackStats(t.id, p) })),
      });
      setLink(new URL(`#/s/${id}`, document.baseURI).toString());
      void refresh();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <section className="mock-share">
      <h2 className="rv-h">Share</h2>
      <p className="muted">A public, read-only snapshot of your counts: no code, no account details.</p>
      <div className="sync-row"><button className="btn" onClick={create}>Share my progress</button></div>
      {link && <p><code className="recovery" data-testid="share-link">{link}</code></p>}
      {err && <p className="sync-err" role="alert">{err}</p>}
      {shares.length > 0 && (
        <ul className="rv-list quiet">
          {shares.map((s) => (
            <li key={s.id} className="rv-item">
              <span className="rv-main"><b>{s.kind === 'mock' ? 'Mock interview' : 'Progress'}</b><small><Link to={`/s/${s.id}`}>#/s/{s.id}</Link> · {new Date(s.createdAt).toLocaleDateString()}</small></span>
              <button className="btn ghost danger" onClick={() => { void deleteShare(s.id).then(refresh); }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Review() {
  const { queue, due, streak, now } = useReview();
  const upcoming = queue.filter((i) => i.due > now);
  const boxes = [1, 2, 3, 4, 5].map((b) => queue.filter((i) => i.box === b).length);
  return (
    <>
      <SiteHeader />
      <main className="wrap review">
        <p className="eyebrow">Spaced review</p>
        <h1 className="display sm">Review</h1>
        <p className="lede">
          Solving something once doesn't mean you will remember it in a month. Exercises come back after 1, 3, 7, 21 and 60 days — sooner
          if you missed one or needed the solution.
        </p>
        <dl className="hero-stats rv-stats">
          <div><dt>Due now</dt><dd>{due.length}</dd></div>
          <div><dt>Day streak</dt><dd>{streak}</dd></div>
          <div><dt>In rotation</dt><dd>{queue.length}</dd></div>
        </dl>

        {due.length === 0 ? (
          <div className="rv-empty">
            <p><b>Nothing due.</b> {queue.length ? 'Come back tomorrow, or keep going with new exercises.' : 'Solve a few exercises and they will show up here when it is time to revisit them.'}</p>
            <Link className="btn primary" to="/">Back to the roadmap</Link>
          </div>
        ) : (
          <>
            <h2 className="rv-h">Due now</h2>
            <ul className="rv-list">
              {due.map((i, idx) => (
                <li key={i.ex}>
                  <Link to={`/lesson/${i.lessonId}/${i.ex}`} className="rv-item" data-testid="review-item">
                    <span className="rv-n">{idx + 1}</span>
                    <span className="rv-main"><b>{i.title}</b><small>{i.lessonTitle}</small></span>
                    <span className="rv-tag">{REASON[i.reason]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <h2 className="rv-h">Coming up</h2>
            <ul className="rv-list quiet">
              {upcoming.slice(0, 12).map((i) => (
                <li key={i.ex}>
                  <Link to={`/lesson/${i.lessonId}/${i.ex}`} className="rv-item">
                    <span className="rv-main"><b>{i.title}</b><small>{i.lessonTitle}</small></span>
                    <span className="rv-tag">{when(i.due, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="rv-boxes" aria-label="Exercises per review box">Boxes: {boxes.map((n, k) => <span key={k}><b>{n}</b> at {[1, 3, 7, 21, 60][k]}d</span>)}</p>
          </>
        )}
        <ShareProgress streak={streak} />
      </main>
    </>
  );
}
