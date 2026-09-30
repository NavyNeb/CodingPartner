import { tracks, allExercises } from '../content';
import type { ProgressState } from '../store/progress';

export const DEFAULT_MINUTES = { 1: 8, 2: 15, 3: 25, 4: 35 } as const;

export function exerciseOrder() {
  return allExercises;
}

export function nextAfter(lessonId: string, exId: string) {
  const i = allExercises.findIndex((e) => e.lesson.id === lessonId && e.exercise.id === exId);
  return i >= 0 ? allExercises[i + 1] ?? null : null;
}
export function prevBefore(lessonId: string, exId: string) {
  const i = allExercises.findIndex((e) => e.lesson.id === lessonId && e.exercise.id === exId);
  return i > 0 ? allExercises[i - 1] : null;
}

export function firstUnsolved(p: ProgressState) {
  return allExercises.find((e) => !p.solved[e.exercise.id]) ?? null;
}

export function resumePoint(p: ProgressState) {
  if (p.last) {
    const cur = allExercises.find((e) => e.exercise.id === p.last!.exId);
    if (cur && !p.solved[cur.exercise.id]) return { item: cur, verb: 'Continue' as const };
    if (cur) {
      const next = nextAfter(cur.lesson.id, cur.exercise.id);
      if (next && !p.solved[next.exercise.id]) return { item: next, verb: 'Continue' as const };
    }
  }
  const u = firstUnsolved(p);
  return u ? { item: u, verb: Object.keys(p.solved).length ? ('Continue' as const) : ('Start' as const) } : null;
}

export function trackStats(trackId: string, p: ProgressState) {
  const t = tracks.find((x) => x.id === trackId)!;
  const ex = t.lessons.flatMap((l) => l.exercises);
  return { total: ex.length, solved: ex.filter((e) => p.solved[e.id]).length };
}

export function lessonStats(lessonId: string, p: ProgressState) {
  const l = tracks.flatMap((t) => t.lessons).find((x) => x.id === lessonId)!;
  return { total: l.exercises.length, solved: l.exercises.filter((e) => p.solved[e.id]).length };
}
