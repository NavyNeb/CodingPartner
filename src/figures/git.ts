import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── 1 · How Git stores history ───────────────────────── */

const objectsFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Git stores three kinds of objects, each named by a hash of its content. A commit points to one tree and to its parent commits. A tree lists file names with the blobs or subtrees they point to. A blob is just the content of one file. An unchanged file in a later commit points to the same blob, so it is stored only once.');
  f.box(236, 14, 168, 44, { tone: 'accent', solid: true, label: 'commit  c2', size: 12.5, mono: true });
  f.box(236, 100, 168, 44, { tone: 'info', label: 'tree  t2', size: 12.5, mono: true });
  f.path('M320 60 V98', { arrow: true, tone: 'muted', width: 1.6 });
  f.box(40, 190, 150, 40, { tone: 'pass', label: 'blob a  (README)', size: 11, mono: true });
  f.box(245, 190, 150, 40, { tone: 'pass', label: 'blob b2 (app.js)', size: 11, mono: true });
  f.box(450, 190, 150, 40, { tone: 'muted', label: 'blob b1 (old)', size: 11, mono: true });
  f.path('M290 146 L125 188', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M320 146 V188', { arrow: true, tone: 'muted', width: 1.4 });
  f.box(22, 40, 150, 40, { tone: 'muted', label: 'commit  c1 (parent)', size: 11, mono: true });
  f.path('M236 36 H174', { arrow: true, tone: 'muted', width: 1.4 });
  f.text(W / 2, 258, 'README unchanged: same blob, stored once. Only app.js, the tree and the commit are new.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 280, 'The name IS the content: change a byte and the hash, and everything above it, changes.', { anchor: 'middle', size: 11.5, tone: 'muted', italic: true });
  return f;
};

const dagFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'A commit graph with two branches. Main has commits A, B and E. A feature branch split from B and has commits C and D. A merge commit M has two parents, E and D. Branch names are only pointers to a commit, and HEAD points to the branch you are on. The merge base of E and D is B, the nearest commit both can reach.');
  const node = (x: number, y: number, label: string, tone: Tone) => f.box(x, y, 52, 36, { tone, solid: true, label, size: 13, mono: true });
  node(30, 50, 'A', 'muted');
  node(120, 50, 'B', 'accent');
  node(300, 50, 'E', 'info');
  node(480, 50, 'M', 'pass');
  node(210, 130, 'C', 'info');
  node(300, 130, 'D', 'info');
  f.path('M118 68 H84', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M200 68 H174', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M298 68 H228', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M208 138 L158 90', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M298 148 H264', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M478 62 H354', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M490 90 C 470 150 400 150 354 148', { arrow: true, tone: 'muted', width: 1.4 });
  f.text(326, 34, 'main', { anchor: 'middle', size: 11, bold: true, mono: true, tone: 'info' });
  f.text(326, 184, 'feature', { anchor: 'middle', size: 11, bold: true, mono: true, tone: 'info' });
  f.text(W / 2, 222, 'Arrows point to parents: history only ever points backwards.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 248, 'merge base(E, D) = B: the nearest commit that both lines of work can reach.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const refsFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Refs are movable labels. The branch main is a file containing one commit hash, and HEAD usually points to a branch. Making a commit creates a new object and moves the current branch label forward; old commits are not changed. After a rebase or reset the old commits may no longer be reachable from any label, so they are eventually garbage collected, but the reflog remembers where each label used to point for a while.');
  f.box(8, 24, 130, 36, { tone: 'accent', solid: true, label: 'HEAD', size: 13, mono: true });
  f.path('M140 42 H174', { arrow: true, tone: 'muted', width: 1.6 });
  f.box(176, 24, 130, 36, { tone: 'info', solid: true, label: 'main', size: 13, mono: true });
  f.path('M308 42 H356', { arrow: true, tone: 'muted', width: 1.6 });
  f.box(358, 24, 90, 36, { tone: 'pass', solid: true, label: 'c3', size: 13, mono: true });
  f.box(468, 24, 80, 36, { tone: 'muted', label: 'c2', size: 12, mono: true });
  f.box(560, 24, 70, 36, { tone: 'muted', label: 'c1', size: 12, mono: true });
  f.box(358, 100, 90, 36, { tone: 'fail', label: 'c3 old', size: 12, mono: true });
  f.text(W / 2, 176, 'git commit: write objects, then move the branch label. Nothing is edited in place.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 204, 'Rewriting history (rebase, amend, reset) creates NEW commits and moves the label.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 230, 'The old commits (red) are unreachable: gc removes them, the reflog can still find them.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 256, 'Detached HEAD = HEAD points straight at a commit, not at a branch.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 2 · Branching, merging, rebasing ───────────────────────── */

const mergeKindsFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Three ways to integrate a branch. A fast forward is possible when main has not moved: the main label just slides forward and no new commit is made. If both have new commits, a three way merge creates a merge commit with two parents. A squash merge combines all of the branch commits into a single new commit on main with one parent, so the branch history is not kept.');
  const row = (y: number, title: string, items: [number, string, Tone][], note: string) => {
    f.text(8, y + 22, title, { size: 11.5, bold: true, mono: true });
    items.forEach(([x, label, tone]) => f.box(x, y + 4, 44, 30, { tone, solid: tone !== 'muted', label, size: 11.5, mono: true }));
    f.text(560, y + 24, note, { anchor: 'end', size: 10.5, tone: 'muted' });
  };
  row(14, 'fast-forward', [[170, 'A', 'muted'], [240, 'B', 'muted'], [310, 'C', 'pass'], [380, 'D', 'pass']], 'no new commit');
  row(84, 'merge commit', [[170, 'A', 'muted'], [240, 'B', 'info'], [310, 'C', 'info'], [380, 'M', 'pass']], '2 parents');
  row(154, 'squash', [[170, 'A', 'muted'], [240, 'B', 'info'], [310, 'S', 'pass']], 'C+D → S');
  f.text(W / 2, 222, 'Fast-forward when you can, a merge commit when histories diverged, a squash for a messy branch.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 250, 'Squash and rebase give a linear history; a merge commit keeps the real shape of the work.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 276, 'Rule of thumb: never rewrite history other people already build on.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const rebaseFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Rebase. A feature branch with commits D and E started from B, but main has since moved on to C. Rebasing replays D and E on top of C, creating new commits D prime and E prime with different hashes. The old D and E are left behind, unreachable. The result is a straight line of history.');
  f.text(12, 34, 'before', { size: 11.5, bold: true, mono: true });
  const n = (x: number, y: number, l: string, t: Tone) => f.box(x, y, 46, 32, { tone: t, solid: true, label: l, size: 12, mono: true });
  n(90, 18, 'A', 'muted'); n(160, 18, 'B', 'muted'); n(230, 18, 'C', 'info'); n(230, 62, 'D', 'accent'); n(300, 62, 'E', 'accent');
  f.text(12, 150, 'after', { size: 11.5, bold: true, mono: true });
  n(90, 134, 'A', 'muted'); n(160, 134, 'B', 'muted'); n(230, 134, 'C', 'info'); n(300, 134, "D'", 'pass'); n(370, 134, "E'", 'pass');
  f.box(470, 62, 100, 32, { tone: 'fail', label: 'old D, E', size: 11, mono: true });
  f.text(W / 2, 214, "D' and E' are NEW commits: same changes, new parents, new hashes.", { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 240, 'Safe on your own branch. Never rebase commits others have pulled.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 264, 'Pushing a rebased branch needs --force-with-lease, which refuses if someone else pushed.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const conflictFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Three way merge input and output. The base version of a line is compared with our version and their version. If only one side changed it, that side wins. If both made the same change, it is taken once. If both changed it differently, Git cannot choose and writes conflict markers around the two versions for a person to resolve.');
  const col = (x: number, title: string, lines: string[], tone: Tone) => {
    f.box(x, 16, 148, 96, { tone });
    f.text(x + 74, 36, title, { anchor: 'middle', size: 12, bold: true });
    lines.forEach((l, i) => f.text(x + 74, 62 + i * 22, l, { anchor: 'middle', size: 11.5, mono: true }));
  };
  col(8, 'base', ['timeout = 30'], 'muted');
  col(172, 'ours', ['timeout = 60'], 'info');
  col(336, 'theirs', ['timeout = 45'], 'accent');
  f.path('M246 114 V140', { arrow: true, tone: 'muted', width: 1.6 });
  f.box(150, 142, 340, 82, { tone: 'fail' });
  ['<<<<<<< ours', 'timeout = 60', '=======', 'timeout = 45', '>>>>>>> theirs'].forEach((l, i) => f.text(166, 160 + i * 14, l, { size: 11, mono: true }));
  f.text(W / 2, 254, 'Only one side changed? Take it. Same change twice? Take one. Different changes? Ask a human.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 276, 'Edits to ADJACENT lines also conflict: Git cannot tell they are independent.', { anchor: 'middle', size: 11.5, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 3 · Diff, patch, bisect, undo ───────────────────────── */

const diffFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'A line diff. Two versions of a file are compared by finding the longest common subsequence of lines. Lines in the common part are context, lines only in the old version are removed and shown with a minus, and lines only in the new version are added and shown with a plus. A changed line therefore appears as one removal followed by one addition.');
  const col = (x: number, title: string, lines: string[]) => {
    f.box(x, 16, 150, 120, { tone: 'muted' });
    f.text(x + 75, 36, title, { anchor: 'middle', size: 12, bold: true });
    lines.forEach((l, i) => f.text(x + 14, 62 + i * 20, l, { size: 12, mono: true }));
  };
  col(8, 'old', ['port = 80', 'debug = off', 'name = app', 'mode = dev']);
  col(176, 'new', ['port = 80', 'debug = on', 'name = app', 'mode = dev']);
  f.path('M328 76 H352', { arrow: true, tone: 'muted', width: 1.6 });
  f.box(354, 16, 278, 120, { tone: 'info' });
  f.text(368, 40, '  port = 80', { size: 12, mono: true });
  f.text(368, 60, '- debug = off', { size: 12, mono: true, tone: 'fail' });
  f.text(368, 80, '+ debug = on', { size: 12, mono: true, tone: 'pass' });
  f.text(368, 100, '  name = app', { size: 12, mono: true });
  f.text(368, 120, '  mode = dev', { size: 12, mono: true });
  f.text(W / 2, 178, 'A diff is the minimal edit script that turns the old lines into the new lines.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 206, 'Unified diff hunks start with @@ -oldStart,oldCount +newStart,newCount @@ and carry context lines.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 234, 'A patch only applies if its context and removed lines still match the target file.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const bisectFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Git bisect. A range of commits starts with a known good commit at the left and a known bad commit at the right. Testing the middle commit halves the range each time. Sixteen commits need at most four tests to find the first bad commit.');
  for (let i = 0; i < 16; i++) {
    const bad = i >= 11;
    f.box(8 + i * 39, 30, 34, 34, { tone: bad ? 'fail' : 'pass', solid: i === 0 || i === 15 || i === 11, label: String(i), size: 10.5, mono: true });
  }
  f.text(25, 84, 'good', { anchor: 'middle', size: 10.5, tone: 'pass' });
  f.text(612, 84, 'bad', { anchor: 'middle', size: 10.5, tone: 'fail' });
  const tests: [number, string][] = [[7, '1 test 7 → good'], [11, '2 test 11 → bad'], [9, '3 test 9 → good'], [10, '4 test 10 → good']];
  tests.forEach(([idx, label], k) => f.text(W / 2, 118 + k * 22, label + '   → first bad is 11', { anchor: 'middle', size: 11.5, mono: true, tone: 'muted' }));
  f.text(W / 2, 224, 'log2(n) tests, however long the history: 1000 commits need only 10.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 250, 'git bisect run <script> automates it: exit 0 = good, 1 to 127 = bad, 125 = skip.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const undoFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'The undo toolbox. Revert adds a new commit that cancels an earlier one and is safe on shared branches. Reset moves the branch label backwards and can also change the index and the working tree, so it rewrites history and is only for private work. Restore changes files without touching history. The reflog records where labels used to point so a mistaken reset can be undone.');
  const rows: [string, string, string, Tone][] = [
    ['git revert <c>', 'new commit that cancels c', 'safe on shared branches', 'pass'],
    ['git reset --soft <c>', 'move the label, keep index + files', 'private branches only', 'accent'],
    ['git reset --hard <c>', 'move the label, DISCARD changes', 'destroys uncommitted work', 'fail'],
    ['git restore <file>', 'discard edits to one file', 'history untouched', 'info'],
    ['git reflog', 'where each label used to point', 'the safety net (weeks)', 'pass'],
  ];
  rows.forEach(([cmd, what, safety, tone], i) => {
    const y = 12 + i * 50;
    f.box(8, y, 170, 40, { tone, label: cmd, size: 10.5, mono: true });
    f.box(184, y, 244, 40, { tone: 'muted', label: what, size: 10.5 });
    f.box(434, y, 198, 40, { tone: 'muted', label: safety, size: 10.5 });
  });
  f.text(W / 2, 276, 'Shared history: revert. Private history: reset or amend. Lost something: reflog.', { anchor: 'middle', size: 12, bold: true });
  return f;
};

/* ───────────────────────── 4 · Team workflows and conventions ───────────────────────── */

const workflowsFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Two branching workflows. In trunk based development everyone merges small, short lived branches into main many times a day, hiding unfinished work behind feature flags, and releases from main. In Gitflow there are long lived develop and release branches, with features merged into develop and releases cut and stabilised on their own branches, which suits scheduled releases but adds merge overhead.');
  f.text(8, 24, 'trunk-based', { size: 12, bold: true, mono: true, tone: 'pass' });
  f.box(8, 34, 616, 32, { tone: 'pass', solid: true, label: 'main  ·  always releasable  ·  merged many times a day', size: 11.5 });
  [60, 180, 300, 420, 540].forEach((x) => f.box(x, 74, 70, 24, { tone: 'info', label: 'short', size: 10, mono: true }));
  f.text(8, 138, 'gitflow', { size: 12, bold: true, mono: true, tone: 'accent' });
  f.box(8, 148, 616, 26, { tone: 'muted', solid: true, label: 'main  ·  tagged releases only', size: 11 });
  f.box(8, 178, 616, 26, { tone: 'accent', solid: true, label: 'develop  ·  integration branch', size: 11 });
  f.box(60, 208, 160, 24, { tone: 'info', label: 'feature/*  (days)', size: 10, mono: true });
  f.box(250, 208, 160, 24, { tone: 'info', label: 'release/*  (stabilise)', size: 10, mono: true });
  f.box(440, 208, 160, 24, { tone: 'fail', label: 'hotfix/*', size: 10, mono: true });
  f.text(W / 2, 258, 'Short-lived branches + feature flags + fast CI beat long-lived branches for most teams.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 280, 'The longer a branch lives, the more painful (and risky) its merge.', { anchor: 'middle', size: 11.5, tone: 'muted', italic: true });
  return f;
};

const conventionalFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'A conventional commit message and what it drives. The header has a type, an optional scope in parentheses, an optional exclamation mark for breaking changes, and a subject. An optional body and footers follow. Tools read the type to decide the next semantic version: breaking changes bump the major number, features the minor number, and fixes the patch number.');
  f.box(8, 14, 624, 46, { tone: 'accent' });
  f.text(24, 44, 'feat(api)!: drop the v1 login endpoint', { size: 14, mono: true, bold: true });
  const parts: [number, number, string][] = [[24, 40, 'type'], [70, 40, 'scope'], [140, 14, '!'], [168, 130, 'subject']];
  parts.forEach(([x, w, l], i) => f.text(x + (i === 3 ? 0 : 0), 80, l, { size: 10.5, tone: 'muted', mono: true }));
  const rows: [string, string, Tone][] = [['BREAKING CHANGE or !', 'major  1.4.7 → 2.0.0', 'fail'], ['feat', 'minor  1.4.7 → 1.5.0', 'accent'], ['fix · perf', 'patch  1.4.7 → 1.4.8', 'info'], ['docs · chore · refactor · test', 'no release', 'muted']];
  rows.forEach(([a, b, tone], i) => {
    const y = 104 + i * 36;
    f.box(8, y, 290, 30, { tone, label: a, size: 11, mono: true });
    f.path(`M300 ${y + 15} H322`, { arrow: true, tone: 'muted', width: 1.4 });
    f.box(324, y, 308, 30, { tone: 'muted', label: b, size: 11, mono: true });
  });
  f.text(W / 2, 266, 'The highest bump among the commits since the last release wins.', { anchor: 'middle', size: 12, bold: true });
  return f;
};

const protectionFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Branch protection as a set of gates. A pull request into main must have the required number of approvals from people other than its author, an approval from a code owner for the files it touches, passing required status checks, an up to date branch, and optionally a linear history. If any gate is closed, the merge button is disabled.');
  const gates: [string, string][] = [['approvals', '2, not the author'], ['code owner', 'owns the touched files'], ['required checks', 'build · test · lint'], ['up to date', 'not behind main'], ['linear history', 'no merge commits']];
  gates.forEach(([t, sub], i) => {
    const x = 8 + i * 126;
    f.box(x, 22, 118, 70, { tone: 'accent' });
    f.text(x + 59, 48, t, { anchor: 'middle', size: 11.5, bold: true });
    f.text(x + 59, 72, sub, { anchor: 'middle', size: 9.5 });
  });
  f.path('M320 94 V124', { arrow: true, tone: 'muted', width: 1.6 });
  f.box(190, 126, 260, 44, { tone: 'pass', solid: true, label: 'all open  →  merge allowed', size: 12.5 });
  f.text(W / 2, 208, 'Stale approvals can be dismissed when new commits are pushed.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 234, 'CODEOWNERS: the LAST matching rule decides who must review a path.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 260, 'Rules apply to everyone, admins included, if "enforce for administrators" is on.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 5 · CI fundamentals ───────────────────────── */

const pipelineFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'A CI pipeline as a graph of jobs. Lint and test have no dependencies and start at once in parallel. Build needs lint. Deploy needs both test and build, so it waits for the slowest of them. A notify job is set to always run, so it runs even when something upstream failed. The total time is the length of the longest chain, the critical path, not the sum of all jobs.');
  const job = (x: number, y: number, label: string, sub: string, tone: Tone) => {
    f.box(x, y, 120, 48, { tone, solid: false });
    f.text(x + 60, y + 21, label, { anchor: 'middle', size: 12.5, bold: true, mono: true });
    f.text(x + 60, y + 38, sub, { anchor: 'middle', size: 10 });
  };
  job(8, 30, 'lint', '2 min', 'info');
  job(8, 100, 'test', '5 min', 'info');
  job(190, 30, 'build', '3 min · needs lint', 'accent');
  job(372, 64, 'deploy', '1 min · needs test, build', 'pass');
  job(520, 64, 'notify', 'always', 'muted');
  f.path('M130 54 H188', { arrow: true, tone: 'muted', width: 1.6 });
  f.path('M312 54 L370 84', { arrow: true, tone: 'muted', width: 1.6 });
  f.path('M130 124 L370 100', { arrow: true, tone: 'muted', width: 1.6 });
  f.path('M494 88 H518', { arrow: true, tone: 'muted', width: 1.6 });
  f.text(W / 2, 192, 'Critical path: lint → build → deploy = 6 min. The sum of all jobs is 11 min.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 220, 'Speed up the pipeline by shortening the critical path, not the biggest job.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 248, 'maxParallel (runner count) can stretch it: with one runner the jobs run one after another.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  f.text(W / 2, 274, 'A failed job skips whatever needs it, unless that job says "always".', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const matrixFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'A build matrix. Two operating systems and three Node versions expand into six jobs, one for every combination. An exclude entry removes a combination, and an include entry either adds a property to the combinations it matches or creates a new combination.');
  const oss = ['ubuntu', 'windows'];
  const nodes = ['18', '20', '22'];
  nodes.forEach((n, j) => f.text(150 + j * 110 + 45, 30, 'node ' + n, { anchor: 'middle', size: 11.5, bold: true, mono: true }));
  oss.forEach((o, i) => {
    f.text(8, 70 + i * 50, o, { size: 11.5, bold: true, mono: true });
    nodes.forEach((n, j) => {
      const excluded = i === 1 && j === 0;
      f.box(150 + j * 110, 44 + i * 50, 90, 38, { tone: excluded ? 'fail' : 'pass', solid: !excluded, label: excluded ? 'excluded' : 'job', size: 11 });
    });
  });
  f.box(150 + 3 * 110, 44, 90, 38, { tone: 'accent', label: '+ include', size: 10.5 });
  f.text(W / 2, 166, '2 × 3 = 6 combinations, minus 1 excluded = 5, plus 1 included = 6 jobs.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 194, 'Order: exclude is applied first, then include.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 222, 'Use fail-fast to stop the rest of the matrix early, and max-parallel to limit runner use.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 250, 'Do not matrix what you do not need to: every cell costs minutes.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const cacheFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Dependency caching. The cache key is built from the operating system and a hash of the lock file, so the key changes exactly when the dependencies change. An exact key match restores the cache and nothing needs saving. If there is no exact match, restore keys are tried in order as prefixes and the most recent match is restored, then the job saves a new cache under the exact key at the end.');
  f.box(8, 20, 624, 40, { tone: 'info', label: 'key: linux-npm-<hash of package-lock.json>', size: 12, mono: true });
  const rows: [string, string, Tone][] = [['exact match', 'restore it, skip saving', 'pass'], ['restore-keys: linux-npm-', 'newest prefix match, then save new', 'accent'], ['no match at all', 'cold install, then save', 'fail']];
  rows.forEach(([a, b, tone], i) => {
    const y = 80 + i * 46;
    f.box(8, y, 250, 36, { tone: 'muted', label: a, size: 11, mono: true });
    f.path(`M260 ${y + 18} H284`, { arrow: true, tone: 'muted', width: 1.4 });
    f.box(286, y, 346, 36, { tone, label: b, size: 11 });
  });
  f.text(W / 2, 236, 'Cache = speed (safe to lose). Artifact = output you want to keep or pass to another job.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 262, 'Never put secrets in a cache or an artifact.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

export const gitFigures: Record<string, FigureBuilder> = {
  'gt-objects': objectsFigure,
  'gt-dag': dagFigure,
  'gt-refs': refsFigure,
  'gt-merge-kinds': mergeKindsFigure,
  'gt-rebase': rebaseFigure,
  'gt-conflict': conflictFigure,
  'gt-diff': diffFigure,
  'gt-bisect': bisectFigure,
  'gt-undo': undoFigure,
  'gt-workflows': workflowsFigure,
  'gt-conventional': conventionalFigure,
  'gt-protection': protectionFigure,
  'gt-pipeline': pipelineFigure,
  'gt-matrix': matrixFigure,
  'gt-cache': cacheFigure,
};
