import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findLesson, tracks } from '../content';
import { DEFAULT_MINUTES, lessonStats } from '../lib/curriculum';
import { headingsOf } from '../lib/markdown';
import { checkKey, findBlocks } from '../lib/blocks';
import { useProgress } from '../store/progress';
import { Inline, Pips, Prose, SiteHeader, SolvedMark } from '../components/bits';
import { Icon } from '../components/Icon';
import { NotFound } from './NotFound';

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const found = findLesson(lessonId);
  if (!found) return <NotFound />;
  return <LessonView key={found.lesson.id} found={found} />;
}

function LessonView({ found }: { found: NonNullable<ReturnType<typeof findLesson>> }) {
  const { track, lesson, index } = found;
  const p = useProgress();
  const heads = useMemo(() => headingsOf(lesson.theory), [lesson.theory]);
  const blocks = useMemo(() => { try { return findBlocks(lesson.theory); } catch { return null; } }, [lesson.theory]);
  const [active, setActive] = useState<string>('');
  const st = lessonStats(lesson.id, p);
  const next = track.lessons[index + 1];
  const prev = track.lessons[index - 1];
  const nextUnsolved = lesson.exercises.find((e) => !p.solved[e.id]) ?? lesson.exercises[0];

  useEffect(() => { window.scrollTo(0, 0); }, [lesson.id]);

  useEffect(() => {
    const ids = [...heads.map((h) => h.id), 'practice'];
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [heads]);

  const trackIndex = tracks.findIndex((t) => t.id === track.id);

  return (
    <>
      <SiteHeader />
      <div className="wrap lesson-layout">
        <article className="lesson-article">
          <p className="eyebrow">
            <Link to="/">{String(trackIndex + 1).padStart(2, '0')} · {track.title}</Link> — Lesson {index + 1} of {track.lessons.length}
          </p>
          <h1 className="display sm">{lesson.title}</h1>
          <p className="lede"><Inline md={lesson.summary} /></p>
          <div className="lesson-actions">
            <button className="btn" onClick={() => document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth' })}>Jump to practice</button>
            <Link className="btn primary" to={`/lesson/${lesson.id}/${nextUnsolved.id}`}>
              {st.solved ? 'Continue practising' : 'Start practising'} <Icon name="arrowRight" size={14} />
            </Link>
          </div>

          {blocks && (blocks.tries.length > 0 || blocks.checks.length > 0) && (
            <nav className="rail" aria-label="Lesson steps">
              <a href="/" className="done" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>1 · Read</a>
              {blocks.tries.length > 0 && <a href="/" onClick={(e) => { e.preventDefault(); document.querySelector('.snippet')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>2 · Try ({blocks.tries.length})</a>}
              {blocks.checks.length > 0 && <a href="/" className={blocks.checkBodies.every((b) => p.checks[checkKey(b)]) ? 'done' : ''} onClick={(e) => { e.preventDefault(); document.querySelector('.qcheck')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>3 · Check{blocks.checkBodies.every((b) => p.checks[checkKey(b)]) ? ' ✓' : ''}</a>}
              <a href="/" className={st.solved === st.total ? 'done' : ''} onClick={(e) => { e.preventDefault(); document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth' }); }}>4 · Practice ({st.solved}/{st.total})</a>
            </nav>
          )}

          <Prose md={lesson.theory} />

          <section className="practice" aria-labelledby="practice">
            <h2 id="practice">Practice</h2>
            <p className="muted">{lesson.exercises.length} exercises, easiest first. Aim to solve them without opening the solution.</p>
            <ol className="ex-list">
              {lesson.exercises.map((e, i) => {
                const s = p.solved[e.id];
                return (
                  <li key={e.id}>
                    <Link className="ex-row" to={`/lesson/${lesson.id}/${e.id}`}>
                      <span className="ex-no">{i + 1}</span>
                      <span className="ex-name">{e.title}</span>
                      <Pips level={e.difficulty} label />
                      <span className="ex-time">~{e.minutes ?? DEFAULT_MINUTES[e.difficulty]} min</span>
                      <SolvedMark state={s ? (s.assisted ? 'assisted' : 'solved') : 'none'} />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>

          <nav className="pager" aria-label="Lesson navigation">
            {prev ? <Link to={`/lesson/${prev.id}`}><small>Previous</small>{prev.title}</Link> : <span />}
            {next ? <Link to={`/lesson/${next.id}`} className="right"><small>Next lesson</small>{next.title}</Link> : <span />}
          </nav>
        </article>

        <aside className="lesson-aside" aria-label="On this page">
          <p className="eyebrow">On this page</p>
          <ul>
            {heads.map((h) => (
              <li key={h.id}><a href={`/${h.id}`} className={active === h.id ? 'active' : ''} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }); }}><Inline md={h.text} /></a></li>
            ))}
            <li><a href="/" className={active === 'practice' ? 'active' : ''} onClick={(e) => { e.preventDefault(); document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth' }); }}>Practice ({st.solved}/{st.total})</a></li>
          </ul>
        </aside>
      </div>
    </>
  );
}
