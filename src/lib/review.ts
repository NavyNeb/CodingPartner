import type { Attempt, SolveRecord } from './syncMerge';

/** Leitner boxes: days to wait after a clean pass before seeing the exercise again. */
export const INTERVALS_DAYS = [1, 3, 7, 21, 60] as const;
export const DAY = 86_400_000;

export interface ReviewItem {
  ex: string;
  /** 1..5 (box 5 = mastered-ish, seen every 60 days). */
  box: number;
  /** When it becomes due (ms since epoch). */
  due: number;
  lastAt: number;
  /** Why it is in the queue. */
  reason: 'unsolved' | 'missed' | 'review';
}

interface ProgressLike { solved: Record<string, SolveRecord>; attempts: Attempt[] }

/**
 * Replays the attempt log per exercise:
 *  - a clean pass (all tests, no solution peeked) moves up one box,
 *  - a failing run after the exercise is solved, or an assisted pass, drops back to box 1,
 *  - failing runs on a never-solved exercise keep it "unsolved" (practice it again tomorrow).
 * Repeated "Run" presses within one sitting count once: only the last run of each 30-minute session matters.
 */
export function buildQueue(p: ProgressLike, now: number): ReviewItem[] {
  const byEx = new Map<string, Attempt[]>();
  for (const a of p.attempts) (byEx.get(a.ex) ?? byEx.set(a.ex, []).get(a.ex)!).push(a);
  const items: ReviewItem[] = [];
  for (const [ex, list] of byEx) {
    const sorted = [...list].sort((a, b) => a.at - b.at);
    const sessions: Attempt[] = [];
    for (const a of sorted) {
      const last = sessions[sessions.length - 1];
      if (last && a.at - last.at < 30 * 60_000) sessions[sessions.length - 1] = a;
      else sessions.push(a);
    }
    let box = 0;
    let everPassed = false;
    for (const a of sessions) {
      const clean = a.passed === a.total && a.total > 0;
      if (clean && !a.assisted) { box = Math.min(5, box + 1); everPassed = true; }
      else if (clean) { box = 1; everPassed = true; }
      else if (everPassed) box = 1;
    }
    const last = sessions[sessions.length - 1];
    const lastClean = last.passed === last.total && last.total > 0;
    if (!everPassed && !p.solved[ex]) {
      items.push({ ex, box: 0, due: last.at + DAY, lastAt: last.at, reason: 'unsolved' });
    } else {
      const b = Math.max(1, box);
      items.push({ ex, box: b, due: last.at + INTERVALS_DAYS[b - 1] * DAY, lastAt: last.at, reason: lastClean ? 'review' : 'missed' });
    }
  }
  // Solved with no attempt log (solved before v4): treat as first-box review a day after the solve.
  for (const [ex, r] of Object.entries(p.solved)) {
    if (!byEx.has(ex)) items.push({ ex, box: 1, due: r.at + INTERVALS_DAYS[0] * DAY, lastAt: r.at, reason: 'review' });
  }
  return items.sort((a, b) => a.due - b.due);
}

export const dueNow = (q: ReviewItem[], now: number) => q.filter((i) => i.due <= now);

/** Consecutive days (ending today or yesterday) that have at least one attempt. */
export function streak(attempts: Attempt[], now: number, tzOffsetMin = new Date().getTimezoneOffset()): number {
  const day = (t: number) => Math.floor((t - tzOffsetMin * 60_000) / DAY);
  const days = new Set(attempts.map((a) => day(a.at)));
  let d = day(now);
  if (!days.has(d)) d -= 1;
  let n = 0;
  while (days.has(d)) { n++; d--; }
  return n;
}
