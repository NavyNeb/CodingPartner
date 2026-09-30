/*
 * Parsers for the interactive blocks that can appear in lesson Markdown as fenced code:
 *
 *   ```js try            → a runnable snippet ("try predict" asks the learner to guess the output first)
 *   ```check             → a short multiple-choice concept check
 *   ```stepper Title     → a step-through walkthrough (scrubbable "GIF")
 *
 * Pure functions, shared by the app and by scripts/verify.ts (which lints every block).
 */

export interface CheckQuestion {
  q: string;
  code?: string;
  options: string[];
  answer: number;
  why: string;
}

export interface StepperFrame {
  /** 1-based inclusive code line range to highlight. */
  line?: [number, number];
  say: string;
  /** Panel name → items (only the panels this frame changes; the rest carry over). */
  panels: Record<string, string[]>;
}

export interface StepperData {
  title: string;
  code: string[];
  panelNames: string[];
  frames: StepperFrame[];
}

/* ───────── check ───────── */

export function parseCheck(body: string): CheckQuestion[] {
  const questions: CheckQuestion[] = [];
  for (const chunk of body.split(/^---\s*$/m)) {
    const lines = chunk.replace(/\r/g, '').split('\n');
    const q: CheckQuestion = { q: '', options: [], answer: -1, why: '' };
    let mode: 'q' | 'code' | 'why' | null = null;
    const code: string[] = [];
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim() && mode !== 'code') continue;
      let m: RegExpExecArray | null;
      if ((m = /^Q:\s*(.*)$/.exec(line))) { q.q = m[1]; mode = 'q'; }
      else if (/^Code:\s*$/.test(line)) { mode = 'code'; }
      else if ((m = /^([A-F])\)\s*(.*?)(\s*\*)?$/.exec(line))) {
        q.options.push(m[2]);
        if (m[3]) q.answer = q.options.length - 1;
        mode = null;
      } else if ((m = /^Why:\s*(.*)$/.exec(line))) { q.why = m[1]; mode = 'why'; }
      else if (mode === 'code') code.push(line.replace(/^ {2}/, ''));
      else if (mode === 'q') q.q += ' ' + line.trim();
      else if (mode === 'why') q.why += ' ' + line.trim();
    }
    if (!q.q && !q.options.length) continue;
    if (code.length) q.code = code.join('\n').replace(/\n+$/, '');
    if (!q.q || q.options.length < 2 || q.answer < 0 || !q.why) {
      throw new Error(`check: each question needs "Q:", 2+ options with one marked "*", and "Why:" (got: ${q.q || chunk.slice(0, 40)})`);
    }
    questions.push(q);
  }
  if (!questions.length) throw new Error('check: no questions found');
  return questions;
}

/* ───────── stepper ───────── */

export function parseStepper(info: string, body: string): StepperData {
  const title = info.replace(/^stepper\s*/, '').trim() || 'Step by step';
  const sections = body.replace(/\r/g, '').split(/^---\s*$/m);
  const head = sections.shift() ?? '';
  const code: string[] = [];
  let inCode = false;
  for (const l of head.split('\n')) {
    if (/^code:\s*$/.test(l)) { inCode = true; continue; }
    if (inCode) code.push(l.replace(/^ {2}/, ''));
  }
  while (code.length && !code[code.length - 1].trim()) code.pop();

  const panelNames: string[] = [];
  const frames: StepperFrame[] = [];
  for (const section of sections) {
    if (!section.trim()) continue;
    const frame: StepperFrame = { say: '', panels: {} };
    let inSay = false;
    for (const raw of section.split('\n')) {
      if (!raw.trim()) { inSay = false; continue; }
      let m: RegExpExecArray | null;
      if ((m = /^line:\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(raw))) {
        frame.line = [+m[1], +(m[2] ?? m[1])];
        inSay = false;
      } else if ((m = /^say:\s*(.*)$/.exec(raw))) {
        frame.say = m[1];
        inSay = true;
      } else if (inSay && /^\s+\S/.test(raw)) {
        frame.say += ' ' + raw.trim();
      } else if ((m = /^([A-Za-z][^:]*?):\s*(.*)$/.exec(raw))) {
        const name = m[1].trim();
        if (!panelNames.includes(name)) panelNames.push(name);
        frame.panels[name] = m[2].trim() ? m[2].split('|').map((s) => s.trim()).filter(Boolean) : [];
        inSay = false;
      } else {
        throw new Error(`stepper "${title}": cannot read line "${raw}"`);
      }
    }
    if (!frame.say) throw new Error(`stepper "${title}": every frame needs "say:"`);
    if (frame.line && (frame.line[0] < 1 || frame.line[1] > code.length)) {
      throw new Error(`stepper "${title}": line ${frame.line.join('-')} is outside the ${code.length}-line code`);
    }
    frames.push(frame);
  }
  if (!frames.length) throw new Error(`stepper "${title}": no frames`);
  return { title, code, panelNames, frames };
}

/** Resolve carried-over panels so every frame has a full picture. */
export function resolveFrames(data: StepperData): Record<string, string[]>[] {
  const out: Record<string, string[]>[] = [];
  let current: Record<string, string[]> = Object.fromEntries(data.panelNames.map((n) => [n, []]));
  for (const f of data.frames) {
    current = { ...current, ...f.panels };
    out.push(current);
  }
  return out;
}

/* ───────── extraction (used by verify) ───────── */

/** Stable key for a check block, used to remember that the learner finished it. */
export function checkKey(body: string): string {
  let h = 5381;
  for (let k = 0; k < body.length; k++) h = ((h << 5) + h + body.charCodeAt(k)) | 0;
  return `chk:${(h >>> 0).toString(36)}`;
}

export interface FoundBlocks {
  checkBodies: string[];
  tries: { lang: string; predict: boolean; code: string }[];
  checks: CheckQuestion[][];
  steppers: StepperData[];
  figs: string[];
}

export function findBlocks(md: string): FoundBlocks {
  const out: FoundBlocks = { checkBodies: [], tries: [], checks: [], steppers: [], figs: [] };
  const fence = /^(`{3,})([^\n]*)\n([\s\S]*?)\n\1\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(md))) {
    const info = m[2].trim().split(/\s+/);
    if (info[0] === 'check') { out.checks.push(parseCheck(m[3])); out.checkBodies.push(m[3]); }
    else if (info[0] === 'stepper') out.steppers.push(parseStepper(m[2].trim(), m[3]));
    else if (info.includes('try')) out.tries.push({ lang: info[0], predict: info.includes('predict'), code: m[3] });
  }
  const fig = /!\[[^\]]*\]\(fig:([\w-]+)/g;
  while ((m = fig.exec(md))) out.figs.push(m[1]);
  return out;
}
