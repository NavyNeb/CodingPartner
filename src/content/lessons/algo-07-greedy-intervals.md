---
id: algo-greedy
track: algo
title: Greedy choices & intervals
summary: Making the best-looking choice at every step and never looking back: when it is safe (and how to argue it), when it fails, and the classic greedy patterns: interval scheduling, jump reach, gas stations, partitions and sweeping events.
---

## The idea in one sentence

A **greedy** algorithm builds its answer by taking the **best-looking choice right now** at every step and **never reconsidering** — fast and simple, but only correct when that local choice can't spoil the global result.

> **Analogy** Packing a suitcase by always adding the next-most-useful item that still fits. It's quick and often fine — but it can fail: a bulky "most useful" item might block two smaller ones that were together more valuable.

Greedy solutions are usually **O(n)** or **O(n log n)** (the log is a **sort**), with almost no memory — which is why interviewers love them *and* why they probe whether you can **justify** one.

## When is greedy safe?

Two properties have to hold:

- **Greedy-choice property:** some optimal solution contains the greedy choice.
- **Optimal substructure:** after the choice, what remains is a smaller problem of the same kind.

The standard proof is an **exchange argument**: take any optimal solution that *doesn't* use your greedy choice and show you can **swap** it in without making the answer worse.

And the opposite skill — **spotting a counterexample** — matters just as much: one small input where greedy loses rules it out.

![Greedy takes 4+1+1 but 3+3 is better for amount 6 with coins 1, 3, 4](fig:alg-greedy-vs-dp "Greedy coin change fails for coins 1, 3, 4. For coins like 1, 5, 10, 25 it happens to work, which is why proofs matter.")

## Interval scheduling: sort by end time

*Given meetings with start and end times, attend as many as possible, none overlapping.* Which greedy rule is right?

- Earliest **start** first? A long meeting could block many short ones. ✗
- **Shortest** first? Can still block. ✗
- Earliest **end** first: it leaves the most room for everything else. ✓ (This one has an exchange argument: swapping any chosen first meeting for the earliest-ending one never reduces what fits afterwards.)

![Six meetings sorted by end time; the greedy rule picks three](fig:alg-interval-scheduling "Take a meeting when it starts at or after the end of the last chosen one.")

```stepper Choosing meetings by earliest end
code:
  function maxMeetings(intervals) {
    const sorted = intervals.slice().sort((a, b) => a[1] - b[1]);   // by END time
    let count = 0, lastEnd = -Infinity;
    for (const [start, end] of sorted) {
      if (start >= lastEnd) { count++; lastEnd = end; }
    }
    return count;
  }
  // [[0,3], [2,5], [4,7], [1,9], [6,10], [9,12]]
---
line: 2
say: Sort by **end time**: `[0,3]`, `[2,5]`, `[4,7]`, `[1,9]`, `[6,10]`, `[9,12]`.
order: [0,3] [2,5] [4,7] [1,9] [6,10] [9,12]
chosen: (none)
lastEnd: -∞
---
line: 4-5
say: `[0,3]` starts at `0 >= -∞`, so take it: `lastEnd = 3`.
chosen: [0,3]
lastEnd: 3
---
line: 4-5
say: `[2,5]` starts at `2 < 3`: it overlaps the chosen meeting. **Skip.**
chosen: [0,3]
---
line: 4-5
say: `[4,7]` starts at `4 >= 3`: take it. `lastEnd = 7`.
chosen: [0,3] [4,7]
lastEnd: 7
---
line: 4-5
say: `[1,9]` starts at `1 < 7`: skip. `[6,10]` starts at `6 < 7`: skip.
chosen: [0,3] [4,7]
---
line: 4-5
say: `[9,12]` starts at `9 >= 7`: take it. Done: **3** meetings, one pass after the sort: **O(n log n)**.
chosen: [0,3] [4,7] [9,12]
lastEnd: 12
Result: 3
```

The very same idea answers **"fewest meetings to remove so none overlap"** (`n − maxMeetings`) and **"fewest arrows to burst balloons"**.

## Jump game: remember only the farthest reach

*Each `nums[i]` is the longest jump from index `i`. Can you reach the last index?* Don't search paths. Scan left to right, remembering only the **farthest index reachable so far**. If you ever stand beyond it, you're stuck.

![Farthest reach after each index of 2 3 1 1 4](fig:alg-jump-reach "reach = max(reach, i + nums[i]); stuck if i > reach.")

```stepper Can we reach the end of [2, 3, 1, 1, 4]?
code:
  function canJump(nums) {
    let reach = 0;
    for (let i = 0; i < nums.length; i++) {
      if (i > reach) return false;
      reach = Math.max(reach, i + nums[i]);
    }
    return true;
  }
---
line: 2
say: At the start the farthest reachable index is `0` (where we stand).
reach: 0
---
line: 4-5
say: `i = 0`: `0 <= reach`, so we can stand here. `reach = max(0, 0 + 2) = 2`.
i: 0
reach: 2
---
line: 4-5
say: `i = 1`: inside the reach. `reach = max(2, 1 + 3) = 4`: the last index (4) is now reachable.
i: 1
reach: 4
---
line: 4-5
say: `i = 2` and `i = 3` can't extend it (`2 + 1`, `3 + 1` are not beyond 4).
i: 3
reach: 4
---
line: 7
say: We got through every index without being stuck: **true**. One pass, constant memory.
Result: true
```

The same one-number trick (current "reach") drives **minimum jumps** (count a jump each time you pass the end of the current reach) and **gas station**.

## Gas station: a running tank

*N stations on a circle; `gas[i]` is the fuel you collect at station `i`, `cost[i]` the fuel to drive to the next. Which station can you start from to complete the circuit?* Two facts make it greedy:

1. If **total gas < total cost**, no start works.
2. Otherwise, drive and track the tank. When it drops below zero at station `i`, **no start at or before `i` (since the last restart) could work** — so restart at `i + 1`. The last restart point is the answer.

```js try
function canCompleteCircuit(gas, cost) {
  let tank = 0, total = 0, start = 0;
  for (let i = 0; i < gas.length; i++) {
    const net = gas[i] - cost[i];
    tank += net; total += net;
    if (tank < 0) { start = i + 1; tank = 0; }     // can't get past i from `start`: try again just after i
  }
  return total >= 0 ? start : -1;
}
console.log(canCompleteCircuit([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]));   // 3
```

## Partition labels: extend the part to the last occurrence

*Cut a string into as many parts as possible so every letter appears in only one part.* Record the **last index of each letter**. Walk the string keeping `end` = the farthest last-occurrence of any letter seen in this part; when you reach `end`, the part is closed — no letter in it appears later.

```js try
function partitionLabels(s) {
  const last = {};
  for (let i = 0; i < s.length; i++) last[s[i]] = i;
  const sizes = [];
  let start = 0, end = 0;
  for (let i = 0; i < s.length; i++) {
    end = Math.max(end, last[s[i]]);                // this part must reach at least the last time this letter appears
    if (i === end) { sizes.push(end - start + 1); start = i + 1; }
  }
  return sizes;
}
console.log(partitionLabels('ababcbacadefegdehijhklij'));   // [9, 7, 8]
```

## Sweeping events: how many at once?

*How many meeting rooms are needed?* The answer is the **largest number of meetings overlapping at any instant**. Turn each meeting into two **events** (+1 at its start, −1 at its end), sort them by time, and track the running count:

![Events sorted in time and the running count of rooms](fig:alg-sweep-rooms "The maximum running count is the answer. At equal times, process ends before starts.")

An equivalent trick sorts the **start times** and the **end times** separately and walks both with two pointers: if the next start is before the earliest end, you need another room; otherwise a room just freed up, and you reuse it.

## Greedy or DP?

| If… | Reach for |
| --- | --- |
| A local best choice is provably safe (exchange argument), usually after sorting | **Greedy** |
| You can find a small counterexample to greedy | **DP** (or backtracking) |
| The task says "all solutions" | **Backtracking** |
| "Count / min / max" with overlapping subproblems | **DP** |

## Quick check

```check
Q: Why does interval scheduling sort by END time rather than start time?
A) End times are smaller
B) The earliest-ending meeting leaves the most room for the rest; the earliest start could be a long meeting that blocks many *
C) It is easier to code
D) Start times can be equal
Why: Finishing early never hurts the remaining choices (an exchange argument shows it), whereas starting early says nothing about when you free up.
---
Q: Greedy coin change fails for coins [1, 3, 4] and amount 6. What does that show?
A) Greedy never works
B) A single counterexample is enough to prove a greedy rule wrong *
C) Coins must be sorted
D) The amount is too small
Why: Greedy gives 4+1+1 (3 coins), but 3+3 (2 coins) is better. Some coin systems (1, 5, 10, 25) happen to be safe.
---
Q: In the jump game, what single number do you track?
A) The number of jumps
B) The farthest index reachable so far *
C) The largest value
D) The last index
Why: If the current index is beyond the farthest reach you're stuck; otherwise extend the reach with `i + nums[i]`.
---
Q: In the gas station problem, what does a negative tank at station i tell you?
A) The answer is -1
B) No start between the last restart and i can work, so restart at i + 1 *
C) You should refuel
D) The circuit is complete
Why: Any start between them reaches i with at least as little fuel as the one that just failed.
---
Q: How do you compute the minimum number of rooms for a set of meetings?
A) Count the meetings
B) Find the maximum number overlapping at once, by sweeping sorted start and end events *
C) Sort by length
D) Count distinct start times
Why: Rooms are needed only for simultaneous meetings, so the peak overlap is the answer.
```

## Recap

- **Greedy** = best local choice, never reconsidered. Safe only with a **greedy-choice property** (prove with an **exchange argument**); find a **counterexample** to rule it out.
- **Interval scheduling**: sort by **end** time; pick what fits. Variants: removals, arrows, rooms.
- **Jump / gas / partition problems**: carry one running quantity (farthest reach, tank, current part end).
- **Sweeping**: events sorted in time, a running count, ends before starts at ties.
- Greedy is **O(n)** to **O(n log n)**, mostly the sort.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: assign cookies | Sort both lists; match the smallest satisfying cookie |
| Jump game | The `reach` stepper |
| Minimum jumps | Count a jump each time you pass the end of the current reach |
| Gas station | The running tank and restart rule |
| Minimum removals for non-overlap | Interval scheduling: sort by end |
| Meeting rooms | Separate sorted starts and ends |
| Partition labels | The last index of each letter |

%% exercise alg-guided-cookies | Guided: assign cookies | 1 | js | js | assignCookies | 8 | guided
Child `i` is content with a cookie of size at least `greed[i]`. Each cookie can go to **one** child. Return the **maximum number of content children**. It must be fast: 200 000 children and cookies are tested.

```js
assignCookies([1, 2, 3], [1, 1]);    // 1
assignCookies([1, 2], [1, 2, 3]);    // 2
```

%% worked
**A similar problem, solved: `maxPairsUnderLimit(weights, limit)`** — pair the lightest with the heaviest while they fit, a greedy two-pointer.

```js
function maxPairsUnderLimit(weights, limit) {
  const sorted = weights.slice().sort((a, b) => a - b);
  let lo = 0, hi = sorted.length - 1, pairs = 0;
  while (lo < hi) {
    if (sorted[lo] + sorted[hi] <= limit) { pairs++; lo++; hi--; }   // ① they fit together: pair them
    else hi--;                                                       // ② the heaviest fits with nobody left: drop it
  }
  return pairs;
}
```

Cookies: sort both. Go through the cookies from smallest to largest, and offer each one to the **least greedy child who is still unhappy**; if it satisfies them, count a happy child and move on to the next child, otherwise the cookie is too small for *everyone* left, so discard it.

%% explain
- **Sort** greed and cookies ascending.
- **Smallest unsatisfied child** gets the smallest cookie that works.
- **A cookie too small** for that child is useless to the rest.
- **O(n log n)** for the sorts, then one pass.

%% nudge
- Why is it wasteful to give a big cookie to a child with small greed?
- When a cookie is too small for the least greedy child, can it help anyone else?

%% starter
```js
export function assignCookies(greed, cookies) {
  // Step 1 — sort copies of both arrays ascending.
  // Step 2 — child = 0; for each cookie (small → large): if cookie >= greed[child], child++.
  // Step 3 — return child.
  return 0;
}
```

%% tests
```js
describe('assignCookies', () => {
  it('counts content children', () => {
    expect(assignCookies([1, 2, 3], [1, 1])).toBe(1);
    expect(assignCookies([1, 2], [1, 2, 3])).toBe(2);
    expect(assignCookies([10, 9, 8, 7], [5, 6, 7, 8])).toBe(2);
  });

  it('handles empty inputs', () => {
    expect(assignCookies([], [1, 2])).toBe(0);
    expect(assignCookies([1, 2], [])).toBe(0);
  });

  it('does not modify its inputs', () => {
    const g = [3, 1, 2], c = [2, 1];
    assignCookies(g, c);
    expect(g).toEqual([3, 1, 2]);
    expect(c).toEqual([2, 1]);
  });

  it('does not waste big cookies', () => {
    expect(assignCookies([1, 5], [6, 1])).toBe(2);
  });

  it('is fast: 200 000 children', () => {
    const g = Array.from({ length: 200000 }, (_, i) => (i * 7919) % 1000 + 1);
    const c = Array.from({ length: 200000 }, (_, i) => (i * 104729) % 1000 + 1);
    const t = Date.now();
    const r = assignCookies(g, c);
    expect(Date.now() - t).toBeLessThan(900);
    expect(r).toBeGreaterThan(100000);
  });
});
```

%% hints
- `const g = greed.slice().sort((a, b) => a - b); const c = cookies.slice().sort((a, b) => a - b);`
- `let child = 0; for (const cookie of c) { if (child < g.length && cookie >= g[child]) child++; }`

%% solution
```js
export function assignCookies(greed, cookies) {
  const g = greed.slice().sort((a, b) => a - b);
  const c = cookies.slice().sort((a, b) => a - b);
  let child = 0;
  for (const cookie of c) {
    if (child < g.length && cookie >= g[child]) child++;
  }
  return child;
}
```

%% exercise alg-can-jump | Jump game | 2 | js | js | canJump | 14
`nums[i]` is the **maximum** jump length from index `i`. Starting at index `0`, return whether you can **reach the last index**. It must be **O(n)**: a million items are tested.

```js
canJump([2, 3, 1, 1, 4]); // true
canJump([3, 2, 1, 0, 4]); // false  (you always end up on the 0)
```

%% worked
**A similar problem, solved: `maxReach(nums)`** — the farthest index you can ever get to.

```js
function maxReach(nums) {
  let reach = 0;
  for (let i = 0; i < nums.length && i <= reach; i++) {   // ① only indexes we can actually stand on
    reach = Math.max(reach, i + nums[i]);                  // ② each one may extend how far we can get
  }
  return Math.min(reach, nums.length - 1);
}
```

`canJump` is `maxReach(nums) === nums.length - 1`: the end is reachable exactly when the farthest reach touches it. Equivalently, scan and return `false` the moment `i > reach`.

%% explain
- **`reach`**: the farthest index reachable from the indexes seen so far.
- **Stuck** if `i > reach`.
- **`[0]`** is `true` (already at the end).
- **One pass, O(1) memory**.

%% nudge
- When is index `i` impossible to stand on?
- What does each reachable index contribute to `reach`?

%% starter
```js
export function canJump(nums) {
  // your code
  return false;
}
```

%% tests
```js
describe('canJump', () => {
  it('detects reachable and unreachable ends', () => {
    expect(canJump([2, 3, 1, 1, 4])).toBe(true);
    expect(canJump([3, 2, 1, 0, 4])).toBe(false);
  });

  it('handles tiny arrays', () => {
    expect(canJump([0])).toBe(true);
    expect(canJump([0, 1])).toBe(false);
    expect(canJump([1, 0])).toBe(true);
    expect(canJump([2, 0, 0])).toBe(true);
  });

  it('allows a big jump over zeros', () => {
    expect(canJump([5, 0, 0, 0, 0, 0])).toBe(true);
    expect(canJump([1, 1, 0, 1])).toBe(false);
  });

  it('matches brute force on small random arrays', () => {
    let seed = 23;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 4;
    for (let round = 0; round < 50; round++) {
      const nums = Array.from({ length: 1 + (round % 9) }, rand);
      const ok = new Array(nums.length).fill(false);
      ok[0] = true;
      for (let i = 0; i < nums.length; i++) if (ok[i]) for (let j = 1; j <= nums[i] && i + j < nums.length; j++) ok[i + j] = true;
      expect(canJump(nums)).toBe(ok[nums.length - 1]);
    }
  });

  it('is linear: a million items', () => {
    const t = Date.now();
    expect(canJump(new Array(1000000).fill(1))).toBe(true);
    const blocked = new Array(1000000).fill(1);
    blocked[500000] = 0;
    expect(canJump(blocked)).toBe(false);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
```

%% hints
- `let reach = 0; for (let i = 0; i < nums.length; i++) { if (i > reach) return false; reach = Math.max(reach, i + nums[i]); } return true;`

%% solution
```js
export function canJump(nums) {
  let reach = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i > reach) return false;
    reach = Math.max(reach, i + nums[i]);
  }
  return true;
}
```

%% exercise alg-min-jumps | Minimum jumps | 3 | js | js | minJumps | 24
`nums[i]` is the **maximum** jump length from index `i`. Return the **fewest jumps** to reach the last index, or `-1` if it can't be reached. `minJumps([5])` is `0`. It must be **O(n)**: a million items are tested.

```js
minJumps([2, 3, 1, 1, 4]); // 2   (index 0 → 1 → 4)
minJumps([0, 1]);           // -1
```

%% worked
**A similar problem, solved: `levelsToFinish(sizes)`** — how many "windows" of the given reach does it take to cover everything?

```js
function stepsToCover(n, reachFrom) {
  let steps = 0, windowEnd = 0, farthest = 0;
  for (let i = 0; i < n - 1; i++) {
    farthest = Math.max(farthest, i + reachFrom(i));        // ① how far could we get from anywhere in the current window?
    if (i === windowEnd) { steps++; windowEnd = farthest; } // ② the window is used up: one more step, extending to the best reach
  }
  return steps;
}
```

Think of it as **BFS by levels**: with `j` jumps you can be anywhere in `[0, windowEnd]`. While scanning that window, note the `farthest` you could reach with one more jump. When you pass the end of the window, you must take a jump (`jumps++`) and the new window ends at `farthest`. If `farthest` didn't move past `i`, you're stuck: `-1`.

%% explain
- **`windowEnd`**: the farthest index reachable with the jumps used so far.
- **`farthest`**: the farthest index reachable with one more jump.
- **At `i === windowEnd`**: take a jump (`windowEnd = farthest`).
- **Stuck** when `farthest <= i` at that moment.
- **Single item** needs `0` jumps.

%% nudge
- When do you have to commit to making another jump?
- How do you notice that you can never move forward?

%% starter
```js
export function minJumps(nums) {
  // your code
  return -1;
}
```

%% tests
```js
describe('minJumps', () => {
  it('finds the fewest jumps', () => {
    expect(minJumps([2, 3, 1, 1, 4])).toBe(2);
    expect(minJumps([2, 3, 0, 1, 4])).toBe(2);
    expect(minJumps([1, 1, 1, 1])).toBe(3);
  });

  it('handles a single item and big jumps', () => {
    expect(minJumps([5])).toBe(0);
    expect(minJumps([5, 0, 0, 0, 0, 0])).toBe(1);
  });

  it('returns -1 when the end is unreachable', () => {
    expect(minJumps([0, 1])).toBe(-1);
    expect(minJumps([3, 2, 1, 0, 4])).toBe(-1);
  });

  it('matches a BFS on small random arrays', () => {
    let seed = 29;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 4;
    for (let round = 0; round < 50; round++) {
      const nums = Array.from({ length: 1 + (round % 10) }, rand);
      const dist = new Array(nums.length).fill(Infinity);
      dist[0] = 0;
      for (let i = 0; i < nums.length; i++) for (let j = 1; j <= nums[i] && i + j < nums.length; j++) dist[i + j] = Math.min(dist[i + j], dist[i] + 1);
      const expected = dist[nums.length - 1] === Infinity ? -1 : dist[nums.length - 1];
      expect(minJumps(nums)).toBe(expected);
    }
  });

  it('is linear: a million items', () => {
    const t = Date.now();
    expect(minJumps(new Array(1000000).fill(1))).toBe(999999);
    expect(minJumps(Array.from({ length: 1000000 }, (_, i) => (i % 3) + 1))).toBeGreaterThan(1);
    expect(Date.now() - t).toBeLessThan(700);
  });
});
```

%% hints
- `if (nums.length <= 1) return 0;` then `jumps = 0, windowEnd = 0, farthest = 0`.
- Loop `i` from `0` to `n - 2`: update `farthest`; if `farthest <= i` return `-1`; if `i === windowEnd` then `jumps++`, `windowEnd = farthest`, and return `jumps` early when `windowEnd >= n - 1`.

%% solution
```js
export function minJumps(nums) {
  const n = nums.length;
  if (n <= 1) return 0;
  let jumps = 0;
  let windowEnd = 0;
  let farthest = 0;
  for (let i = 0; i < n - 1; i++) {
    farthest = Math.max(farthest, i + nums[i]);
    if (i === windowEnd) {
      if (farthest <= i) return -1;
      jumps++;
      windowEnd = farthest;
      if (windowEnd >= n - 1) return jumps;
    }
  }
  return windowEnd >= n - 1 ? jumps : -1;
}
```

%% exercise alg-gas-station | Gas station | 3 | js | js | canCompleteCircuit | 24
There are `n` gas stations on a circle. At station `i` you **collect `gas[i]`** fuel, and driving to the next station **costs `cost[i]`**. Starting with an empty tank, return the **index of the station you can start from** to drive around the whole circle once (clockwise), or `-1` if it's impossible. If a solution exists it is **unique**. It must be **O(n)**: a million stations are tested.

```js
canCompleteCircuit([1, 2, 3, 4, 5], [3, 4, 5, 1, 2]); // 3
canCompleteCircuit([2, 3, 4], [3, 4, 3]);             // -1
```

%% worked
**A similar problem, solved: `lowestPoint(changes)`** — where does a running total dip lowest? (The start of the circuit is right after the lowest dip.)

```js
function lowestPoint(changes) {
  let sum = 0, lowest = 0, atIndex = -1;
  for (let i = 0; i < changes.length; i++) {
    sum += changes[i];
    if (sum < lowest) { lowest = sum; atIndex = i; }      // ① the deepest the running total ever goes
  }
  return atIndex;
}
```

Let `net[i] = gas[i] − cost[i]`. If the **sum of all nets is negative**, nothing works. Otherwise drive from station `0` with a tank; whenever the tank becomes negative at `i`, **no station from the last restart through `i` can be the start** (each would have at most as much fuel on arrival), so restart at `i + 1` with an empty tank. After the loop, the last restart is the answer.

%% explain
- **`net[i] = gas[i] − cost[i]`**.
- **Total net < 0** → `-1`.
- **Tank < 0 at `i`** → `start = i + 1`, `tank = 0`.
- **Unique** answer; single pass.

%% nudge
- What does a negative total tell you about all possible starts?
- When the tank goes negative at `i`, why can't any earlier start since the last restart work?

%% starter
```js
export function canCompleteCircuit(gas, cost) {
  // your code
  return -1;
}
```

%% tests
```js
describe('canCompleteCircuit', () => {
  it('finds the starting station', () => {
    expect(canCompleteCircuit([1, 2, 3, 4, 5], [3, 4, 5, 1, 2])).toBe(3);
    expect(canCompleteCircuit([5, 1, 2, 3, 4], [4, 4, 1, 5, 1])).toBe(4);
  });

  it('returns -1 when the total fuel is not enough', () => {
    expect(canCompleteCircuit([2, 3, 4], [3, 4, 3])).toBe(-1);
    expect(canCompleteCircuit([1], [2])).toBe(-1);
  });

  it('handles single stations and an exact fit', () => {
    expect(canCompleteCircuit([5], [4])).toBe(0);
    expect(canCompleteCircuit([3], [3])).toBe(0);
    expect(canCompleteCircuit([1, 1], [1, 1])).toBe(0);
  });

  it('matches brute force on random circuits', () => {
    let seed = 31;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 6;
    for (let round = 0; round < 40; round++) {
      const n = 2 + (round % 6);
      const gas = Array.from({ length: n }, rand);
      const cost = Array.from({ length: n }, rand);
      let expected = -1;
      for (let s = 0; s < n && expected === -1; s++) {
        let tank = 0, ok = true;
        for (let k = 0; k < n; k++) { const i = (s + k) % n; tank += gas[i] - cost[i]; if (tank < 0) { ok = false; break; } }
        if (ok) expected = s;
      }
      const got = canCompleteCircuit(gas, cost);
      if (expected === -1) expect(got).toBe(-1);
      else expect(got).not.toBe(-1);
    }
  });

  it('is linear: a million stations', () => {
    const n = 1000000;
    const gas = new Array(n).fill(1);
    const cost = new Array(n).fill(1);
    gas[n - 1] = 2;
    cost[0] = 2;
    const t = Date.now();
    expect(canCompleteCircuit(gas, cost)).toBe(1);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
```

%% hints
- Track `tank` (resets), `total` (never resets) and `start`.
- `if (tank < 0) { start = i + 1; tank = 0; }`; at the end `return total >= 0 ? start : -1`.

%% solution
```js
export function canCompleteCircuit(gas, cost) {
  let tank = 0;
  let total = 0;
  let start = 0;
  for (let i = 0; i < gas.length; i++) {
    const net = gas[i] - cost[i];
    tank += net;
    total += net;
    if (tank < 0) {
      start = i + 1;
      tank = 0;
    }
  }
  return total >= 0 ? start : -1;
}
```

%% exercise alg-erase-overlap | Fewest meetings to cancel | 3 | js | js | eraseOverlapIntervals | 24
Given intervals `[start, end]`, return the **minimum number to remove** so the rest **don't overlap**. Intervals that only **touch** (one ends exactly where the next starts) don't overlap. Don't modify the input. It must be **O(n log n)**: 200 000 intervals are tested.

```js
eraseOverlapIntervals([[1, 2], [2, 3], [3, 4], [1, 3]]); // 1   (remove [1, 3])
```

%% worked
**A similar problem, solved: `maxCompatible(intervals)`** — the greedy from the lesson: how many can you keep?

```js
function maxCompatible(intervals) {
  const sorted = intervals.slice().sort((a, b) => a[1] - b[1]);   // ① earliest END first
  let kept = 0, lastEnd = -Infinity;
  for (const [start, end] of sorted) {
    if (start >= lastEnd) { kept++; lastEnd = end; }              // ② it fits after the last kept one: keep it
  }
  return kept;
}
```

Removing the **fewest** is the same as keeping the **most**: the answer is `intervals.length − maxCompatible(intervals)`.

%% explain
- **Keep the maximum** non-overlapping set: sort by end, take what fits.
- **Removals** = total − kept.
- **Touching** is fine (`start >= lastEnd`).
- **Empty input** → `0`.

%% nudge
- How is "fewest removals" related to "most kept"?
- Which sort order makes the greedy choice safe?

%% starter
```js
export function eraseOverlapIntervals(intervals) {
  // your code
  return 0;
}
```

%% tests
```js
describe('eraseOverlapIntervals', () => {
  it('finds the minimum removals', () => {
    expect(eraseOverlapIntervals([[1, 2], [2, 3], [3, 4], [1, 3]])).toBe(1);
    expect(eraseOverlapIntervals([[1, 2], [1, 2], [1, 2]])).toBe(2);
    expect(eraseOverlapIntervals([[1, 100], [11, 22], [1, 11], [2, 12]])).toBe(2);
  });

  it('keeps touching intervals', () => {
    expect(eraseOverlapIntervals([[1, 2], [2, 3]])).toBe(0);
  });

  it('handles empty and single inputs', () => {
    expect(eraseOverlapIntervals([])).toBe(0);
    expect(eraseOverlapIntervals([[5, 6]])).toBe(0);
  });

  it('does not modify the input', () => {
    const input = [[3, 4], [1, 2]];
    eraseOverlapIntervals(input);
    expect(input).toEqual([[3, 4], [1, 2]]);
  });

  it('matches brute force on small random inputs', () => {
    let seed = 37;
    const rand = (m) => (seed = (seed * 48271) % 2147483647) % m;
    for (let round = 0; round < 40; round++) {
      const n = 1 + (round % 8);
      const iv = Array.from({ length: n }, () => { const a = rand(10); return [a, a + 1 + rand(4)]; });
      let best = 0;
      for (let mask = 0; mask < 1 << n; mask++) {
        const chosen = iv.filter((_, i) => mask & (1 << i)).sort((x, y) => x[0] - y[0]);
        let ok = true;
        for (let i = 1; i < chosen.length; i++) if (chosen[i][0] < chosen[i - 1][1]) { ok = false; break; }
        if (ok) best = Math.max(best, chosen.length);
      }
      expect(eraseOverlapIntervals(iv)).toBe(n - best);
    }
  });

  it('is O(n log n): 200 000 intervals', () => {
    const n = 200000;
    const intervals = Array.from({ length: n }, (_, i) => [(i * 7919) % 1000, ((i * 7919) % 1000) + 1 + (i % 5)]);
    const t = Date.now();
    const r = eraseOverlapIntervals(intervals);
    expect(Date.now() - t).toBeLessThan(900);
    expect(r).toBeGreaterThan(0);
  });
});
```

%% hints
- Sort a copy by `end`; `let kept = 0, lastEnd = -Infinity`; for each `[s, e]`: if `s >= lastEnd` keep it and set `lastEnd = e`.
- Return `intervals.length - kept`.

%% solution
```js
export function eraseOverlapIntervals(intervals) {
  const sorted = intervals.slice().sort((a, b) => a[1] - b[1]);
  let kept = 0;
  let lastEnd = -Infinity;
  for (const [start, end] of sorted) {
    if (start >= lastEnd) {
      kept++;
      lastEnd = end;
    }
  }
  return intervals.length - kept;
}
```

%% exercise alg-meeting-rooms | Meeting rooms | 3 | js | js | minMeetingRooms | 26
Given meetings as `[start, end]`, return the **minimum number of rooms** needed so no two meetings in the same room overlap. A meeting that ends at time `t` frees its room for one starting at `t`. Don't modify the input. It must be **O(n log n)**: 200 000 meetings are tested.

```js
minMeetingRooms([[0, 30], [5, 10], [15, 20]]); // 2
minMeetingRooms([[7, 10], [2, 4]]);            // 1
```

%% worked
**A similar problem, solved: `peakVisitors(visits)`** — the most people in a building at once, from `[enter, leave]` times.

```js
function peakVisitors(visits) {
  const starts = visits.map((v) => v[0]).sort((a, b) => a - b);
  const ends = visits.map((v) => v[1]).sort((a, b) => a - b);
  let inside = 0, peak = 0, e = 0;
  for (const s of starts) {
    while (e < ends.length && ends[e] <= s) { inside--; e++; }   // ① everyone who left by time s is gone
    inside++;                                                    // ② this person arrives
    if (inside > peak) peak = inside;
  }
  return peak;
}
```

Rooms are the **same question** — "most meetings in progress at once". Sort the **starts** and the **ends** separately. For each start (in order), first free every room whose meeting has ended by then (`end <= start`), then occupy one. The highest number occupied at any moment is the answer.

%% explain
- **Starts and ends sorted separately**.
- **Free** rooms with `end <= start` before taking one.
- **Answer** = the peak number of rooms in use.
- **Touching meetings share a room**.

%% nudge
- Why can you sort starts and ends independently?
- At the same time, do you free rooms before or after taking a new one?

%% starter
```js
export function minMeetingRooms(intervals) {
  // your code
  return 0;
}
```

%% tests
```js
describe('minMeetingRooms', () => {
  it('counts the rooms needed', () => {
    expect(minMeetingRooms([[0, 30], [5, 10], [15, 20]])).toBe(2);
    expect(minMeetingRooms([[7, 10], [2, 4]])).toBe(1);
    expect(minMeetingRooms([[1, 5], [2, 6], [3, 7], [4, 8]])).toBe(4);
  });

  it('lets touching meetings share a room', () => {
    expect(minMeetingRooms([[1, 5], [5, 8]])).toBe(1);
    expect(minMeetingRooms([[1, 5], [5, 8], [8, 9]])).toBe(1);
  });

  it('handles empty and single meetings', () => {
    expect(minMeetingRooms([])).toBe(0);
    expect(minMeetingRooms([[3, 4]])).toBe(1);
  });

  it('does not modify the input', () => {
    const input = [[5, 6], [1, 9], [2, 3]];
    minMeetingRooms(input);
    expect(input).toEqual([[5, 6], [1, 9], [2, 3]]);
  });

  it('matches a sweep line on small random inputs', () => {
    let seed = 41;
    const rand = (m) => (seed = (seed * 48271) % 2147483647) % m;
    for (let round = 0; round < 40; round++) {
      const meetings = Array.from({ length: 1 + (round % 9) }, () => { const a = rand(12); return [a, a + 1 + rand(5)]; });
      let peak = 0;
      for (let t = 0; t < 20; t++) peak = Math.max(peak, meetings.filter(([s, e]) => s <= t && t < e).length);
      expect(minMeetingRooms(meetings)).toBe(peak);
    }
  });

  it('is O(n log n): 200 000 meetings', () => {
    const n = 200000;
    const meetings = Array.from({ length: n }, (_, i) => [i, i + 3]);
    const t = Date.now();
    expect(minMeetingRooms(meetings)).toBe(3);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `starts` and `ends` are sorted arrays of just those numbers.
- For each start: `while (ends[e] <= start) { rooms--; e++; }`, then `rooms++`, `peak = Math.max(peak, rooms)`.

%% solution
```js
export function minMeetingRooms(intervals) {
  const starts = intervals.map((x) => x[0]).sort((a, b) => a - b);
  const ends = intervals.map((x) => x[1]).sort((a, b) => a - b);
  let rooms = 0;
  let peak = 0;
  let e = 0;
  for (const s of starts) {
    while (e < ends.length && ends[e] <= s) {
      rooms--;
      e++;
    }
    rooms++;
    if (rooms > peak) peak = rooms;
  }
  return peak;
}
```

%% exercise alg-partition-labels | Partition labels | 3 | js | js | partitionLabels | 24
Split a string of lowercase letters into **as many parts as possible** so that **each letter appears in at most one part**. Return the **sizes** of the parts, in order. It must be **O(n)**: a million characters are tested.

```js
partitionLabels('ababcbacadefegdehijhklij'); // [9, 7, 8]
```

%% worked
**A similar problem, solved: `lastIndexMap(s)`** — the step the solution starts from.

```js
function lastIndexMap(s) {
  const last = new Map();
  for (let i = 0; i < s.length; i++) last.set(s[i], i);     // ① later occurrences overwrite earlier ones
  return last;
}
```

Walk the string with a running `end`: for each character, `end = max(end, last[char])` — *this part can't close before the last time any of its letters appears*. When the index `i` reaches `end`, nothing inside the part occurs later: record `end − start + 1` and start a new part at `i + 1`.

%% explain
- **`last[ch]`**: the last index of each letter.
- **`end`** grows as you meet letters that appear later.
- **Close the part** when `i === end`.
- **`''`** returns `[]`; a string where one letter spans everything is one part.

%% nudge
- When is it safe to close the current part?
- What does meeting a letter with a far-away last occurrence do?

%% starter
```js
export function partitionLabels(s) {
  // your code
  return [];
}
```

%% tests
```js
describe('partitionLabels', () => {
  it('splits into the most parts', () => {
    expect(partitionLabels('ababcbacadefegdehijhklij')).toEqual([9, 7, 8]);
    expect(partitionLabels('eccbbbbdec')).toEqual([10]);
  });

  it('handles all-distinct letters', () => {
    expect(partitionLabels('abc')).toEqual([1, 1, 1]);
  });

  it('handles empty and single-letter strings', () => {
    expect(partitionLabels('')).toEqual([]);
    expect(partitionLabels('a')).toEqual([1]);
    expect(partitionLabels('aaaa')).toEqual([4]);
  });

  it('sizes add up to the string length', () => {
    const s = 'caedbdedda';
    const sizes = partitionLabels(s);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(s.length);
    expect(sizes).toEqual([1, 9]);
  });

  it('is linear: a million characters', () => {
    const s = 'abcdefghij'.repeat(100000);
    const t = Date.now();
    expect(partitionLabels(s)).toEqual([1000000]);
    expect(partitionLabels('abcdefghijklmnopqrstuvwxyz').length).toBe(26);
    expect(Date.now() - t).toBeLessThan(700);
  });
});
```

%% hints
- Build `last` (letter → last index). Then `start = 0, end = 0`; for each `i`: `end = Math.max(end, last[s[i]])`.
- If `i === end`, push `end - start + 1` and set `start = i + 1`.

%% solution
```js
export function partitionLabels(s) {
  const last = new Map();
  for (let i = 0; i < s.length; i++) last.set(s[i], i);
  const sizes = [];
  let start = 0;
  let end = 0;
  for (let i = 0; i < s.length; i++) {
    end = Math.max(end, last.get(s[i]));
    if (i === end) {
      sizes.push(end - start + 1);
      start = i + 1;
    }
  }
  return sizes;
}
```
