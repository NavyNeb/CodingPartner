import type { TrackMeta } from './parse';

export const trackMeta: TrackMeta[] = [
  {
    id: 'js',
    title: 'JavaScript, properly',
    blurb: 'Closures, `this`, promises, the event loop, iterators — the semantics interviewers actually probe, drilled until they are reflex again.',
  },
  {
    id: 'ts',
    title: 'TypeScript, for real',
    blurb: 'Type-level exercises checked by the actual compiler: generics, mapped and conditional types, narrowing.',
  },
  {
    id: 'ds',
    title: 'Data structures, from scratch',
    blurb: 'How arrays, hash tables, lists, trees, heaps and graphs actually work — build each one yourself, then use it to solve real problems.',
  },
  {
    id: 'algo',
    title: 'Algorithm patterns',
    blurb: 'The handful of problem-solving patterns behind most interview questions: recursion, two pointers, sliding windows, backtracking, dynamic programming and greedy choices.',
  },
  {
    id: 'test',
    title: 'Testing, properly',
    blurb: 'Write tests that catch real bugs: cases and edge cases, test doubles, async code and timers, React Testing Library, TDD and design for testability. Many exercises grade the tests you write against deliberately broken implementations.',
  },
  {
    id: 'pat',
    title: 'Design patterns in JS/TS',
    blurb: 'The patterns that keep real code flexible, written the JavaScript way with functions and closures: factories and builders, strategy and state, observers, decorators and middleware, commands and undo, adapters, composites and visitors.',
  },
  {
    id: 'react',
    title: 'React, under the hood',
    blurb: 'Components, state, effects, custom hooks and architecture patterns — tested through the DOM, the way you would in a real codebase.',
  },
  {
    id: 'prod',
    title: 'Production scenarios',
    blurb: 'Real incidents from real systems — live odds feeds, 20 000-row screens, flaky sockets, leaky tabs — and the patterns that fix them. Each case study starts with the symptom, then you build the fix against a stress harness.',
  },
  {
    id: 'interview',
    title: 'Interview gauntlet',
    blurb: 'Senior-level problems in the shapes that come up on live-coding rounds. Timed mode recommended.',
  },
  {
    id: 'web',
    title: 'The web platform',
    blurb: 'What senior frontend interviews probe beyond frameworks: the DOM and event model, the rendering pipeline, HTTP caching and fetch, and the performance metrics that decide whether a page feels fast.',
  },
  {
    id: 'system',
    title: 'Frontend system design',
    blurb: 'A repeatable method for open-ended design rounds, then the building blocks of the classic questions — feeds, typeahead, chat — as small, testable pieces.',
  },
];
