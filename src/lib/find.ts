import { getState, setState, type FindState } from './store.svelte'
import {
  buildEditorFindReplacementChange,
  buildEditorFindReplacementChanges,
  clampEditorFindIndex,
  findEditorMatches,
  nextEditorFindIndex,
  type EditorFindOptions,
} from './editor/editorFind'
import type { EditorFindEngine } from './editor/editorFindEngine'

/**
 * Driving the find session.
 *
 * The pure part is `editor/editorFind.ts`; this is the wiring, in the same
 * shape as `sidebar.ts` over `tree.ts`. It holds the one thing the store cannot:
 * a handle on whichever editor is currently mounted.
 *
 * Only one editor is on screen at a time, so there is only ever one engine. It
 * re-registers itself whenever its text changes, which is also what keeps the
 * match list honest while you type.
 */

let engine: EditorFindEngine | null = null

function readFind(): FindState {
  return getState().find
}

function patchFind(patch: Partial<FindState>): FindState {
  const next = { ...readFind(), ...patch }
  setState({ find: next })
  return next
}

function optionsOf(find: FindState): EditorFindOptions {
  return { caseSensitive: find.caseSensitive, regex: find.regex }
}

/**
 * Recomputes the match list against the engine's current text.
 *
 * `reveal` is the difference between "you moved" and "the document moved": a
 * keystroke in the find field should scroll to the hit, a keystroke in the
 * document should not yank the view away from where you are typing.
 */
function search(reveal: boolean, patch: Partial<FindState> = {}): void {
  const find = { ...readFind(), ...patch }
  if (!find.open || !engine) {
    if (Object.keys(patch).length > 0) patchFind(patch)
    return
  }

  const result = findEditorMatches(engine.text, find.query, optionsOf(find))
  const activeIndex = clampEditorFindIndex(find.activeIndex, result.matches.length)

  patchFind({
    ...patch,
    activeIndex,
    error: result.error,
    matches: result.matches,
    text: engine.text,
  })

  engine.highlight(result.matches, result.error ? -1 : activeIndex)
  if (!reveal || result.error) return

  const active = result.matches.at(activeIndex)
  if (active) engine.reveal(active)
}

/**
 * Called by whichever editor is mounted, on every change to its text. The
 * engine object is rebuilt when its text changes, so identity is the signal.
 */
export function registerFindEngine(next: EditorFindEngine): void {
  engine = next
  search(false)
}

/** Only clears if `previous` is still the registered engine — on a mode switch
 *  the incoming editor registers before the outgoing one tears down. */
export function unregisterFindEngine(previous: EditorFindEngine): void {
  if (engine !== previous) return
  engine = null
}

export function openFind(options: { replace?: boolean } = {}): void {
  const find = readFind()
  search(true, {
    open: true,
    replaceOpen: options.replace === true ? true : find.replaceOpen,
    requestId: find.requestId + 1,
  })
}

export function closeFind(): void {
  engine?.clearHighlights()
  // The query survives: reopening to the term you just searched for is what
  // every editor does, and retyping it is pure friction.
  patchFind({ open: false, matches: [], error: null, text: '' })
  engine?.focus()
}

export function setFindReplaceOpen(open: boolean): void {
  patchFind({ replaceOpen: open })
}

export function setFindQuery(query: string): void {
  search(true, { activeIndex: 0, query })
}

export function setFindReplacement(replacement: string): void {
  patchFind({ replacement })
}

export function toggleFindCaseSensitive(): void {
  search(true, { activeIndex: 0, caseSensitive: !readFind().caseSensitive })
}

export function toggleFindRegex(): void {
  search(true, { activeIndex: 0, regex: !readFind().regex })
}

export function moveFindMatch(direction: 1 | -1): void {
  const find = readFind()
  if (find.matches.length === 0) return
  activateFindMatch(nextEditorFindIndex(find.activeIndex, find.matches.length, direction))
}

/** Selecting a hit — from the arrows, from Enter, or from the sidebar list. */
export function activateFindMatch(index: number, options: { focusEditor?: boolean } = {}): void {
  const find = readFind()
  const activeIndex = clampEditorFindIndex(index, find.matches.length)
  const active = find.matches.at(activeIndex)
  if (!engine || !active) return

  patchFind({ activeIndex })
  engine.highlight(find.matches, activeIndex)
  engine.reveal(active)
  if (options.focusEditor) engine.focus()
}

export function replaceCurrentFindMatch(): void {
  const find = readFind()
  const active = find.matches.at(clampEditorFindIndex(find.activeIndex, find.matches.length))
  if (!engine || !active || find.error) return

  engine.replaceOne(
    buildEditorFindReplacementChange(active, find.query, find.replacement, optionsOf(find)),
  )
}

export function replaceAllFindMatches(): void {
  const find = readFind()
  if (!engine || find.matches.length === 0 || find.error) return

  engine.replaceAll(
    buildEditorFindReplacementChanges(find.matches, find.query, find.replacement, optionsOf(find)),
  )
  patchFind({ activeIndex: 0 })
}
