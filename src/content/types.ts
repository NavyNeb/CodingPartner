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
