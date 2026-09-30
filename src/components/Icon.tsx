import type { SVGProps } from 'react';

const P: Record<string, string> = {
  play: 'M7 4.5v15l12-7.5z',
  reset: 'M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  arrowRight: 'M4 12h16M14 6l6 6-6 6',
  arrowLeft: 'M20 12H4M10 6l-6 6 6 6',
  check: 'M4.5 12.5l5 5 10-11',
  x: 'M6 6l12 12M18 6L6 18',
  sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  timer: 'M12 8v4l2.5 2.5M9 2h6M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  flask: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3',
  key: 'M14.5 9.5a4 4 0 1 0-3 3.9L13 15h2v2h2v2h3v-3l-5.6-5.6',
  terminal: 'M4 5h16v14H4zM7.5 9.5l3 2.5-3 2.5M12.5 15h4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  menu: 'M4 7h16M4 12h16M4 17h16',
};

export function Icon({ name, size = 16, ...rest }: { name: keyof typeof P | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} fill={name === 'play' ? 'currentColor' : 'none'} />
    </svg>
  );
}
