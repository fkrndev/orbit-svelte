import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorFindChange, EditorFindMatch } from './editorFind'
import type { EditorFindEngine } from './editorFindEngine'
import { paintFindHighlights } from './richEditorFindHighlight'
import { buildRichFindIndex, type FindTextRun, type RichFindIndex } from './richEditorFindIndex'

/**
 * The rich editor as a find target.
 *
 * Searching the rendered prose rather than the markdown behind it is the point:
 * in this view `**bold**` is three characters of bold text, and a reader looking
 * for the word should find it without knowing how it is stored. The cost is a
 * translation layer — see `richEditorFindIndex` — and the work only runs while
 * the bar is open.
 */

export function collectFindRuns(doc: ProseMirrorNode): FindTextRun[] {
  const runs: FindTextRun[] = []

  doc.descendants((node, pos) => {
    if (node.isText) {
      runs.push({ kind: 'text', pos, text: node.text ?? '' })
      return false
    }
    // Every block opens a new line in the flattened text. Nesting means these
    // can arrive in pairs; the index collapses the repeats.
    if (node.isBlock) runs.push({ kind: 'gap' })
    return true
  })

  return runs
}

/**
 * `read` hands back the live view, which outlives every rebuild of the engine —
 * the engine itself is rebuilt whenever the flattened text changes, because a
 * match list is only meaningful against the text it was computed from.
 */
export function richFindEngine(read: () => EditorView | null, index: RichFindIndex): EditorFindEngine {
  const resolve = (from: number, to: number) => index.resolveRange(from, to)

  return {
    text: index.text,

    highlight(matches, activeIndex) {
      const view = read()
      if (!view) return

      // Unmappable matches were already dropped upstream, so an index here
      // lines up with the count the bar is showing.
      const ranges = matches.flatMap(match => {
        const range = resolve(match.from, match.to)
        return range ? [range] : []
      })
      paintFindHighlights(view, { active: activeIndex, ranges })
    },

    clearHighlights() {
      const view = read()
      if (view) paintFindHighlights(view, { active: -1, ranges: [] })
    },

    reveal(match: EditorFindMatch) {
      const view = read()
      const range = resolve(match.from, match.to)
      if (!view || !range) return

      const { state } = view
      // The caret goes to the start of the hit rather than across it. A
      // selection would open the formatting bubble menu, which floats directly
      // over the line you were trying to look at — and the match is already
      // drawn by the decoration, so the selection was only ever carrying the
      // caret.
      view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, range.from)).scrollIntoView())
    },

    replaceOne(change: EditorFindChange) {
      const view = read()
      const range = resolve(change.from, change.to)
      if (!view || !range) return

      view.dispatch(view.state.tr.insertText(change.insert, range.from, range.to).scrollIntoView())
      view.focus()
    },

    replaceAll(changes: readonly EditorFindChange[]) {
      const view = read()
      if (!view || changes.length === 0) return

      const transaction = view.state.tr
      // Back to front: each edit only shifts the positions after it, so the
      // ranges still ahead of the cursor stay valid without remapping.
      for (const change of [...changes].sort((left, right) => right.from - left.from)) {
        const range = resolve(change.from, change.to)
        if (range) transaction.insertText(change.insert, range.from, range.to)
      }

      if (transaction.docChanged) view.dispatch(transaction)
      view.focus()
    },

    focus() {
      read()?.focus()
    },
  }
}

export { buildRichFindIndex }
