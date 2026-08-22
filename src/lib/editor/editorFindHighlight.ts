import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'

/**
 * Painting find matches in the source editor.
 *
 * A selection alone is not enough: while you are typing in the find field the
 * editor does not have focus, and an unfocused native selection is not drawn.
 * These decorations are, so the match you are on stays visible the whole time
 * you are looking for it.
 */

export interface FindHighlightRange {
  from: number
  to: number
}

export interface FindHighlightState {
  /** Index into `ranges` of the match the user is on, or -1 for none. */
  active: number
  ranges: readonly FindHighlightRange[]
}

export const setFindHighlights = StateEffect.define<FindHighlightState>()

const MATCH_CLASS = 'editor-find-match'
const ACTIVE_CLASS = 'editor-find-match editor-find-match--active'

const matchMark = Decoration.mark({ class: MATCH_CLASS })
const activeMark = Decoration.mark({ class: ACTIVE_CLASS })

function buildDecorations(docLength: number, state: FindHighlightState): DecorationSet {
  const decorations = state.ranges.flatMap((range, index) => {
    // A stale range — the doc changed under a replace — would throw when the
    // set is built, taking the editor with it.
    if (range.from >= range.to || range.to > docLength) return []
    return [(index === state.active ? activeMark : matchMark).range(range.from, range.to)]
  })

  return Decoration.set(decorations, true)
}

const findHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setFindHighlights)) {
        return buildDecorations(transaction.state.doc.length, effect.value)
      }
    }
    // Typing while the bar is open shifts the matches; mapping keeps the paint
    // on the right characters until the next search lands.
    return decorations.map(transaction.changes)
  },
  provide: field => EditorView.decorations.from(field),
})

export function editorFindHighlight() {
  return [findHighlightField]
}
