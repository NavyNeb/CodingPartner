import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, EditorState, StateEffect, StateField, Prec } from '@codemirror/state';
import {
  Decoration, EditorView, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter,
  highlightSpecialChars, keymap, lineNumbers, rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  HighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit, syntaxHighlighting,
} from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import { tags as t } from '@lezer/highlight';
import type { Lang } from '../content/types';

export interface EditorHandle {
  focus(): void;
  jumpToLine(line: number): void;
}

interface Props {
  value: string;
  onChange?: (v: string) => void;
  onRun?: () => void;
  lang: Lang;
  readOnly?: boolean;
  errorLines?: number[];
  label: string;
  /** Keyword/identifier autocomplete. Off = whiteboard mode. */
  assist?: boolean;
}

const setErrors = StateEffect.define<number[]>();
const errorField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setErrors)) {
        const lines = [...new Set(e.value)].filter((n) => n >= 1 && n <= tr.state.doc.lines).sort((a, b) => a - b);
        deco = Decoration.set(lines.map((n) => Decoration.line({ class: 'cm-errorLine' }).range(tr.state.doc.line(n).from)));
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// All colours come from CSS variables so light/dark switching needs no editor reconfiguration.
const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--ink)', backgroundColor: 'var(--editor-bg)', fontSize: '13.5px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65', overflow: 'auto' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-gutters': { backgroundColor: 'var(--editor-bg)', color: 'var(--faint)', border: 'none', paddingLeft: '6px' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--muted)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--selection) !important' },
  '.cm-matchingBracket': { backgroundColor: 'var(--selection)', outline: '1px solid var(--line-strong)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--muted)' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: '6px', color: 'var(--ink)', boxShadow: 'var(--shadow-pop)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--ink)' },
  '.cm-errorLine': { backgroundColor: 'var(--fail-soft)', boxShadow: 'inset 2px 0 0 var(--fail)' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-fn)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--syn-type)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--syn-prop)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.punctuation, t.operator, t.bracket], color: 'var(--syn-punct)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--syn-keyword)' },
  { tag: t.invalid, color: 'var(--fail)' },
]);

export const CodeEditor = forwardRef<EditorHandle, Props>(function CodeEditor({ value, onChange, onRun, lang, readOnly, errorLines, label, assist = true }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const assistSlot = useRef(new Compartment());
  const assistRef = useRef(assist);
  assistRef.current = assist;
  const cb = useRef({ onChange, onRun });
  cb.current = { onChange, onRun };

  useImperativeHandle(ref, () => ({
    focus: () => view.current?.focus(),
    jumpToLine(line) {
      const v = view.current;
      if (!v) return;
      const n = Math.min(Math.max(line, 1), v.state.doc.lines);
      const pos = v.state.doc.line(n).from;
      v.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
      v.focus();
    },
  }));

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { cb.current.onRun?.(); return true; } }])),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        assistSlot.current.of(assistRef.current ? autocompletion() : []),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        javascript({ typescript: lang !== 'js', jsx: lang !== 'ts' }),
        theme,
        syntaxHighlighting(highlight),
        errorField,
        EditorView.contentAttributes.of({ 'aria-label': label }),
        EditorState.readOnly.of(!!readOnly),
        EditorView.updateListener.of((u) => { if (u.docChanged) cb.current.onChange?.(u.state.doc.toString()); }),
      ],
    });
    const v = new EditorView({ state, parent: host.current! });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
    // The editor is created once per mount; content is synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, readOnly]);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: setErrors.of(errorLines ?? []) });
  }, [errorLines]);

  useEffect(() => {
    view.current?.dispatch({ effects: assistSlot.current.reconfigure(assist ? autocompletion() : []) });
  }, [assist]);

  return <div className="editor" ref={host} />;
});
