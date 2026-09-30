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
    id: 'react',
    title: 'React, under the hood',
    blurb: 'Components, state, effects, custom hooks and architecture patterns — tested through the DOM, the way you would in a real codebase.',
  },
  {
    id: 'interview',
    title: 'Interview gauntlet',
    blurb: 'Senior-level problems in the shapes that come up on live-coding rounds. Timed mode recommended.',
  },
];
