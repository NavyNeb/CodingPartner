/**
 * Visual-layout audit for every lesson figure, in light, dark and a 390px phone viewport.
 *
 *   npm run build && npm run audit:figures            (serves dist/ with the Whetstone server)
 *   npx tsx scripts/audit-figures.mts --url http://localhost:4173 --shots out/   (use an already running site)
 *
 * Per <text> element it flags: leaving the viewBox, crossing the border of a box it overlaps,
 * overlapping another text, and low contrast against what is behind it. On the phone viewport it
 * also warns when text renders smaller than 8px. Exit code 1 when any hard issue is found.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { buildTracks } from '../src/content/parse.ts';
import { trackMeta } from '../src/content/tracks.ts';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const shots = flag('--shots');
let base = flag('--url');

const dir = new URL('../src/content/lessons/', import.meta.url).pathname;
const sources: Record<string, string> = {};
for (const f of readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) sources[`./lessons/${f}`] = readFileSync(join(dir, f), 'utf8');
const lessons = buildTracks(sources, trackMeta).flatMap((t) => t.lessons).filter((l) => /\]\(fig:/.test(l.theory));

let server: ReturnType<typeof spawn> | undefined;
if (!base) {
  const port = 8791;
  server = spawn('node', ['--disable-warning=ExperimentalWarning', 'server/index.ts'], {
    env: { ...process.env, PORT: String(port), DATA_DIR: join(process.env.TMPDIR ?? '/tmp', `whetstone-audit-${process.pid}`) },
    stdio: 'ignore',
  });
  base = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
}

const modes = [
  { name: 'light', viewport: { width: 1200, height: 900 }, scheme: 'light' as const },
  { name: 'dark', viewport: { width: 1200, height: 900 }, scheme: 'dark' as const },
  { name: 'phone', viewport: { width: 390, height: 844 }, scheme: 'light' as const },
];

interface Issue { lesson: string; fig: string; mode: string; kind: string; detail: string }
const hard: Issue[] = [];
const soft: Issue[] = [];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let figCount = 0;

for (const mode of modes) {
  const ctx = await browser.newContext({ viewport: mode.viewport, colorScheme: mode.scheme });
  await ctx.addInitScript('window.__name = (f) => f;'); // tsx wraps functions with __name; the page has no such helper
  const page = await ctx.newPage();
  for (const lesson of lessons) {
    await page.goto(`${base}/#/lesson/${lesson.id}`);
    await page.waitForSelector('figure.fig svg', { timeout: 15000 });
    await page.evaluate(() => Promise.all(['400 14px "IBM Plex Sans"', '600 14px "IBM Plex Sans"', 'italic 400 14px "IBM Plex Sans"', '400 14px "JetBrains Mono Variable"', '600 14px "JetBrains Mono Variable"'].map((f) => document.fonts.load(f))));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const found = await page.evaluate(() => {
      const parse = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
      const over = (top: number[], under: number[]) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
      const lum = (c: number[]) => { const f = c.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
      const contrast = (a: number[], b: number[]) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
      const pageBg = parse(getComputedStyle(document.body).backgroundColor);

      const out: { id: string; issues: { kind: string; detail: string; hard: boolean }[] }[] = [];
      document.querySelectorAll('figure.fig').forEach((figEl, n) => {
        const svg = figEl.querySelector('svg.fig-svg') as SVGSVGElement | null;
        if (!svg) return;
        const vb = svg.viewBox.baseVal;
        const scale = svg.getBoundingClientRect().width / vb.width;
        const issues: { kind: string; detail: string; hard: boolean }[] = [];
        const rects = [...svg.querySelectorAll('rect.f-box')].map((r) => ({
          x: +r.getAttribute('x')!, y: +r.getAttribute('y')!, w: +r.getAttribute('width')!, h: +r.getAttribute('height')!,
          fill: parse(getComputedStyle(r).fill),
        }));
        const texts = [...svg.querySelectorAll('text')].map((t) => {
          const b = (t as SVGTextElement).getBBox();
          return { el: t as SVGTextElement, label: (t.textContent ?? '').slice(0, 34), x: b.x, y: b.y, w: b.width, h: b.height, group: t.parentElement };
        });
        for (const t of texts) {
          const isNum = !!t.el.closest('.f-num');
          if (t.x < -1 || t.y < -1 || t.x + t.w > vb.width + 1 || t.y + t.h > vb.height + 1) issues.push({ kind: 'outside', detail: `"${t.label}"`, hard: true });
          if (isNum) continue; // white digit on a solid ink circle
          const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
          let behind = pageBg;
          for (const r of rects) {
            const ix = Math.min(t.x + t.w, r.x + r.w) - Math.max(t.x, r.x);
            const iy = Math.min(t.y + t.h, r.y + r.h) - Math.max(t.y, r.y);
            if (ix <= 1.5 || iy <= 1.5) continue;
            const inside = t.x >= r.x - 1.5 && t.y >= r.y - 1.5 && t.x + t.w <= r.x + r.w + 1.5 && t.y + t.h <= r.y + r.h + 1.5;
            if (!inside) issues.push({ kind: 'crosses-box', detail: `"${t.label}" sticks out of a box by ${Math.round(Math.max(r.x - t.x, t.x + t.w - (r.x + r.w), r.y - t.y, t.y + t.h - (r.y + r.h)))}px`, hard: true });
            else if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) behind = over(r.fill, behind);
          }
          const fg = parse(getComputedStyle(t.el).fill);
          const ratio = contrast(over(fg, behind), behind);
          if (ratio < 3) issues.push({ kind: 'low-contrast', detail: `"${t.label}" ${ratio.toFixed(1)}:1`, hard: true });
          const size = parseFloat(t.el.getAttribute('font-size') ?? '14') * scale;
          if (scale < 0.75 && size < 8) issues.push({ kind: 'small-text', detail: `"${t.label}" renders at ${size.toFixed(1)}px`, hard: false });
        }
        for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i], b = texts[j];
          if (a.group !== b.group) continue; // different animation phases never show together
          const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (ix > 2 && iy > 2 && (ix * iy) / Math.min(a.w * a.h, b.w * b.h) > 0.15) issues.push({ kind: 'text-overlap', detail: `"${a.label}" × "${b.label}"`, hard: true });
        }
        out.push({ id: `#${n + 1} ${(svg.getAttribute('aria-label') ?? '').slice(0, 40)}`, issues });
      });
      return out;
    });
    figCount += found.length;
    for (const f of found) for (const i of f.issues) (i.hard ? hard : soft).push({ lesson: lesson.id, fig: f.id, mode: mode.name, kind: i.kind, detail: i.detail });
    if (shots) {
      mkdirSync(join(shots, mode.name), { recursive: true });
      const els = await page.locator('figure.fig').all();
      for (let k = 0; k < els.length; k++) await els[k].screenshot({ path: join(shots, mode.name, `${lesson.id}-${k + 1}.png`) });
    }
  }
  await ctx.close();
}
await browser.close();
server?.kill();

const uniq = (list: Issue[]) => [...new Map(list.map((i) => [`${i.lesson}|${i.fig}|${i.kind}|${i.detail}`, i])).values()];
const show = (title: string, list: Issue[]) => {
  console.log(`\n${title}: ${list.length}`);
  for (const i of list) console.log(`  ${i.lesson} · ${i.fig} · [${i.mode}] ${i.kind}: ${i.detail}`);
};
console.log(`Audited ${figCount} figure renders across ${lessons.length} lessons × ${modes.length} modes.`);
const hardU = uniq(hard);
show('Hard issues (fix these)', hardU);
const softU = uniq(soft);
const softByFig = new Map<string, number>();
for (const i of softU) softByFig.set(`${i.lesson} · ${i.fig}`, (softByFig.get(`${i.lesson} · ${i.fig}`) ?? 0) + 1);
console.log(`\nSmall-text warnings on phones: ${softU.length} text items in ${softByFig.size} figures`);
process.exit(hardU.length ? 1 : 0);
