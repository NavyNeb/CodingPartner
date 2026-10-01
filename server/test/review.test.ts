import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, buildQueue, dueNow, streak } from '../../src/lib/review.ts';
import type { Attempt } from '../../src/lib/syncMerge.ts';

const T0 = Date.UTC(2026, 0, 1, 12);
let n = 0;
const at = (ex: string, daysAfter: number, passed: number, total = 2, assisted = false): Attempt =>
  ({ id: `a${n++}`, ex, at: T0 + daysAfter * DAY, passed, total, assisted, ms: 5 });

describe('review queue', () => {
  it('a failed, never-solved exercise is due the next day as "unsolved"', () => {
    const q = buildQueue({ solved: {}, attempts: [at('a', 0, 1)] }, T0);
    assert.equal(q[0].reason, 'unsolved');
    assert.equal(q[0].due, T0 + DAY);
  });
  it('clean passes climb the boxes 1 → 3 → 7 → 21 → 60 days', () => {
    const attempts = [0, 2, 6, 14, 40].map((d) => at('a', d, 2));
    const q = buildQueue({ solved: { a: { at: T0, assisted: false } }, attempts }, T0);
    assert.equal(q[0].box, 5);
    assert.equal(q[0].due, T0 + 40 * DAY + 60 * DAY);
  });
  it('an assisted pass or a later failure drops back to box 1', () => {
    const solved = { a: { at: T0, assisted: true } };
    assert.equal(buildQueue({ solved, attempts: [at('a', 0, 2), at('a', 2, 2), at('a', 6, 2, 2, true)] }, T0)[0].box, 1);
    const q = buildQueue({ solved, attempts: [at('a', 0, 2), at('a', 2, 2), at('a', 6, 0)] }, T0)[0];
    assert.equal(q.box, 1);
    assert.equal(q.reason, 'missed');
  });
  it('several runs in one sitting count once', () => {
    const attempts = [at('a', 0, 0), at('a', 0.001, 1), at('a', 0.002, 2)];
    assert.equal(buildQueue({ solved: { a: { at: T0, assisted: false } }, attempts }, T0)[0].box, 1);
  });
  it('exercises solved before attempts were logged are reviewed a day later', () => {
    const q = buildQueue({ solved: { old: { at: T0, assisted: false } }, attempts: [] }, T0);
    assert.deepEqual([q[0].ex, q[0].due], ['old', T0 + DAY]);
  });
  it('dueNow only returns what is due', () => {
    const q = buildQueue({ solved: {}, attempts: [at('a', 0, 0), at('b', 5, 0)] }, T0);
    assert.deepEqual(dueNow(q, T0 + 2 * DAY).map((i) => i.ex), ['a']);
  });
  it('streak counts consecutive days and tolerates "not yet today"', () => {
    const attempts = [at('a', 0, 1), at('a', 1, 1), at('a', 2, 1)];
    assert.equal(streak(attempts, T0 + 2 * DAY, 0), 3);
    assert.equal(streak(attempts, T0 + 3 * DAY, 0), 3);
    assert.equal(streak(attempts, T0 + 5 * DAY, 0), 0);
  });
});

import { LEVELS, pickExercises, rng, scoreOf, type Candidate } from '../../src/lib/mock.ts';
describe('mock interview picking and scoring', () => {
  const all: Candidate[] = [];
  for (let l = 0; l < 6; l++) for (let d = 1; d <= 4; d++) all.push({ id: `l${l}-d${d}`, lessonId: `l${l}`, trackId: l < 3 ? 'js' : 'react', difficulty: d, guided: d === 1 && l === 0 });
  it('returns three exercises matching the level, from different lessons, never guided', () => {
    const ids = pickExercises(all, { tracks: [], level: 'senior', solved: {}, random: rng(7) });
    assert.equal(ids.length, 3);
    const picked = ids.map((id) => all.find((c) => c.id === id)!);
    assert.deepEqual(picked.map((c) => c.difficulty), LEVELS.senior.difficulties);
    assert.equal(new Set(picked.map((c) => c.lessonId)).size, 3);
    assert.ok(picked.every((c) => !c.guided));
  });
  it('respects the track filter and prefers unsolved', () => {
    const solved = Object.fromEntries(all.filter((c) => c.difficulty === 3 && c.lessonId !== 'l4').map((c) => [c.id, true]));
    const ids = pickExercises(all, { tracks: ['react'], level: 'mid', solved, random: rng(1) });
    assert.ok(ids.every((id) => all.find((c) => c.id === id)!.trackId === 'react'));
    assert.ok(ids.includes('l4-d3'));
  });
  it('is reproducible with a seed', () => {
    const a = pickExercises(all, { tracks: [], level: 'mid', solved: {}, random: rng(42) });
    assert.deepEqual(a, pickExercises(all, { tracks: [], level: 'mid', solved: {}, random: rng(42) }));
  });
  it('scores the mean fraction of tests passed', () => {
    assert.equal(scoreOf([{ passed: 4, total: 4 }, { passed: 2, total: 4 }, { passed: 0, total: 4 }]), 50);
    assert.equal(scoreOf([]), 0);
  });
});
