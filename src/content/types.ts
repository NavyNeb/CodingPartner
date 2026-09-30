export type Difficulty = 1 | 2 | 3 | 4;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: 'Warm-up',
  2: 'Core',
  3: 'Hard',
  4: 'Interview',
};

/** js: plain JS tests · react: TSX + DOM harness · types: compiler-checked type challenges */
export type Kind = 'js' | 'react' | 'types';
export type Lang = 'js' | 'ts' | 'tsx';

export interface Exercise {
  id: string;
  title: string;
  difficulty: Difficulty;
  kind: Kind;
  lang: Lang;
  /** Markdown shown in the Task tab. */
  prompt: string;
  starter: string;
  /** Test source. For `types` exercises, cases are separated by `//! case name` lines. */
  tests: string;
  /** Names the tests import from the learner's module. */
  exports: string[];
  hints: string[];
  solution: string;
  /** Suggested time-box for interview mode. Defaults by difficulty. */
  minutes?: number;
  /** Guided ramp-up: a pre-filled skeleton with step-by-step TODOs, for learners who are not ready for a blank editor. */
  guided?: boolean;
  /** Markdown: a solved, annotated problem of the same shape, shown before the learner starts. */
  worked?: string;
  /** Markdown: plain-English list of what the tests check and why. */
  explain?: string;
  /** Markdown: a gentle "stuck? think about…" nudge shown before the numbered hints. */
  nudge?: string;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  /** Markdown. */
  theory: string;
  exercises: Exercise[];
}

export interface Track {
  id: string;
  title: string;
  blurb: string;
  lessons: Lesson[];
}
