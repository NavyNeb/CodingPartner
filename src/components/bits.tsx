import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink } from 'react-router-dom';
import { DIFFICULTY_LABEL, type Difficulty } from '../content/types';
import { renderInline, renderMarkdown } from '../lib/markdown';
import { Icon } from './Icon';
import { useProgress } from '../store/progress';
import SyncMenu from './SyncMenu';
import { useReview } from '../lib/useReview';
import { allExercises } from '../content';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Whetstone — home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--ink)" />
        <path d="M8 22 L20 8 L24 12 L12 26 Z" fill="var(--accent)" />
        <path d="M6 26 h20" stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>Whetstone</span>
    </Link>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('whetstone:theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const;
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export function Pips({ level, label }: { level: Difficulty; label?: boolean }) {
  return (
    <span className={`pips lvl-${level}`} title={DIFFICULTY_LABEL[level]}>
      <span className="pips-row" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}
      </span>
      {label ? <span className="pips-label">{DIFFICULTY_LABEL[level]}</span> : <span className="sr-only">{DIFFICULTY_LABEL[level]}</span>}
    </span>
  );
}

export function SolvedMark({ state }: { state: 'none' | 'solved' | 'assisted' }) {
  if (state === 'none') return <span className="solved-mark none" aria-label="Not solved yet" />;
  return (
    <span className={`solved-mark ${state}`} aria-label={state === 'assisted' ? 'Solved after viewing the solution' : 'Solved'} title={state === 'assisted' ? 'Solved after viewing the solution' : 'Solved'}>
      <Icon name="check" size={12} strokeWidth={2.6} />
    </span>
  );
}

const Stepper = lazy(() => import('./widgets').then((m) => ({ default: m.Stepper })));
const ConceptCheck = lazy(() => import('./widgets').then((m) => ({ default: m.ConceptCheck })));
const RunnableSnippet = lazy(() => import('./widgets'));

interface Mount { el: HTMLElement; kind: 'try' | 'check' | 'stepper' }

export function Prose({ md, className = '' }: { md: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(md), [md]);
  const root = useRef<HTMLDivElement>(null);
  const [mounts, setMounts] = useState<Mount[]>([]);

  // Interactive blocks are rendered as placeholders in the HTML, then mounted here as real React components.
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const found: Mount[] = [];
    host.querySelectorAll<HTMLElement>('.widget').forEach((el) => {
      el.replaceChildren();
      found.push({ el, kind: el.classList.contains('w-try') ? 'try' : el.classList.contains('w-check') ? 'check' : 'stepper' });
    });
    setMounts(found);

    // Play/pause for animated figures (paused by default when the user prefers reduced motion).
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cleanups: (() => void)[] = [];
    host.querySelectorAll<HTMLElement>('figure.fig[data-anim]').forEach((fig) => {
      const svg = fig.querySelector('svg') as SVGSVGElement | null;
      if (!svg || fig.querySelector('.fig-ctl')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fig-ctl';
      let playing = !reduce;
      const apply = () => {
        if (playing) svg.unpauseAnimations(); else { svg.pauseAnimations(); svg.setCurrentTime(0.1); }
        btn.textContent = playing ? 'Pause' : 'Play';
        btn.setAttribute('aria-pressed', String(!playing));
      };
      btn.onclick = () => { playing = !playing; apply(); };
      fig.querySelector('.fig-art')?.appendChild(btn);
      apply();
      cleanups.push(() => btn.remove());
    });
    return () => { cleanups.forEach((c) => c()); };
  }, [html]);

  return (
    <>
      <div ref={root} className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
      {mounts.map((m, i) => {
        const d = m.el.dataset;
        const dec = (v?: string) => decodeURIComponent(v ?? '');
        return createPortal(
          <Suspense fallback={<p className="muted">Loading…</p>}>
            {m.kind === 'try' && <RunnableSnippet code={dec(d.code)} lang={d.lang ?? 'js'} predict={d.predict === '1'} types={d.types === '1'} />}
            {m.kind === 'check' && <ConceptCheck body={dec(d.body)} />}
            {m.kind === 'stepper' && <Stepper info={dec(d.info)} body={dec(d.body)} />}
          </Suspense>,
          m.el,
          `${m.kind}-${i}`,
        );
      })}
    </>
  );
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  const p = useProgress();
  const solved = Object.keys(p.solved).length;
  const due = useReview().due.length;
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <Logo />
        <nav className="site-nav" aria-label="Primary">
          <NavLink to="/" end>Roadmap</NavLink>
          <NavLink to="/review">Review{due ? <span className="nav-badge">{due}</span> : null}</NavLink>
          <NavLink to="/playground">Playground</NavLink>
          <NavLink to="/glossary">Glossary</NavLink>
        </nav>
        <div className="site-header-right">
          {children}
          <span className="tally" title="Exercises solved">
            <b>{solved}</b>/{allExercises.length}
          </span>
          <SyncMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function Inline({ md, as: Tag = 'span' }: { md: string; as?: 'span' | 'p' | 'strong' }) {
  return <Tag dangerouslySetInnerHTML={{ __html: renderInline(md) }} />;
}
