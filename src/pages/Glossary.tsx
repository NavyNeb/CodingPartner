import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { glossary } from '../content/glossary';
import { findLesson } from '../content';
import { SiteHeader } from '../components/bits';

export default function Glossary() {
  const [q, setQ] = useState('');
  const terms = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...glossary]
      .sort((a, b) => a.term.localeCompare(b.term))
      .filter((t) => !needle || t.term.toLowerCase().includes(needle) || t.def.toLowerCase().includes(needle));
  }, [q]);
  return (
    <>
      <SiteHeader />
      <div className="wrap glossary">
        <p className="eyebrow">Plain-English terms</p>
        <h1 className="display sm">Glossary</h1>
        <p className="lede">Short definitions for the words used across the lessons. Each links to where the idea is taught.</p>
        <label className="gl-search">
          <span className="sr-only">Search terms</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms…" />
        </label>
        <dl className="gl-list">
          {terms.map((t) => {
            const lesson = findLesson(t.lesson);
            return (
              <div key={t.term} className="gl-item">
                <dt>{t.term}</dt>
                <dd>
                  {t.def}
                  {lesson && <> <Link to={`/lesson/${t.lesson}`}>Learn it: {lesson.lesson.title}</Link></>}
                </dd>
              </div>
            );
          })}
          {terms.length === 0 && <p className="muted">No terms match “{q}”.</p>}
        </dl>
      </div>
    </>
  );
}
