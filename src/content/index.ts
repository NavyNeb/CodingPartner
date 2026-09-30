import { buildTracks } from './parse';
import { trackMeta } from './tracks';

const sources = import.meta.glob('./lessons/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const tracks = buildTracks(sources, trackMeta);

export const allExercises = tracks.flatMap((t) =>
  t.lessons.flatMap((l) => l.exercises.map((exercise) => ({ track: t, lesson: l, exercise }))),
);

export function findLesson(id: string) {
  for (const t of tracks) {
    const i = t.lessons.findIndex((l) => l.id === id);
    if (i >= 0) return { track: t, lesson: t.lessons[i], index: i };
  }
  return null;
}
