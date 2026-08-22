import { fuzzyMatch } from '$shared/fuzzy'
import { relativePathBetween } from '$shared/relativePath'

/**
 * What `#` and `@` offer while you type, as a pure function of what the vault
 * already contains.
 *
 * Kept apart from the extension that draws it because this is the part with
 * rules in it — what ranks first, when the "new" row appears, what `@` means —
 * and none of those need an editor to be argued with.
 *
 * The offer is always *optional*. A tag you have never used is still a tag the
 * moment you type it, so nothing here can refuse an unknown word: the point of
 * the menu is saving keystrokes and keeping spellings consistent, not policing
 * a vocabulary. That is why `new` exists rather than an empty list.
 */

export interface RefItem {
  /**
   * `tag` and `mention` are things already written somewhere; `note` links to
   * another file; `new` is the words you just typed, offered back.
   */
  kind: 'tag' | 'mention' | 'note' | 'new'
  /** Shown on the row, and — except for `note` — what gets written. */
  label: string
  /** The muted right-hand column: a count, or a path. */
  detail: string
  /** Only on `note`: the relative link target. */
  href?: string
}

/** Enough to choose from without turning the popup into a file browser. */
const LIMIT = 8

function matches(query: string, label: string): boolean {
  return query === '' || fuzzyMatch(query, label).match
}

function rank(query: string, label: string): number {
  return query === '' ? 0 : fuzzyMatch(query, label).score
}

/**
 * A `new` row, unless the query is already one of the offers.
 *
 * Compared case-insensitively for the same reason the index counts that way: a
 * menu that offers to create `#Draft` under an existing `#draft` is offering to
 * split a tag in two, which is the one outcome nobody typing a `#` wants.
 */
function withNew(query: string, found: RefItem[], sigil: string): RefItem[] {
  const wanted = query.trim().toLowerCase()
  if (wanted === '') return found
  if (found.some(item => item.kind !== 'note' && item.label.toLowerCase() === wanted)) return found
  return [...found, { kind: 'new', label: query.trim(), detail: `New ${sigil}${query.trim()}` }]
}

/** `#` — the tags already in the vault, most used first. */
export function tagItems(query: string, tags: Array<{ tag: string; count: number }>): RefItem[] {
  const found = tags
    .filter(entry => matches(query, entry.tag))
    .sort((a, b) => rank(query, b.tag) - rank(query, a.tag) || b.count - a.count)
    .slice(0, LIMIT)
    .map(entry => ({
      kind: 'tag' as const,
      label: entry.tag,
      detail: `${entry.count} ${entry.count === 1 ? 'note' : 'notes'}`,
    }))

  return withNew(query, found, '#')
}

/**
 * `@` — the names you have used, then the notes you could link to.
 *
 * Both, because `@` is asked in two moods and the difference is not visible
 * until after you have typed: `@budi` is usually a person, `@plan-rilis` is
 * usually the note of that name. Guessing wrong either drops a dead pill where a
 * link was wanted or a link where a name was, so both are offered and the row
 * you pick is the answer.
 *
 * Names first even though notes outnumber them: a name is the shorter list and
 * the one you meant if it is there at all — and the notes below it are the same
 * ones `/link` and ⌘K show, so nothing is lost by them being second.
 */
export function mentionItems(
  query: string,
  mentions: Array<{ mention: string; count: number }>,
  notes: Array<{ path: string; name: string }>,
  notePath: string,
): RefItem[] {
  const names = mentions
    .filter(entry => matches(query, entry.mention))
    .sort((a, b) => rank(query, b.mention) - rank(query, a.mention) || b.count - a.count)
    .slice(0, LIMIT)
    .map(entry => ({
      kind: 'mention' as const,
      label: entry.mention,
      detail: `${entry.count} ${entry.count === 1 ? 'note' : 'notes'}`,
    }))

  const files = notes
    .filter(note => note.path !== notePath)
    .map(note => ({ note, title: note.name.replace(/\.mdx?$/i, '') }))
    .filter(entry => matches(query, entry.title))
    .sort((a, b) => rank(query, b.title) - rank(query, a.title) || a.title.localeCompare(b.title))
    .slice(0, LIMIT - Math.min(names.length, 3))
    .map(entry => ({
      kind: 'note' as const,
      label: entry.title,
      detail: relativePathBetween(notePath, entry.note.path),
      href: relativePathBetween(notePath, entry.note.path),
    }))

  return withNew(query, [...names, ...files], '@')
}
