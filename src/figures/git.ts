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

export const gitFigures: Record<string, FigureBuilder> = {
  'gt-objects': objectsFigure,
  'gt-dag': dagFigure,
  'gt-refs': refsFigure,
};
