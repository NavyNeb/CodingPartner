import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/bits';
import { useReview } from '../lib/useReview';
import { DAY } from '../lib/review';

const REASON = { unsolved: 'Not solved yet', missed: 'You missed it last time', review: 'Time to refresh' } as const;

function when(due: number, now: number) {
  const d = Math.ceil((due - now) / DAY);
  if (d <= 0) return 'due now';
  return d === 1 ? 'tomorrow' : `in ${d} days`;
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
      </main>
    </>
  );
}
