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
