import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SiteHeader } from '../components/bits';
import { fetchShare } from '../lib/sync';

interface Share { kind: 'progress' | 'mock'; createdAt: number; payload: any }
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Public, read-only view of a shared snapshot. Everything is rendered as plain text (React escapes it). */
export default function Shared() {
  const { id = '' } = useParams();
  const [share, setShare] = useState<Share | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { fetchShare(id).then(setShare, (e: Error) => setErr(e.message)); }, [id]);

  return (
    <>
      <SiteHeader />
      <main className="wrap review">
        <p className="eyebrow">Shared on Whetstone</p>
        {err && <><h1 className="display sm">Link not found</h1><p className="lede">{err}</p></>}
        {!share && !err && <p className="muted">Loading…</p>}
        {share?.kind === 'mock' && (
          <>
            <h1 className="display sm">Mock interview result</h1>
            <div className="mock-score"><span className="mock-big">{num(share.payload.score)}</span><span>/100<br /><small>{num(share.payload.minutes)}-minute session · {new Date(share.createdAt).toLocaleDateString()}</small></span></div>
            <ul className="rv-list">
              {(Array.isArray(share.payload.items) ? share.payload.items : []).slice(0, 10).map((it: any, i: number) => (
                <li key={i} className="shared-item">
                  <div className="rv-item">
                    <span className="rv-main"><b>{str(it.title)}</b><small>{str(it.lesson)}</small></span>
                    <span className="rv-tag">{num(it.passed)}/{num(it.total)} tests</span>
                  </div>
                  {str(it.code) && <pre className="shared-code"><code>{str(it.code)}</code></pre>}
                </li>
              ))}
            </ul>
          </>
        )}
        {share?.kind === 'progress' && (
          <>
            <h1 className="display sm">Progress snapshot</h1>
            <dl className="hero-stats rv-stats">
              <div><dt>Solved</dt><dd>{num(share.payload.solved)}/{num(share.payload.total)}</dd></div>
              <div><dt>Day streak</dt><dd>{num(share.payload.streak)}</dd></div>
              <div><dt>Best mock</dt><dd>{share.payload.bestMock == null ? '—' : num(share.payload.bestMock)}</dd></div>
            </dl>
            <ul className="rv-list">
              {(Array.isArray(share.payload.tracks) ? share.payload.tracks : []).slice(0, 20).map((t: any, i: number) => (
                <li key={i} className="rv-item"><span className="rv-main"><b>{str(t.title)}</b></span><span className="rv-tag">{num(t.solved)}/{num(t.total)}</span></li>
              ))}
            </ul>
          </>
        )}
        <p style={{ marginTop: 28 }}><Link className="btn" to="/">Practice on Whetstone</Link></p>
      </main>
    </>
  );
}
