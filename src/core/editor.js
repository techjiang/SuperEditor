import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

let actions = {};
export function setEditorActions(map) { actions = { ...actions, ...map }; }

const mdHighlight = HighlightStyle.define([
  { tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], color: 'var(--syn-heading)', fontWeight: '700' },
  { tag: t.strong, color: 'var(--text-1)', fontWeight: '700' },
  { tag: t.emphasis, color: 'var(--text-1)', fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-3)' },
  { tag: [t.link, t.url], color: 'var(--syn-link)', textDecoration: 'underline' },
  { tag: [t.monospace, t.special(t.string)], color: 'var(--syn-code)' },
  { tag: t.quote, color: 'var(--syn-quote)' },
  { tag: [t.meta, t.processingInstruction, t.contentSeparator, t.list], color: 'var(--syn-marker)' },
  { tag: [t.keyword, t.atom, t.bool, t.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.integer, t.float], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.definition(t.variableName)], color: 'var(--syn-fn)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--syn-fn)' },
  { tag: [t.variableName, t.propertyName], color: 'var(--text-1)' },
  { tag: t.invalid, color: 'var(--danger)' },
]);

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: 'var(--editor-font-size)', backgroundColor: 'var(--bg-editor)', color: 'var(--text-1)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--editor-font)', lineHeight: 'var(--editor-line-height)', scrollbarColor: 'var(--scroll-thumb) transparent' },
  '.cm-content': { padding: '12px 8px 120px', caretColor: 'var(--accent)', minHeight: '100%' },
  '.cm-line': { padding: '0 12px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--selection) !important' },
  '.cm-gutters': { backgroundColor: 'var(--bg-editor)', color: 'var(--text-4)', border: 'none', borderRight: '1px solid var(--border-soft)', minWidth: '46px' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)', color: 'var(--text-2)' },
  '.cm-activeLine': { backgroundColor: 'var(--active-line)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--bg-3)', border: 'none', color: 'var(--accent)', borderRadius: '4px', padding: '0 6px' },
  '.cm-searchMatch': { backgroundColor: 'var(--search-match)', outline: '1px solid var(--accent-soft)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--accent-soft)' },
  '.cm-panels': { backgroundColor: 'var(--bg-2)', color: 'var(--text-1)', borderColor: 'var(--border)' },
  '.cm-panel input, .cm-panel button': { backgroundColor: 'var(--bg-1)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: '5px', padding: '3px 7px' },
  '.cm-tooltip': { backgroundColor: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-1)', boxShadow: 'var(--shadow-lg)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--text-1)' },
});

function call(name) {
  return (view) => {
    const fn = actions[name];
    if (!fn) return false;
    const result = fn(view);
    return result === false ? false : true;
  };
}

const shortcuts = Prec.highest(keymap.of([
  { key: 'Mod-b', run: call('bold') },
  { key: 'Mod-i', run: call('italic') },
  { key: 'Mod-Shift-x', run: call('strike') },
  { key: 'Mod-Shift-k', run: call('link') },
  { key: 'Mod-Shift-c', run: call('code') },
  { key: 'Mod-Alt-1', run: call('h1') },
  { key: 'Mod-Alt-2', run: call('h2') },
  { key: 'Mod-Alt-3', run: call('h3') },
  { key: 'Mod-Shift-8', run: call('bullet') },
  { key: 'Mod-Shift-7', run: call('ordered') },
  { key: 'Mod-Shift-9', run: call('quote') },
  { key: 'Mod-s', run: call('save') },
  { key: 'Mod-k', run: call('palette') },
]));

export function createEditor({ parent, initial = '', onChange, onCursor, onScroll, onPasteFiles }) {
  let suppress = false;

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initial,
      extensions: [
        shortcuts,
        basicSetup,
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
        syntaxHighlighting(mdHighlight),
        editorTheme,
        EditorView.domEventHandlers({
          paste(event) {
            const files = [...(event.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
            if (files.length && onPasteFiles) {
              event.preventDefault();
              onPasteFiles(files, view);
              return true;
            }
            return false;
          },
          drop(event) {
            const files = [...(event.dataTransfer?.files || [])];
            if (files.length && onPasteFiles) {
              event.preventDefault();
              onPasteFiles(files, view);
              return true;
            }
            return false;
          },
        }),
        EditorView.updateListener.of((u) => {
          if (suppress) return;
          if (u.docChanged && onChange) onChange(u.state.doc.toString());
          if ((u.docChanged || u.selectionSet) && onCursor) onCursor(cursorInfo(view));
        }),
      ],
    }),
  });

  const scroller = view.scrollDOM;
  if (onScroll) scroller.addEventListener('scroll', () => onScroll(scroller), { passive: true });

  function cursorInfo(v = view) {
    const head = v.state.selection.main.head;
    const line = v.state.doc.lineAt(head);
    return {
      line: line.number,
      col: head - line.from + 1,
      totalLines: v.state.doc.lines,
      selected: v.state.selection.main.to - v.state.selection.main.from,
    };
  }

  function selection() { return view.state.selection.main; }

  function replaceSelection(text, selectText = false) {
    const { from, to } = selection();
    view.dispatch({
      changes: { from, to, insert: text },
      selection: selectText
        ? { anchor: from, head: from + text.length }
        : { anchor: from + text.length },
      scrollIntoView: true,
    });
    view.focus();
  }

  function wrap(before, after = before, placeholder = '') {
    const { from, to } = selection();
    const inner = view.state.sliceDoc(from, to) || placeholder;
    const text = `${before}${inner}${after}`;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + before.length, head: from + before.length + inner.length },
      scrollIntoView: true,
    });
    view.focus();
  }

  function prefixLines(prefixOrFn, { toggle = true } = {}) {
    const { from, to } = selection();
    const doc = view.state.doc;
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    const changes = [];
    for (let i = first; i <= last; i++) {
      const line = doc.line(i);
      const prefix = typeof prefixOrFn === 'function' ? prefixOrFn(i - first) : prefixOrFn;
      const trimmed = line.text.replace(/^\s*/, '');
      const indent = line.text.slice(0, line.text.length - trimmed.length);
      if (toggle) {
        const m = /^(\d+)\.\s|^([-*+])\s|^>\s|^#{1,6}\s/.exec(trimmed);
        if (m) {
          const existing = m[0];
          const wanted = typeof prefixOrFn === 'function' ? /^(\d+)\.\s/.exec(prefix)?.[0] : prefix;
          if (wanted && existing.replace(/^\d+\./, '1.') === wanted.replace(/^\d+\./, '1.')) {
            changes.push({ from: line.from + indent.length, to: line.from + indent.length + existing.length, insert: '' });
            continue;
          }
          changes.push({ from: line.from + indent.length, to: line.from + indent.length + existing.length, insert: prefix });
          continue;
        }
      }
      changes.push({ from: line.from + indent.length, insert: prefix });
    }
    view.dispatch({ changes, scrollIntoView: true });
    view.focus();
  }

  function insert(text, cursorBack = 0) {
    const { from, to } = selection();
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length - cursorBack },
      scrollIntoView: true,
    });
    view.focus();
  }

  function insertImage(dataUrl, alt = '图片') {
    insert(`![${alt}](${dataUrl})`);
  }

  return {
    view,
    scroller,
    getValue: () => view.state.doc.toString(),
    setValue(text) {
      suppress = true;
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: 0 } });
      } finally { suppress = false; }
    },
    focus: () => view.focus(),
    cursorInfo,
    selection,
    replaceSelection,
    wrap,
    prefixLines,
    insert,
    insertImage,
    getScrollerRatio() {
      const max = scroller.scrollHeight - scroller.clientHeight;
      return max > 0 ? scroller.scrollTop / max : 0;
    },
    destroy: () => view.destroy(),
  };
}
