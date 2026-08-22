import type { Surface } from './store.svelte'

/**
 * The pure half of back/forward navigation.
 *
 * Kept free of the store so the awkward parts — truncating the forward stack,
 * keeping the cursor pointing at the same entry after a delete — are plain
 * functions that can be tested without mounting anything.
 */

/** One visited place: a surface, plus the file when that surface is the editor. */
export interface NavEntry {
  surface: Surface
  path: string | null
}

export interface NavState {
  entries: NavEntry[]
  /** Index of the entry currently on screen; `-1` before the first navigation. */
  index: number
}

export const EMPTY_NAV: NavState = { entries: [], index: -1 }

/** Where the app is, expressed as a place. The file only counts in the editor. */
export function entryFor(state: { surface: Surface; activePath: string | null }): NavEntry {
  return {
    surface: state.surface,
    path: state.surface === 'editor' ? state.activePath : null,
  }
}

/** A history holding one place: no way back, no way forward. */
export function navAt(entry: NavEntry): NavState {
  return { entries: [entry], index: 0 }
}

/**
 * Long enough that Back stays useful across a session, short enough that the
 * list never becomes a memory leak in an app that is left open for weeks.
 */
const MAX_ENTRIES = 100

/** Identity of a place. Two editor entries are the same place iff same file. */
export function navKey(entry: NavEntry): string {
  return entry.surface === 'editor' ? `editor:${entry.path ?? ''}` : entry.surface
}

/**
 * Appends a place, dropping anything ahead of the cursor.
 *
 * That truncation is what makes this a browser history rather than a list of
 * visits: navigating somewhere new from the middle abandons the forward path,
 * because there is no longer one route through the entries.
 */
export function pushNav(nav: NavState, entry: NavEntry): NavState {
  const current = nav.entries[nav.index]
  if (current && navKey(current) === navKey(entry)) return nav

  const entries = [...nav.entries.slice(0, nav.index + 1), entry].slice(-MAX_ENTRIES)
  return { entries, index: entries.length - 1 }
}

export function canGoBack(nav: NavState): boolean {
  return nav.index > 0
}

export function canGoForward(nav: NavState): boolean {
  return nav.index >= 0 && nav.index < nav.entries.length - 1
}

/**
 * Forgets every visit to a file, for when it is deleted.
 *
 * The cursor moves with the entries it survives, so the place the user is
 * looking at is still the place the cursor points at afterwards.
 */
export function dropNavPath(nav: NavState, path: string): NavState {
  const entries: NavEntry[] = []
  let index = nav.index

  nav.entries.forEach((entry, i) => {
    if (entry.surface === 'editor' && entry.path === path) {
      if (i <= nav.index) index -= 1
      return
    }
    entries.push(entry)
  })

  if (entries.length === nav.entries.length) return nav
  return { entries, index: clampIndex(index, entries.length) }
}

/** Follows a renamed file, so Back does not walk into a path that moved. */
export function retargetNav(nav: NavState, from: string, to: string): NavState {
  if (!nav.entries.some(entry => entry.surface === 'editor' && entry.path === from)) return nav
  return {
    ...nav,
    entries: nav.entries.map(entry =>
      entry.surface === 'editor' && entry.path === from ? { ...entry, path: to } : entry,
    ),
  }
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return -1
  return Math.max(0, Math.min(index, length - 1))
}
