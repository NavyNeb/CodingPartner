import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { DIFFICULTY_LABEL, type Difficulty } from '../content/types';
import { renderInline, renderMarkdown } from '../lib/markdown';
import { Icon } from './Icon';
import { useProgress } from '../store/progress';
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

export function Prose({ md, className = '' }: { md: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(md), [md]);
  return <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  const p = useProgress();
  const solved = Object.keys(p.solved).length;
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <Logo />
        <nav className="site-nav" aria-label="Primary">
          <NavLink to="/" end>Roadmap</NavLink>
          <NavLink to="/playground">Playground</NavLink>
        </nav>
        <div className="site-header-right">
          {children}
          <span className="tally" title="Exercises solved">
            <b>{solved}</b>/{allExercises.length}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function Inline({ md, as: Tag = 'span' }: { md: string; as?: 'span' | 'p' | 'strong' }) {
  return <Tag dangerouslySetInnerHTML={{ __html: renderInline(md) }} />;
}
