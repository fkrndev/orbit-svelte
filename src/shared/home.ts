import type { InlineRefKind } from './inlineRefs'
import type { Dashboard, DashboardItem } from './types'

/**
 * The arithmetic behind Home's top block, kept out of the component so it can
 * be argued with in a test rather than by squinting at a screen.
 *
 * The backend answers two different questions — what you open most, and what
 * you wrote in last — and Home asks a third one that neither answers on its
 * own: *what would you carry on with now?* That is the union of the two, with
 * every file counted once.
 */

/** When a file lands in both lists, this is the ranking it is judged on. */
function rank(item: DashboardItem): [number, number] {
  // Score first, because it already folds recency into frequency (see
  // `frecency.ts`). The tiebreak is the last time the file was *written*, not
  // opened: between two equally familiar files, the one you were in the middle
  // of is the one you meant.
  return [item.score, item.lastEditedAt ?? item.lastOpenedAt]
}

/**
 * The files most likely to be the one you came back for.
 *
 * A file can be both frequently opened and recently edited, and the copies are
 * not identical — the ranked lists are built by different filters, so one may
 * carry an edit stamp the other does not. The richer copy wins.
 */
export function continueList(data: Dashboard, limit: number): DashboardItem[] {
  const byId = new Map<string, DashboardItem>()

  for (const item of [...data.frequent, ...data.recentlyEdited]) {
    const seen = byId.get(item.meta.id)
    if (!seen || (seen.lastEditedAt ?? 0) < (item.lastEditedAt ?? 0)) byId.set(item.meta.id, item)
  }

  return [...byId.values()]
    .sort((a, b) => {
      const [scoreA, stampA] = rank(a)
      const [scoreB, stampB] = rank(b)
      return scoreB - scoreA || stampB - stampA
    })
    .slice(0, limit)
}

/**
 * The last time anything was written, for Home's one-line summary.
 *
 * Read across every list rather than `recentlyEdited` alone: that list is
 * capped, and a pinned file that was edited a minute ago can sit outside it.
 */
export function lastWriteAt(data: Dashboard): number | null {
  let latest = 0
  for (const item of [...data.pinned, ...data.frequent, ...data.recentlyEdited]) {
    if (item.lastEditedAt && item.lastEditedAt > latest) latest = item.lastEditedAt
  }
  return latest === 0 ? null : latest
}

/**
 * A search for a tag or a mention rather than a name: `#draft`, `@budi`.
 *
 * Lives here rather than in the search service because both sides need the same
 * answer — Home and the tags panel write the query when a chip is clicked, the
 * service reads it — and a prefix that two files agree on only by coincidence is
 * a prefix that stops working the first time one of them is edited.
 *
 * A bare sigil is not a search: it is someone who has typed one character.
 */
export function parseRefQuery(query: string): { kind: InlineRefKind; label: string } | null {
  const trimmed = query.trim()
  const kind = trimmed.startsWith('#') ? 'tag' : trimmed.startsWith('@') ? 'mention' : null
  if (!kind) return null
  const label = trimmed.slice(1).trim()
  return label === '' ? null : { kind, label }
}
