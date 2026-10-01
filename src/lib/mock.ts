import { useSyncExternalStore } from 'react';
import type { MockResult } from './syncMerge';

export type Level = 'warm' | 'mid' | 'senior';

export const LEVELS: Record<Level, { label: string; blurb: string; difficulties: number[]; minutes: number }> = {
  warm: { label: 'Warm-up', blurb: 'Two quick ones and a medium. 30 minutes.', difficulties: [1, 2, 2], minutes: 30 },
  mid: { label: 'Mid-level', blurb: 'Medium problems, one a little harder. 45 minutes.', difficulties: [2, 3, 3], minutes: 45 },
  senior: { label: 'Senior', blurb: 'Hard problems and one very hard. 45 minutes.', difficulties: [3, 3, 4], minutes: 45 },
};

export interface Candidate { id: string; lessonId: string; trackId: string; difficulty: number; guided?: boolean }

/** Small seeded PRNG so a session can be reproduced in tests. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Picks one exercise per requested difficulty: from the chosen tracks, never guided warm-ups,
 * preferring ones the learner has not solved, and different lessons so the session is varied.
 */
export function pickExercises(all: Candidate[], opts: { tracks: string[]; level: Level; solved: Record<string, unknown>; random?: () => number }): string[] {
  const random = opts.random ?? Math.random;
  const pool = all.filter((c) => !c.guided && (opts.tracks.length === 0 || opts.tracks.includes(c.trackId)));
  const chosen: Candidate[] = [];
  for (const want of LEVELS[opts.level].difficulties) {
    const free = pool.filter((c) => !chosen.includes(c));
    const rank = (c: Candidate) => (opts.solved[c.id] ? 1 : 0) * 10 + (chosen.some((x) => x.lessonId === c.lessonId) ? 5 : 0) + Math.abs(c.difficulty - want) * 3 + random();
    const best = [...free].sort((a, b) => rank(a) - rank(b))[0];
    if (best) chosen.push(best);
  }
  return chosen.map((c) => c.id);
}

export interface MockItem { ex: string; passed: number; total: number; ms: number }

export const ratio = (i: { passed: number; total: number }) => (i.total > 0 ? i.passed / i.total : 0);
export const scoreOf = (items: { passed: number; total: number }[]) =>
  items.length ? Math.round((100 * items.reduce((s, i) => s + ratio(i), 0)) / items.length) : 0;

export function verdict(score: number): string {
  if (score >= 90) return 'Interview-ready on these problems.';
  if (score >= 70) return 'Close. Tighten the problems that did not fully pass.';
  if (score >= 40) return 'Partial credit. Revisit the lessons below, then retry.';
  return 'Rough one. That is what practice is for: work through the linked lessons first.';
}

/** In-progress session; lives on this device only. The finished result goes into synced progress. */
export interface MockSession {
  startedAt: number;
  minutes: number;
  level: Level;
  exIds: string[];
  /** Best result per exercise while the clock was running. */
  results: Record<string, MockItem>;
  finishedAt?: number;
  /** Id of the saved result, once finished. */
  resultId?: string;
}

const KEY = 'whetstone:mock:v1';
let session: MockSession | null = null;
try { session = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { /* none */ }
const listeners = new Set<() => void>();
function commit(next: MockSession | null) {
  session = next;
  try { if (next) localStorage.setItem(KEY, JSON.stringify(next)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export const mock = {
  get: () => session,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  start(level: Level, exIds: string[]) {
    commit({ startedAt: Date.now(), minutes: LEVELS[level].minutes, level, exIds, results: {} });
  },
  deadline: () => (session ? session.startedAt + session.minutes * 60_000 : 0),
  isRunning: () => !!session && !session.finishedAt,
  /** Record a test run; only counts while the clock runs, and only improvements are kept. */
  record(ex: string, passed: number, total: number, ms: number) {
    if (!session || session.finishedAt || !session.exIds.includes(ex)) return;
    if (Date.now() > mock.deadline() + 2000) return;
    const prev = session.results[ex];
    if (prev && ratio(prev) >= passed / Math.max(total, 1)) return;
    commit({ ...session, results: { ...session.results, [ex]: { ex, passed, total, ms: Date.now() - session.startedAt } } });
    void ms;
  },
  finish(resultId: string) {
    if (session) commit({ ...session, finishedAt: Date.now(), resultId });
  },
  toResult(): Omit<MockResult, 'id' | 'at'> | null {
    if (!session) return null;
    const items = session.exIds.map((ex) => session!.results[ex] ?? { ex, passed: 0, total: 1, ms: 0 });
    return { minutes: session.minutes, score: scoreOf(items), items };
  },
  clear() { commit(null); },
};

export const useMock = () => useSyncExternalStore(mock.subscribe, mock.get);
