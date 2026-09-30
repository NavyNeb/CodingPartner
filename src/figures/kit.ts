/*
 * A tiny SVG diagram kit. Figures are built in code so they stay consistent, theme with the site's
 * CSS variables (light/dark) and keep real, selectable text. Styling lives in app.css (.fig-*, .t-*).
 */

export type Tone = 'ink' | 'accent' | 'pass' | 'fail' | 'info' | 'muted';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let uid = 0;

interface TextOpts { tone?: Tone; size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; mono?: boolean; italic?: boolean }
interface BoxOpts { tone?: Tone; label?: string; sub?: string; dashed?: boolean; r?: number; mono?: boolean; solid?: boolean; id?: string }
interface LineOpts { tone?: Tone; dashed?: boolean; arrow?: boolean; width?: number }

export class Fig {
  private parts: string[] = [];
  private id = `f${++uid}`;
  animated = false;

  constructor(private w: number, private h: number, private alt: string) {}

  raw(s: string) { this.parts.push(s); return this; }

  box(x: number, y: number, w: number, h: number, o: BoxOpts = {}) {
    const tone = o.tone ?? 'ink';
    const cls = `f-box t-${tone}${o.dashed ? ' dashed' : ''}${o.solid ? ' solid' : ''}`;
    this.parts.push(`<rect${o.id ? ` id="${this.id}-${o.id}"` : ''} class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 8}"/>`);
    if (o.label && o.sub) {
      this.text(x + w / 2, y + h / 2 - 4, o.label, { anchor: 'middle', bold: true, tone: o.solid ? 'ink' : tone, mono: o.mono });
      this.text(x + w / 2, y + h / 2 + 14, o.sub, { anchor: 'middle', size: 12, tone: 'muted', mono: o.mono });
    } else if (o.label) {
      this.text(x + w / 2, y + h / 2 + 5, o.label, { anchor: 'middle', tone: o.solid ? 'ink' : tone, bold: true, mono: o.mono });
    }
    return this;
  }

  text(x: number, y: number, s: string, o: TextOpts = {}) {
    const cls = `f-text t-${o.tone ?? 'ink'}${o.bold ? ' b' : ''}${o.mono ? ' m' : ''}${o.italic ? ' i' : ''}`;
    this.parts.push(`<text class="${cls}" x="${x}" y="${y}" font-size="${o.size ?? 14}" text-anchor="${o.anchor ?? 'start'}">${esc(s)}</text>`);
    return this;
  }

  /** Multi-line text, one <tspan> per line. */
  lines(x: number, y: number, rows: string[], o: TextOpts & { gap?: number } = {}) {
    rows.forEach((r, i) => this.text(x, y + i * (o.gap ?? 18), r, o));
    return this;
  }

  line(x1: number, y1: number, x2: number, y2: number, o: LineOpts = {}) {
    return this.path(`M${x1} ${y1} L${x2} ${y2}`, o);
  }

  path(d: string, o: LineOpts = {}) {
    const cls = `f-line t-${o.tone ?? 'ink'}${o.dashed ? ' dashed' : ''}`;
    this.parts.push(`<path class="${cls}" d="${d}" fill="none"${o.width ? ` stroke-width="${o.width}"` : ''}${o.arrow ? ` marker-end="url(#${this.id}-ah-${o.tone ?? 'ink'})"` : ''}/>`);
    return this;
  }

  /** A numbered callout badge — the lesson text refers to these ("look at ①"). */
  num(x: number, y: number, n: number) {
    this.parts.push(`<g class="f-num"><circle cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="13">${n}</text></g>`);
    return this;
  }

  pill(x: number, y: number, label: string, tone: Tone = 'ink') {
    const w = Math.max(40, label.length * 8 + 18);
    this.parts.push(`<rect class="f-box t-${tone} solid" x="${x}" y="${y}" width="${w}" height="24" rx="12"/>`);
    this.text(x + w / 2, y + 16, label, { anchor: 'middle', size: 12.5, tone, bold: true, mono: true });
    return this;
  }

  /** A dot that travels along a path forever. */
  packet(d: string, dur = 3, tone: Tone = 'accent', begin = 0) {
    this.animated = true;
    this.parts.push(`<circle class="f-dot t-${tone}" r="6"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${d}"/></circle>`);
    return this;
  }

  /** Pulse an element-shaped highlight on/off (opacity). */
  blink(x: number, y: number, w: number, h: number, tone: Tone = 'accent', dur = 2, begin = 0, r = 8) {
    this.animated = true;
    this.parts.push(`<rect class="f-blink t-${tone}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" opacity="0"><animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.75;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></rect>`);
    return this;
  }

  /** Show a group of elements only during a slice of a repeating cycle. */
  phase(from: number, to: number, cycle: number, inner: (f: Fig) => void) {
    this.animated = true;
    const sub = new Fig(this.w, this.h, this.alt);
    inner(sub);
    const a = from / cycle, b = to / cycle;
    const kt = [0, Math.max(a - 0.001, 0), a, b, Math.min(b + 0.001, 1), 1].map((n) => +n.toFixed(4));
    const vals = [0, 0, 1, 1, 0, 0].join(';');
    this.parts.push(`<g opacity="0"><animate attributeName="opacity" values="${vals}" keyTimes="${kt.join(';')}" dur="${cycle}s" repeatCount="indefinite"/>${sub.parts.join('')}</g>`);
    return this;
  }

  svg(): string {
    const tones: Tone[] = ['ink', 'accent', 'pass', 'fail', 'info', 'muted'];
    const defs = tones
      .map((t) => `<marker id="${this.id}-ah-${t}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="f-head t-${t}" d="M1 1 L9 5 L1 9 z"/></marker>`)
      .join('');
    return `<svg class="fig-svg" viewBox="0 0 ${this.w} ${this.h}" role="img" aria-label="${esc(this.alt).replace(/"/g, '&quot;')}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${this.parts.join('')}</svg>`;
  }
}

export interface Figure { svg: string; animated: boolean }
export type FigureBuilder = () => Fig;
