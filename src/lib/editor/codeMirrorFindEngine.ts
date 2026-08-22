import { EditorView } from '@codemirror/view'
import type { EditorFindChange, EditorFindMatch } from './editorFind'
import type { EditorFindEngine } from './editorFindEngine'
import { setFindHighlights } from './editorFindHighlight'

/**
 * The source editor as a find target.
 *
 * Offsets need no translation here — the searchable text *is* the document, so
 * a match range is already a CodeMirror range.
 *
 * `read` hands back the live view rather than closing over it: the engine is
 * built once per document and the view outlives every rebuild, but it is also
 * `null` between mount and the action running.
 */
export function codeMirrorFindEngine(
  read: () => EditorView | null,
  doc: string,
): EditorFindEngine {
  return {
    text: doc,

    highlight(matches, activeIndex) {
      read()?.dispatch({
        effects: setFindHighlights.of({
          active: activeIndex,
          ranges: matches.map(match => ({ from: match.from, to: match.to })),
        }),
      })
    },

    clearHighlights() {
      read()?.dispatch({ effects: setFindHighlights.of({ active: -1, ranges: [] }) })
    },

    reveal(match: EditorFindMatch) {
      read()?.dispatch({
        selection: { anchor: match.from, head: match.to },
        effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
      })
    },

    replaceOne(change: EditorFindChange) {
      const view = read()
      if (!view) return

      view.dispatch({
        changes: change,
        selection: { anchor: change.from, head: change.from + change.insert.length },
        effects: EditorView.scrollIntoView(change.from, { y: 'center' }),
      })
      view.focus()
    },

    replaceAll(changes: readonly EditorFindChange[]) {
      const view = read()
      if (!view || changes.length === 0) return

      // One transaction: a single undo step, and CodeMirror resolves the
      // offsets against the original document so they need no shifting.
      view.dispatch({ changes: [...changes] })
      view.focus()
    },

    focus() {
      read()?.focus()
    },
  }
}
