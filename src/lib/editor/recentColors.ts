import type { RecentEditorColor } from '$shared/types'

/** One row of the picker's grid, so the section never wraps. */
export const RECENT_COLOR_LIMIT = 5

/**
 * The recently-used list after a pick.
 *
 * Newest first, de-duplicated by kind *and* colour, capped at one row. Re-using
 * a colour moves it to the front rather than adding a second copy, so a person
 * alternating between two colours keeps both — the naive "prepend and slice"
 * fills the row with one colour after five picks and evicts everything else.
 *
 * `default` is never remembered: it is the absence of a colour, and offering it
 * as a shortcut would waste a slot on the one value already in both palettes.
 */
export function rememberColor(
  recents: readonly RecentEditorColor[],
  pick: RecentEditorColor,
  limit = RECENT_COLOR_LIMIT,
): RecentEditorColor[] {
  if (pick.color === 'default') return [...recents]

  const rest = recents.filter(entry => entry.kind !== pick.kind || entry.color !== pick.color)
  return [pick, ...rest].slice(0, limit)
}
