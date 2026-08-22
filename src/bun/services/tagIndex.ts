import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { readProperty } from '../../shared/frontmatter'
import { mightHaveRefs, scanFileRefs, type InlineRefKind } from '../../shared/inlineRefs'
import type { RefHit } from '../../shared/types'
import { walkMarkdown } from './files'
import { scoreByPath } from './history'
import { liveRoots, rootIdForPath } from './roots'

/**
 * Which files carry which tags and mentions.
 *
 * Two sources, one answer. A tag can be a **property** — `tags:` in frontmatter,
 * the list the properties panel edits — or it can be written **in the prose** as
 * `#draft`, which is how you tag the paragraph you are in the middle of typing.
 * They are the same tag either way and are counted as one: a vault where
 * `#draft` and `tags: [draft]` are two different things is a vault where search
 * finds half of what you wrote.
 *
 * Mentions only come from the prose — `@budi` — and are indexed here rather than
 * in a second service so a file is read once and scanned once.
 *
 * There is a `tags` array in the sidecar as well, and it is a trap: it was
 * written by an organisational panel that was removed once a property could be
 * a coloured multi-select (see ARCHITECTURE, *Properties*). Nothing writes it
 * any more, so every count taken from it is zero — which is why the dashboard's
 * tag chips were always empty and nobody noticed.
 *
 * Same shape as the todo scan: per root, short-lived, dropped by the watcher
 * when a file changes.
 */

interface RefEntry {
  /** Lower-cased, because nothing else in the app treats `#Draft` as its own tag. */
  key: string
  /** As written, for display — the first spelling seen wins. */
  label: string
  /** File line of the first occurrence, so a hit can be opened at it. */
  line: number
  /** Occurrences in this file. */
  count: number
}

interface IndexedFile {
  path: string
  tags: RefEntry[]
  mentions: RefEntry[]
}

const cache = new Map<string, { at: number; files: IndexedFile[] }>()
const CACHE_TTL_MS = 30_000

/** The `tags:` property, in either YAML shape. */
function frontmatterTags(content: string): RefEntry[] {
  // Frontmatter is at the top or nowhere, so a file without a leading `---`
  // costs a string comparison rather than a parse.
  if (!content.startsWith('---')) return []

  const entry = readProperty(content, 'tags')
  if (!entry) return []

  return (entry.shape === 'list' ? entry.items : [entry.value])
    .map(value => value.trim())
    .filter(value => value !== '')
    // Line 0: a property belongs to the whole note, so a hit on one opens at the
    // top rather than pointing at a line that does not mention it.
    .map(label => ({ key: label.toLowerCase(), label, line: 0, count: 1 }))
}

/**
 * One entry per tag per file.
 *
 * First spelling and first line win; occurrences add up. A tag written both as a
 * property and in the prose is still one tag on one note — which is what makes
 * the per-file counts in `refCounts` mean "notes", as the chips claim.
 */
function dedupe(entries: RefEntry[]): RefEntry[] {
  const byKey = new Map<string, RefEntry>()
  for (const entry of entries) {
    const seen = byKey.get(entry.key)
    if (seen) seen.count += entry.count
    else byKey.set(entry.key, { ...entry })
  }
  return [...byKey.values()]
}

function scan(path: string): IndexedFile | null {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return null
  }

  const body = (mightHaveRefs(content) ? scanFileRefs(content) : []).map(ref => ({
    key: ref.key,
    label: ref.label,
    line: ref.line,
    count: 1,
    kind: ref.kind,
  }))

  const file: IndexedFile = {
    path,
    tags: dedupe([...frontmatterTags(content), ...body.filter(ref => ref.kind === 'tag')]),
    mentions: dedupe(body.filter(ref => ref.kind === 'mention')),
  }

  return file.tags.length === 0 && file.mentions.length === 0 ? null : file
}

function filesForRoot(rootPath: string): IndexedFile[] {
  const cached = cache.get(rootPath)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.files

  const files: IndexedFile[] = []
  for (const path of walkMarkdown(rootPath)) {
    const scanned = scan(path)
    if (scanned) files.push(scanned)
  }
  cache.set(rootPath, { at: Date.now(), files })
  return files
}

function indexedFiles(): IndexedFile[] {
  return liveRoots().flatMap(root => filesForRoot(root.path))
}

export function invalidateTagCache(path?: string) {
  if (!path) {
    cache.clear()
    return
  }
  for (const rootPath of cache.keys()) {
    if (path.startsWith(`${rootPath}/`)) cache.delete(rootPath)
  }
}

function entriesOf(file: IndexedFile, kind: InlineRefKind): RefEntry[] {
  return kind === 'tag' ? file.tags : file.mentions
}

/**
 * Most used first, then alphabetical — the order a chip row wants.
 *
 * Counted per **file**, not per occurrence: the question a chip answers is "how
 * many notes is this in", and a note that says `#draft` in nine paragraphs is
 * still one note to open.
 */
export function refCounts(kind: InlineRefKind): Array<{ label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>()

  for (const file of indexedFiles()) {
    for (const entry of entriesOf(file, kind)) {
      const seen = counts.get(entry.key)
      if (seen) seen.count += 1
      else counts.set(entry.key, { label: entry.label, count: 1 })
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function pathsWithRef(kind: InlineRefKind, label: string): string[] {
  return hitsForRef(kind, label).map(hit => hit.path)
}

/**
 * The notes carrying one tag or mention, in the order the sidebar lists them.
 *
 * Ranked by frecency, like everything else that answers "which of these did you
 * mean" in this app — the tag you just clicked is usually about the work you are
 * in the middle of. Occurrence count breaks the tie, so the note that is *about*
 * a tag comes above one that mentions it in passing.
 */
export function hitsForRef(
  kind: InlineRefKind,
  label: string,
  limit = 200,
): RefHit[] {
  const wanted = label.trim().toLowerCase()
  if (wanted === '') return []

  const scores = scoreByPath()

  return indexedFiles()
    .flatMap(file => {
      const entry = entriesOf(file, kind).find(candidate => candidate.key === wanted)
      if (!entry || !existsSync(file.path)) return []
      return [
        {
          path: file.path,
          name: basename(file.path),
          rootId: rootIdForPath(file.path),
          line: entry.line,
          count: entry.count,
        },
      ]
    })
    .sort(
      (a, b) =>
        (scores.get(b.path) ?? 0) - (scores.get(a.path) ?? 0) ||
        b.count - a.count ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
}

export function tagCounts(): Array<{ tag: string; count: number }> {
  return refCounts('tag').map(({ label, count }) => ({ tag: label, count }))
}

export function pathsWithTag(tag: string): string[] {
  return pathsWithRef('tag', tag)
}
