import { Marked } from 'marked';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import { javascriptLanguage } from '@codemirror/lang-javascript';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const JS_LANGS = new Set(['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript', 'json']);
const parser = javascriptLanguage.parser.configure({ dialect: 'jsx ts' });

export function highlightToHtml(code: string, lang?: string): string {
  if (!lang || !JS_LANGS.has(lang)) return esc(code);
  let out = '';
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, classes) => { out += classes ? `<span class="${classes}">${esc(text)}</span>` : esc(text); },
    () => { out += '\n'; },
  );
  return out;
}

export const slug = (s: string) =>
  s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const l = (lang ?? '').split(/\s/)[0];
      return `<pre class="code"${l ? ` data-lang="${l}"` : ''}><code>${highlightToHtml(text, l)}</code></pre>`;
    },
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const raw = tokens.map((t) => t.raw).join('');
      return `<h${depth} id="${slug(raw)}">${inner}</h${depth}>\n`;
    },
    blockquote({ tokens }) {
      const inner = this.parser.parse(tokens);
      const isIncident = /^\*\*INCIDENT/.test(tokens[0]?.raw ?? '') || /^<p><strong>INCIDENT/.test(inner);
      return `<blockquote${isIncident ? ' class="incident"' : ''}>${inner}</blockquote>\n`;
    },
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      return `<a href="${href}" target="_blank" rel="noreferrer noopener">${inner}</a>`;
    },
  },
});

const cache = new Map<string, string>();
export function renderMarkdown(md: string): string {
  let html = cache.get(md);
  if (html === undefined) {
    html = marked.parse(md, { async: false }) as string;
    cache.set(md, html);
  }
  return html;
}

export function headingsOf(md: string): { id: string; text: string }[] {
  return marked
    .lexer(md)
    .filter((t): t is Extract<typeof t, { type: 'heading' }> => t.type === 'heading' && t.depth === 2)
    .map((t) => ({ id: slug(t.raw.replace(/^#+\s*/, '')), text: t.text }));
}

export function codeBlock(code: string, lang: string): string {
  return `<pre class="code" data-lang="${lang}"><code>${highlightToHtml(code, lang)}</code></pre>`;
}

export function renderInline(md: string): string {
  return marked.parseInline(md, { async: false }) as string;
}
