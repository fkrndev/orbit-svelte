/**
 * The Todos panel's hands inside the raw editor.
 *
 * Here the item's `line` is the whole answer — this editor shows the file
 * verbatim, frontmatter included, which is the same coordinate system the
 * scanner reports. So a toggle is one line replaced and nothing else moves:
 * no reserialization, no reflow, and the undo history gets one entry the user
 * can take back.
 */

import { EditorView } from '@codemirror/view'
import { renderTodoLine, toggleTodoLine, type TodoAnchor, type TodoItem } from '$shared/todos'
import type { TodoEngine } from '../todoEngine'

/** Clamped, because the panel can be a beat behind a document being edited. */
function lineAt(view: EditorView, index: number) {
  return view.state.doc.line(Math.min(Math.max(index + 1, 1), view.state.doc.lines))
}

export function codeMirrorTodoEngine(read: () => EditorView | null): TodoEngine {
  return {
    toggle(item: TodoItem) {
      const editor = read()
      if (!editor) return
      const line = lineAt(editor, item.line)
      const next = toggleTodoLine(line.text)
      // The panel may be describing a line that has since been retyped. If
      // this one is no longer a task, the safe thing is to leave it be.
      if (next === line.text) return
      editor.dispatch({ changes: { from: line.from, to: line.to, insert: next } })
    },

    reveal(item: TodoItem): boolean {
      const editor = read()
      if (!editor) return false
      const line = lineAt(editor, item.line)
      editor.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) })
      return true
    },

    insert(anchor: TodoAnchor, text: string) {
      const editor = read()
      if (!editor) return
      const doc = editor.state.doc
      // Anchors name a position in the document, not a line, so the raw
      // editor has to find the nth item or heading for itself. Cheap: these
      // documents are notes, and the walk stops at the match.
      const at = anchor.at === 'end' ? doc.lines - 1 : lineIndexFor(editor, anchor)
      if (at === null) return

      const line = lineAt(editor, at)
      const indent = /^\s*/.exec(line.text)?.[0] ?? ''
      const insert = `\n${indent}${renderTodoLine(text)}`
      editor.dispatch({
        changes: { from: line.to, insert },
        selection: { anchor: line.to + insert.length },
      })
    },
  }
}

const TODO = /^\s*[-*+]\s+\[[ xX]\]/
const HEADING = /^\s{0,3}#{1,6}\s+/

/** The file line holding the nth checklist item, or the nth heading. */
function lineIndexFor(
  view: EditorView,
  anchor: Extract<TodoAnchor, { index: number }>,
): number | null {
  const pattern = anchor.at === 'todo' ? TODO : HEADING
  let seen = 0
  for (let number = 1; number <= view.state.doc.lines; number += 1) {
    if (!pattern.test(view.state.doc.line(number).text)) continue
    if (seen === anchor.index) return number - 1
    seen += 1
  }
  return null
}
