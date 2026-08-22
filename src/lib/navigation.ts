import { getState, setState, subscribe } from './store.svelte'
import { entryFor, navKey, pushNav } from './navHistory'
import { openPath } from './actions'

/**
 * Back and forward, wired to the store.
 *
 * History is recorded by *watching* the store rather than by having every
 * action report in. Navigation happens from a dozen places — the sidebar, the
 * tab bar, the dashboard, quick open, closing the last tab — and a scheme where
 * each of them remembers to call `record()` is a scheme where one of them
 * eventually does not. Watching the pair that defines "where am I" catches all
 * of them, including the ones added later.
 */

/** The place shown by the last change we saw, so unrelated writes are ignored. */
let lastKey: string | null = null

/**
 * The place a Back/Forward press is travelling to.
 *
 * Set before the move and cleared when it lands, so replaying history does not
 * record itself as a new visit and turn Back into a loop.
 */
let travellingTo: string | null = null

export function trackNavigation(): () => void {
  return subscribe(() => {
    const state = getState()
    // Nothing before the shell exists is a place the user has been. Startup
    // then collapses whatever it did record — see `resetNavHistory`.
    if (!state.ready) return

    const entry = entryFor(state)
    const key = navKey(entry)
    if (key === lastKey) return
    lastKey = key

    if (key === travellingTo) {
      travellingTo = null
      return
    }
    travellingTo = null
    setState(prev => ({ nav: pushNav(prev.nav, entry) }))
  })
}

/**
 * Both resolve once the move has landed. Callers are free to ignore that — a
 * click does — but reopening a closed file is asynchronous, and a caller that
 * needs to know when the surface settled should not have to poll for it.
 */
export function goBack(): Promise<void> {
  return step(-1)
}

export function goForward(): Promise<void> {
  return step(1)
}

async function step(delta: -1 | 1) {
  const from = getState().nav.index
  const to = from + delta
  const entry = getState().nav.entries[to]
  if (!entry) return

  const target = navKey(entry)
  setState(prev => ({ nav: { ...prev.nav, index: to } }))
  travellingTo = target

  if (entry.surface !== 'editor' || !entry.path) {
    setState({ surface: entry.surface })
    return
  }

  // `record: false` — replaying history is not a fresh open. Recording it would
  // let holding Back climb a file up the frecency ranking it never earned.
  await openPath(entry.path, { record: false })

  // Compared against the local target, not `travellingTo`: landing clears that
  // flag, so reading it back here would call every successful move a failure.
  if (navKey(entryFor(getState())) === target) return

  // The file vanished outside the app, so nothing moved. Rewinding the cursor
  // keeps it pointing at what is actually on screen.
  travellingTo = null
  setState(prev => ({ nav: { ...prev.nav, index: from } }))
}
