import { fuzzyMatch } from './fuzzy'
import type { BookmarkView } from './types'

/**
 * Filtering the bookmark list.
 *
 * The list is one you arrange by hand, so filtering it is not the same job as
 * filtering the tree: nothing is ranked, nothing is re-ordered, and the
 * arrangement you built is exactly what comes back with rows removed. Matched
 * with the same fuzzy matcher as the palette and the tree, so `arch` finds
 * `ARCHITECTURE.md` everywhere it is typed.
 */

/** The name a row shows: its own title, or the file's, before the extension. */
function labelOf(entry: BookmarkView): string {
  if (entry.title) return entry.title
  const path = entry.path ?? ''
  return path.slice(path.lastIndexOf('/') + 1)
}

function matches(entry: BookmarkView, query: string): boolean {
  if (fuzzyMatch(query, labelOf(entry)).match) return true
  const path = entry.path ?? ''
  // The folder, so a query naming a place turns up what you bookmarked in it.
  return path !== '' && fuzzyMatch(query, path.slice(0, path.lastIndexOf('/'))).match
}

/**
 * Narrows the list, keeping groups that still have something to hold.
 *
 * A group survives on either of two counts: its own name matched, in which case
 * everything inside it comes along — you asked for that group — or one of its
 * children matched, in which case it stays as the heading that says where the
 * child lives. A matching child without its group would be a row that has lost
 * the one piece of context the panel exists to give it.
 */
export function filterBookmarks(bookmarks: BookmarkView[], query: string): BookmarkView[] {
  const trimmed = query.trim()
  if (trimmed === '') return bookmarks

  const groupsWanted = new Set<string>()
  for (const entry of bookmarks) {
    if (!matches(entry, trimmed)) continue
    if (entry.kind === 'group') groupsWanted.add(entry.id)
    else if (entry.groupId) groupsWanted.add(entry.groupId)
  }

  return bookmarks.filter(entry => {
    if (entry.kind === 'group') return groupsWanted.has(entry.id)
    if (entry.groupId && groupsWanted.has(entry.groupId)) {
      // Inside a group that was named outright, every child belongs.
      const group = bookmarks.find(candidate => candidate.id === entry.groupId)
      if (group && matches(group, trimmed)) return true
    }
    return matches(entry, trimmed)
  })
}
