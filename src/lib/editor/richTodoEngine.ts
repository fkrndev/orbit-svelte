/**
 * The Todos panel's hands inside the rich editor.
 *
 * Everything here matches items **by position**, exactly as the heading jump
 * does: `shared/todos.ts` counts checklist items in the markdown, the document
 * holds the same items in the same order, so the nth is the nth. Matching by
 * text instead would collapse two identically-worded tasks onto one, and there
 * is no id in the markdown to match on.
 */

import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { TodoAnchor, TodoItem } from '$shared/todos'
import type { TodoEngine } from '../todoEngine'

const TASK_ITEM = 'taskItem'
const HEADING = 'heading'

/**
 * The nth node of a type, in reading order.
 *
 * `descendants` walks depth-first, which is the order the markdown scanner
 * reads lines in — a nested task is a child of its parent there too.
 */
function nthOfType(
  doc: ProseMirrorNode,
  type: string,
  index: number,
): { node: ProseMirrorNode; pos: number } | null {
  let seen = 0
  let found: { node: ProseMirrorNode; pos: number } | null = null

  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name !== type) return true
    if (seen === index) found = { node, pos }
    seen += 1
    return true
  })

  return found
}

export function richTodoEngine(read: () => Editor | undefined): TodoEngine {
  return {
    toggle(item: TodoItem) {
      const editor = read()
      if (!editor) return
      const found = nthOfType(editor.state.doc, TASK_ITEM, item.index)
      if (!found) return

      // Read `checked` off the *live* node rather than off anything the panel
      // is holding: the panel can be a beat behind the document, and toggling
      // from a stale value is how a checkbox ends up flipping itself back.
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(found.pos, undefined, {
          ...found.node.attrs,
          checked: !found.node.attrs.checked,
        }),
      )
    },

    reveal(item: TodoItem): boolean {
      const editor = read()
      if (!editor) return false
      const found = nthOfType(editor.state.doc, TASK_ITEM, item.index)
      if (!found) return false

      const node = editor.view.nodeDOM(found.pos)
      const element = node instanceof HTMLElement ? node : (node as Text | null)?.parentElement
      if (!element) return false

      // No `focus()`: the caret belongs to whatever the user is typing in.
      // Revealing a task should move the view, not take the keyboard.
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    },

    insert(anchor: TodoAnchor, text: string) {
      const editor = read()
      if (!editor) return

      const reference =
        anchor.at === 'todo'
          ? nthOfType(editor.state.doc, TASK_ITEM, anchor.index)
          : anchor.at === 'heading'
            ? nthOfType(editor.state.doc, HEADING, anchor.index)
            : null

      // `end` when the anchor names the document rather than a node in it.
      const at = reference ? reference.pos + reference.node.nodeSize : editor.state.doc.content.size

      editor
        .chain()
        .insertContentAt(at, {
          type: 'taskList',
          content: [
            {
              type: TASK_ITEM,
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
            },
          ],
        })
        .run()
    },
  }
}
