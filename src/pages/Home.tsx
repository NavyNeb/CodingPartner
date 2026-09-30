import { Link } from 'react-router-dom';
import { allExercises, tracks } from '../content';
import { resumePoint, trackStats, lessonStats } from '../lib/curriculum';
import { useProgress } from '../store/progress';
import { Inline, Pips, SiteHeader, SolvedMark } from '../components/bits';
import { Icon } from '../components/Icon';

export default function Home() {
  const p = useProgress();
  const resume = resumePoint(p);
  const solved = Object.keys(p.solved).length;
  const lessonCount = tracks.reduce((n, t) => n + t.lessons.length, 0);
  const target = resume ? `/lesson/${resume.item.lesson.id}/${resume.item.exercise.id}` : '/';

  return (
    <>
      <SiteHeader />
      <main>
        <section className="wrap hero">
          <div className="hero-copy">
            <p className="eyebrow">JavaScript · TypeScript · React</p>
            <h1 className="display">Get sharp <em>again.</em></h1>
            <p className="lede">
              A practice-first gym for the language you use every day. A short lesson on the idea, then real code against real tests —
              from warm-ups to the problems that decide senior interviews. Nothing writes the answer for you.
            </p>
            <div className="hero-actions">
              {resume ? (
                <Link className="btn primary lg" to={target}>
                  {resume.verb === 'Start' ? 'Start with closures' : `Continue: ${resume.item.exercise.title}`} <Icon name="arrowRight" size={16} />
                </Link>
              ) : (
                <span className="btn lg" aria-disabled="true">Everything solved — go again in a week</span>
              )}
              <Link className="btn lg" to="/playground">Open the playground</Link>
            </div>
            <dl className="hero-stats">
              <div><dt>Exercises</dt><dd>{allExercises.length}</dd></div>
              <div><dt>Lessons</dt><dd>{lessonCount}</dd></div>
              <div><dt>Solved</dt><dd>{solved}</dd></div>
            </dl>
          </div>

          <figure className="hero-art" aria-label="Example of a failing test run">
            <div className="mock">
              <div className="mock-bar"><i /><i /><i /><span>closures › once()</span></div>
              <div className="mock-body">
                <p className="m-fail">✕ calls the function only once</p>
                <p className="m-pass">✓ returns the first result every time</p>
                <p className="m-pass">✓ forwards arguments, ignores later ones</p>
                <p className="m-fail">✕ preserves `this`</p>
                <pre className="m-err">{`expect(received).toBe(expected)

Expected: 7
Received: undefined`}</pre>
                <p className="m-dim">2 of 6 passing — read the failure, then fix one thing.</p>
              </div>
            </div>
          </figure>
        </section>

        <section className="wrap method" aria-label="How it works">
          <ol>
            <li><span>01</span><h3>Read the idea</h3><p>Ten focused minutes per lesson. Mental models, not trivia — plus the traps interviewers set.</p></li>
            <li><span>02</span><h3>Write it yourself</h3><p>A real editor, real tests, no scaffolding. Difficulty climbs from warm-up to interview grade.</p></li>
            <li><span>03</span><h3>Read the failure</h3><p>Tests explain themselves. Hints are rationed; the solution is gated and remembered as “assisted”.</p></li>
            <li><span>04</span><h3>Go timed</h3><p>Interview mode adds a countdown and takes the safety nets away. That’s the real exam.</p></li>
          </ol>
        </section>

        <section className="wrap roadmap" id="roadmap" aria-labelledby="roadmap-title">
          <h2 id="roadmap-title" className="section-title">Roadmap</h2>
          {tracks.map((t, ti) => {
            const st = trackStats(t.id, p);
            return (
              <div className="track" key={t.id}>
                <div className="track-head">
                  <span className="track-no">{String(ti + 1).padStart(2, '0')}</span>
                  <h3>{t.title}</h3>
                  <Inline as="p" md={t.blurb} />
                  <div className="track-progress">
                    <span><b>{st.solved}</b> of {st.total} solved</span>
                    <span className="bar" role="presentation"><i style={{ width: `${st.total ? (st.solved / st.total) * 100 : 0}%` }} /></span>
                  </div>
                </div>
                <ol className="lesson-list">
                  {t.lessons.map((l, li) => {
                    const ls = lessonStats(l.id, p);
                    return (
                      <li key={l.id}>
                        <Link className="lesson-row" to={`/lesson/${l.id}`}>
                          <span className="lesson-no">{ti + 1}.{li + 1}</span>
                          <span className="lesson-text">
                            <strong>{l.title}</strong>
                            <Inline md={l.summary} />
                          </span>
                          <span className="lesson-meta">
                            <span className="squares" aria-hidden="true">
                              {l.exercises.map((e) => <i key={e.id} className={`sq d${e.difficulty}${p.solved[e.id] ? ' done' : ''}`} />)}
                            </span>
                            <span className="frac">{ls.solved}/{ls.total}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </section>

        <section className="wrap legend" aria-label="Difficulty legend">
          <span className="eyebrow">Difficulty</span>
          {[1, 2, 3, 4].map((d) => <Pips key={d} level={d as 1 | 2 | 3 | 4} label />)}
          <span className="legend-note"><SolvedMark state="solved" /> solved <SolvedMark state="assisted" /> solved with the solution</span>
        </section>
      </main>
      <footer className="site-footer wrap">
        <span>Whetstone — progress is saved in this browser only.</span>
        <button className="link-btn" onClick={() => { if (confirm('Erase all progress and drafts in this browser?')) { import('../store/progress').then((m) => m.progress.resetAll()); } }}>Reset progress</button>
      </footer>
    </>
  );
}
