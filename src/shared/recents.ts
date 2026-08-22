import { fuzzyMatch } from './fuzzy'
import type { RecentSort, RecentsPreview } from './types'

/**
 * Ordering and grouping rules for the Recents list.
 *
 * Shared because the backend does the sorting and the panel does the grouping,
 * and the one rule that ties them together — that day buckets only make sense
 * for a list already in time order — has to be the same on both sides.
 */

export interface Rankable {
  lastOpenedAt: number
  openCount: number
  score: number
}

/**
 * Ties are the common case: most files sit at one or two opens, and their
 * scores collide too. Recency breaks them, which keeps the list stable instead
 * of reshuffling every time it is read.
 */
const COMPARATORS: Record<RecentSort, (a: Rankable, b: Rankable) => number> = {
  recent: (a, b) => b.lastOpenedAt - a.lastOpenedAt,
  opens: (a, b) => b.openCount - a.openCount || b.lastOpenedAt - a.lastOpenedAt,
  frecency: (a, b) => b.score - a.score || b.lastOpenedAt - a.lastOpenedAt,
}

export function compareRecents(sort: RecentSort): (a: Rankable, b: Rankable) => number {
  return COMPARATORS[sort] ?? COMPARATORS.recent
}

/**
 * Whether day buckets apply.
 *
 * Grouping a list ordered by open count would print "Today", then an older day,
 * then "Today" again — the headings would be describing an order the list is
 * not in. The toggle is disabled rather than quietly ignored so it is clear the
 * option exists and why it does not apply here.
 */
export function canGroupByDay(sort: RecentSort): boolean {
  return sort === 'recent'
}

/**
 * Preview lines per style. Zero for `small`, which is the name and nothing
 * else.
 *
 * Shared rather than a constant in the panel because it decides two things on
 * opposite sides of the RPC: how tall a row is drawn, and whether the backend
 * reads the files at all. Splitting that in two is how the list ends up asking
 * for text it never shows, or clamping text it never asked for.
 */
const PREVIEW_LINES: Record<RecentsPreview, number> = {
  small: 0,
  medium: 1,
  large: 3,
}

export function previewLines(preview: RecentsPreview): number {
  return PREVIEW_LINES[preview] ?? 0
}

/** Whether this style needs the excerpt — one file read per row, so it asks. */
export function previewNeedsExcerpt(preview: RecentsPreview): boolean {
  return previewLines(preview) > 0
}

/**
 * Rolls a ranked list of files up into the folders they live in.
 *
 * Scores are summed rather than averaged: a folder holding ten notes you keep
 * coming back to is a more useful destination than one holding a single very
 * hot file, and averaging says the opposite.
 *
 * Lives here, away from the store it is fed from, so the rule can be tested
 * without a history file — see the note on `rename.ts` in AGENTS.md.
 */
export function foldersOf(
  items: Array<{ path: string; score: number; lastOpenedAt: number }>,
  limit: number,
): Array<{ path: string; noteCount: number; lastOpenedAt: number }> {
  const folders = new Map<string, { score: number; noteCount: number; lastOpenedAt: number }>()

  for (const item of items) {
    const cut = item.path.lastIndexOf('/')
    const folder = cut <= 0 ? '/' : item.path.slice(0, cut)
    const entry = folders.get(folder) ?? { score: 0, noteCount: 0, lastOpenedAt: 0 }
    entry.score += item.score
    entry.noteCount += 1
    entry.lastOpenedAt = Math.max(entry.lastOpenedAt, item.lastOpenedAt)
    folders.set(folder, entry)
  }

  return [...folders]
    .sort((a, b) => b[1].score - a[1].score || b[1].lastOpenedAt - a[1].lastOpenedAt)
    .slice(0, limit)
    .map(([path, entry]) => ({
      path,
      noteCount: entry.noteCount,
      lastOpenedAt: entry.lastOpenedAt,
    }))
}

export interface DayGroup<T> {
  /** `null` for the single ungrouped run. */
  label: string | null
  items: T[]
}

/**
 * Buckets a time-ordered list into consecutive runs sharing a day label.
 *
 * Consecutive rather than keyed: the list is already sorted, so a run that
 * breaks and returns would mean the caller passed something out of order — and
 * showing that plainly beats hiding it by merging the runs back together.
 */
export function groupByDay<T extends { lastOpenedAt: number }>(
  items: T[],
  label: (at: number) => string,
  enabled = true,
): Array<DayGroup<T>> {
  if (!enabled) return items.length === 0 ? [] : [{ label: null, items }]

  const groups: Array<DayGroup<T>> = []
  for (const item of items) {
    const current = label(item.lastOpenedAt)
    const last = groups[groups.length - 1]
    if (last && last.label === current) last.items.push(item)
    else groups.push({ label: current, items: [item] })
  }
  return groups
}

/**
 * Narrows an already-ordered list of recents to the rows that match a query.
 *
 * Client-side on purpose. The panel is holding its rows already, so filtering
 * them costs nothing and stays instant while typing — and the thing it filters
 * is honestly *this list*, not the vault. Searching everything is `⌘P`, which
 * the empty state points at rather than pretending this box could do it.
 *
 * Matched with the same fuzzy matcher as the palette and the tree filter, so
 * `arch` finds `ARCHITECTURE.md` in all three places. The folder is tried after
 * the name, because a query naming a place ("billing") should still turn up the
 * files that live there.
 *
 * The order is left exactly as it arrived: the list is already in whatever the
 * sort menu asked for, and re-ranking by how well a name matched would quietly
 * override that choice.
 */
export function filterRecents<T extends { name: string; path: string }>(
  items: T[],
  query: string,
): T[] {
  const trimmed = query.trim()
  if (trimmed === '') return items

  return items.filter(item => {
    if (fuzzyMatch(trimmed, item.name).match) return true
    const folder = item.path.slice(0, item.path.lastIndexOf('/'))
    return fuzzyMatch(trimmed, folder).match
  })
}
