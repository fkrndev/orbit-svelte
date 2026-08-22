/**
 * Ticking a task off from the Todos panel.
 *
 * `shared/todos.ts` reads the list; this is how the panel writes back, and it
 * cannot be the way the properties panel does it. A property is frontmatter,
 * which the rich editor re-reads from the tab on every serialize and re-attaches
 * verbatim, so rewriting `tab.content` is invisible to it and lands safely. A
 * checklist item is *body*: the rich editor loads it once, keyed on the path,
 * and deliberately never reads `content` again — see the effect deps in
 * `RichEditor.tsx`. Rewriting the markdown behind its back would do nothing on
 * screen and be overwritten by the next keystroke.
 *
 * So the edit has to go through whichever editor is mounted, and this module
 * holds the handle on it — the same shape as `find.ts`, for the same reason.
 * Only one editor is on screen at a time, so there is only ever one engine.
 */

import type { TodoAnchor, TodoItem } from '$shared/todos'

export interface TodoEngine {
  /** Flip one item's box. The engine re-reads the item before writing it. */
  toggle: (item: TodoItem) => void
  /**
   * Bring the item into view without stealing the caret from the panel.
   *
   * Returns whether there was anything to scroll to. A freshly mounted rich
   * editor registers before it has rendered its blocks, so a caller that has to
   * land on a line — Home, opening a file to show one task — needs to know the
   * difference between "done" and "the document was not there yet".
   */
  reveal: (item: TodoItem) => boolean
  /** Add an unchecked item after `anchor`. */
  insert: (anchor: TodoAnchor, text: string) => void
}

let engine: TodoEngine | null = null

export function registerTodoEngine(next: TodoEngine): void {
  engine = next
}

/**
 * Only clears if `previous` is still the registered engine — on a mode switch
 * the incoming editor registers before the outgoing one tears down.
 */
export function unregisterTodoEngine(previous: TodoEngine): void {
  if (engine !== previous) return
  engine = null
}

/**
 * Whether an editor is listening.
 *
 * The panel is built from `tab.content` and so draws correctly before either
 * editor has mounted; its controls must not, or the first click of a freshly
 * opened file would go nowhere with no explanation.
 */
export function hasTodoEngine(): boolean {
  return engine !== null
}

export function toggleTodo(item: TodoItem): void {
  engine?.toggle(item)
}

export function revealTodo(item: TodoItem): boolean {
  return engine?.reveal(item) ?? false
}

export function addTodo(anchor: TodoAnchor, text: string): void {
  const trimmed = text.trim()
  if (trimmed === '') return
  engine?.insert(anchor, trimmed)
}
