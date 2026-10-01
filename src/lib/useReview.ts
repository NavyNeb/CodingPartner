import { useMemo } from 'react';
import { allExercises } from '../content';
import { useProgress } from '../store/progress';
import { buildQueue, dueNow, streak, type ReviewItem } from './review';

export interface ReviewEntry extends ReviewItem { lessonId: string; title: string; lessonTitle: string }

export function useReview() {
  const p = useProgress();
  return useMemo(() => {
    const now = Date.now();
    const known = new Map(allExercises.map((e) => [e.exercise.id, e]));
    const queue: ReviewEntry[] = buildQueue(p, now).flatMap((i) => {
      const e = known.get(i.ex);
      return e ? [{ ...i, lessonId: e.lesson.id, title: e.exercise.title, lessonTitle: e.lesson.title }] : [];
    });
    return { now, queue, due: dueNow(queue, now) as ReviewEntry[], streak: streak(p.attempts, now) };
  }, [p.attempts, p.solved]);
}
