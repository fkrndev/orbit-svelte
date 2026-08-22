import { todos } from '$shared/todos'
import { getState, setState } from './store.svelte'
import { hasTodoEngine, revealTodo } from './todoEngine'

/**
 * Jumping to a line in a file that is not open yet.
 *
 * Three things have to happen in order — the file opens, an editor mounts and
 * registers a todo engine, and that editor draws the document — and the click
 * that started it belongs to none of them. So the request is parked in the
 * store and claimed by whoever mounts for that path, the same shape as
 * `takePendingOpens` on the Bun side.
 */

/**
 * Looks at the parked jump without consuming it.
 *
 * Peeked rather than taken because the claim and the jump are separated by the
 * editor drawing its document: taking it here would leave nothing to retry
 * against, and the poll below exists precisely because the first attempt
 * usually comes too early.
 *
 * A request for *another* path is dropped here rather than left alone: it can
 * only mean the user opened something else in the meantime, and a request that
 * survives that would eventually scroll an innocent document to line 42.
 */
export function pendingRevealFor(path: string): number | null {
  const pending = getState().pendingReveal
  if (!pending) return null
  if (pending.path === path) return pending.line
  setState({ pendingReveal: null })
  return null
}

/** Called once the jump has landed — or has run out of chances to. */
export function clearPendingReveal() {
  if (getState().pendingReveal) setState({ pendingReveal: null })
}

/**
 * Generous, because the wait is for a document to be parsed and drawn rather
 * than for a network call: a long note in the rich editor can take a second on
 * its own, and the cost of waiting is a 50ms timer nobody sees.
 */
const REVEAL_TIMEOUT_MS = 5_000
const REVEAL_POLL_MS = 50

/**
 * Performs a parked jump once the editor for this file can act on it.
 *
 * Polled rather than awaited: the engine is registered by an effect inside
 * whichever editor mounted, and there is no event to subscribe to. It waits for
 * the *reveal to land*, not merely for an engine to exist — the rich editor
 * registers before Tiptap has rendered a single node, and scrolling to a block
 * that is not drawn yet silently does nothing. Bounded, so a file that never
 * draws costs a few timers rather than a loop.
 *
 * Returns its own teardown. Call it from an `$effect` that depends on `path`
 * and *not* on the content: this runs for the file that was just opened, and
 * re-running it on every keystroke would re-scroll the document while it is
 * being typed in.
 */
export function startTodoReveal(path: string, content: string): () => void {
  const line = pendingRevealFor(path)
  if (line === null) return () => {}

  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = Date.now() + REVEAL_TIMEOUT_MS

  const attempt = () => {
    // Read the item fresh: the line came from a disk scan, and the buffer is
    // what the editor will actually move around in.
    const item = todos(content).find(entry => entry.line === line)
    if (!item || (hasTodoEngine() && revealTodo(item)) || Date.now() >= deadline) {
      clearPendingReveal()
      return
    }
    timer = setTimeout(attempt, REVEAL_POLL_MS)
  }

  timer = setTimeout(attempt, 0)
  return () => clearTimeout(timer)
}
