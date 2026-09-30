import type { Difficulty, Exercise, Kind, Lang, Lesson, Track } from './types';

/*
 * Lesson file format (see src/content/lessons/*):
 *
 *   ---
 *   id: closures
 *   track: js
 *   title: Closures & Scope
 *   summary: One sentence.
 *   ---
 *   …theory markdown…
 *
 *   %% exercise id | Title | difficulty(1-4) | lang(js|ts|tsx) | kind(js|react|types) | export1, export2 | minutes
 *   …task markdown…
 *   %% starter        → next fenced block
 *   %% tests          → next fenced block
 *   %% hints          → "- " list, one hint per item
 *   %% solution       → next fenced block
 *
 * Directives are only recognised outside fenced code blocks.
 */

export interface TrackMeta { id: string; title: string; blurb: string }

const FENCE = /^(`{3,}|~{3,})/;

function splitFrontMatter(src: string, file: string) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

interface Chunk { directive: string | null; args: string; lines: string[] }

function chunk(body: string): Chunk[] {
  const chunks: Chunk[] = [{ directive: null, args: '', lines: [] }];
  let fence: string | null = null;
  for (const line of body.split('\n')) {
    const f = FENCE.exec(line);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null;
    }
    const d = !fence && !f ? /^%%\s+(\w+)\s*(.*)$/.exec(line) : null;
    if (d) chunks.push({ directive: d[1], args: d[2], lines: [] });
    else chunks[chunks.length - 1].lines.push(line);
  }
  return chunks;
}

function firstFence(lines: string[], where: string): string {
  const start = lines.findIndex((l) => FENCE.test(l));
  if (start < 0) throw new Error(`${where}: expected a fenced code block`);
  const open = FENCE.exec(lines[start])![1];
  let end = -1;
  for (let i = lines.length - 1; i > start; i--) if (lines[i].trim() === open) { end = i; break; }
  if (end < 0) throw new Error(`${where}: unterminated code fence`);
  return lines.slice(start + 1, end).join('\n');
}

const trim = (lines: string[]) => lines.join('\n').trim();

function parseExercise(first: Chunk, rest: Chunk[], file: string): Exercise {
  const parts = first.args.split('|').map((s) => s.trim());
  const [id, title, diff, lang, kind, exp, minutes] = parts;
  const where = `${file} › ${id}`;
  if (!id || !title || !diff || !lang || !kind) throw new Error(`${where}: bad exercise header "${first.args}"`);
  if (![1, 2, 3, 4].includes(+diff)) throw new Error(`${where}: difficulty must be 1-4`);
  if (!['js', 'ts', 'tsx'].includes(lang)) throw new Error(`${where}: bad lang ${lang}`);
  if (!['js', 'react', 'types'].includes(kind)) throw new Error(`${where}: bad kind ${kind}`);
  const ex: Partial<Exercise> = {
    id, title, difficulty: +diff as Difficulty, lang: lang as Lang, kind: kind as Kind,
    exports: exp ? exp.split(',').map((s) => s.trim()).filter(Boolean) : [],
    prompt: trim(first.lines), hints: [],
  };
  if (minutes) ex.minutes = +minutes;
  for (const c of rest) {
    if (c.directive === 'starter') ex.starter = firstFence(c.lines, `${where} starter`);
    else if (c.directive === 'tests') ex.tests = firstFence(c.lines, `${where} tests`);
    else if (c.directive === 'solution') ex.solution = firstFence(c.lines, `${where} solution`);
    else if (c.directive === 'hints') {
      const items: string[] = [];
      for (const l of c.lines) {
        if (/^\s*[-*]\s+/.test(l)) items.push(l.replace(/^\s*[-*]\s+/, ''));
        else if (l.trim() && items.length) items[items.length - 1] += ' ' + l.trim();
      }
      ex.hints = items;
    } else throw new Error(`${where}: unknown directive %% ${c.directive}`);
  }
  for (const k of ['starter', 'tests', 'solution', 'prompt'] as const) if (!ex[k]) throw new Error(`${where}: missing ${k}`);
  return ex as Exercise;
}

export function parseLesson(src: string, file: string): { lesson: Lesson; track: string } {
  const { meta, body } = splitFrontMatter(src, file);
  for (const k of ['id', 'track', 'title', 'summary']) if (!meta[k]) throw new Error(`${file}: front matter needs "${k}"`);
  const chunks = chunk(body);
  const theory = trim(chunks[0].lines);
  const exercises: Exercise[] = [];
  for (let i = 1; i < chunks.length; i++) {
    if (chunks[i].directive !== 'exercise') throw new Error(`${file}: %% ${chunks[i].directive} outside an exercise`);
    let j = i + 1;
    while (j < chunks.length && chunks[j].directive !== 'exercise') j++;
    exercises.push(parseExercise(chunks[i], chunks.slice(i + 1, j), file));
    i = j - 1;
  }
  return { track: meta.track, lesson: { id: meta.id, title: meta.title, summary: meta.summary, theory, exercises } };
}

export function buildTracks(sources: Record<string, string>, meta: TrackMeta[]): Track[] {
  const tracks: Track[] = meta.map((m) => ({ ...m, lessons: [] }));
  for (const file of Object.keys(sources).sort()) {
    const { lesson, track } = parseLesson(sources[file], file.replace(/^.*lessons\//, ''));
    const t = tracks.find((x) => x.id === track);
    if (!t) throw new Error(`${file}: unknown track "${track}"`);
    t.lessons.push(lesson);
  }
  return tracks.filter((t) => t.lessons.length);
}
