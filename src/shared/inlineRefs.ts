/**
 * `#tag` and `@mention`, as they appear in the text of a note.
 *
 * One scanner, three readers: the rich editor paints pills with it, the raw
 * editor paints the same pills over the same characters, and the backend index
 * counts them so they can be searched. Two parsers would mean a `#tag` that is
 * drawn as a tag but cannot be found — or found but not drawn — and the bug
 * would look like a search bug rather than a parsing one.
 *
 * **They are plain text.** Nothing here turns a tag into a node, a mark, or a
 * sidecar entry: the file keeps the literal `#tag`, so it still reads as a tag
 * in Obsidian, in `grep`, and in a diff. The pill is decoration over characters
 * that are already there — see `inlineRefDecorations.ts`.
 */

import { splitFrontmatter } from './frontmatter'
import { FENCE, bodyLineOffset } from './outline'

export type InlineRefKind = 'tag' | 'mention'

export interface InlineRef {
  kind: InlineRefKind
  /** As written, without the sigil — `Draft`, `budi`. */
  label: string
  /** `label` lower-cased. The identity used for counting and lookup. */
  key: string
  /** Offset of the sigil in the scanned string. */
  start: number
  /** Offset just past the last character of the label. */
  end: number
}

/** An `InlineRef` placed in a file, which is what the index stores. */
export interface FileInlineRef extends InlineRef {
  /** 0-based line in the whole file, frontmatter included. */
  line: number
}

/**
 * What may follow a sigil.
 *
 * `/` is in the tag set so `#work/admin` is one nested tag rather than a tag
 * followed by a stray word — the convention every markdown app that has tags
 * already uses. `.` is in the mention set for `@first.last`, and is why the
 * trailing-punctuation trim below exists: a mention at the end of a sentence
 * would otherwise swallow the full stop.
 */
const BODY: Record<InlineRefKind, RegExp> = {
  tag: /[\p{L}\p{N}_/-]/u,
  mention: /[\p{L}\p{N}_.-]/u,
}

/** Punctuation that ends up inside the match but belongs to the prose. */
const TRAILING = /[-._/]+$/

/**
 * A tag has to contain a letter.
 *
 * `#1`, `#2`, `#404` are how people write list positions and issue numbers, and
 * an index full of those is an index nobody opens twice.
 */
const HAS_LETTER = /\p{L}/u

function sigilKind(char: string): InlineRefKind | null {
  if (char === '#') return 'tag'
  if (char === '@') return 'mention'
  return null
}

/**
 * The refs in one run of prose, by offset.
 *
 * Whitespace-anchored, and that single rule is what excludes most of what looks
 * like a ref and is not: `you@example.com` (the `@` follows a letter),
 * `../notes.md#section` and `[x](#anchor)` (the `#` follows a path character),
 * `C#` (nothing follows the `#`). A heading needs no special case either — `#`
 * and `##` are followed by a space, which is not a body character, so the label
 * comes out empty.
 *
 * The caller is responsible for not handing in code: `scanFileRefs` skips
 * fences and code spans, and the editors skip code nodes and code marks.
 */
export function scanRefsInText(text: string, offset = 0): InlineRef[] {
  const refs: InlineRef[] = []

  for (let i = 0; i < text.length; i += 1) {
    const kind = sigilKind(text[i]!)
    if (!kind) continue
    if (i > 0 && !/\s/.test(text[i - 1]!)) continue

    const body = BODY[kind]
    let end = i + 1
    while (end < text.length && body.test(text[end]!)) end += 1

    const label = text.slice(i + 1, end).replace(TRAILING, '')
    if (label === '' || !HAS_LETTER.test(label)) continue

    refs.push({
      kind,
      label,
      key: label.toLowerCase(),
      start: offset + i,
      end: offset + i + 1 + label.length,
    })
    // Past the label, not past the whole match: the trimmed punctuation is
    // ordinary prose again and could be followed by another ref.
    i += label.length
  }

  return refs
}

/**
 * Code spans blanked out, offsets preserved.
 *
 * Replaced with spaces rather than removed, because every offset this module
 * reports is used to place a decoration in a live document — shortening the
 * string would move every ref after the first backtick.
 */
function withoutCodeSpans(line: string): string {
  return line.replace(/`[^`]*`?/g, run => ' '.repeat(run.length))
}

/**
 * Every ref in a file, in reading order.
 *
 * Frontmatter is skipped: `tags:` up there is a *property*, already read as one
 * by `tagIndex.ts`, and scanning it again would count the same tag twice. Line
 * numbers are still file lines, so a hit can be jumped to.
 */
export function scanFileRefs(content: string): FileInlineRef[] {
  const [frontmatter] = splitFrontmatter(content)
  const offset = bodyLineOffset(frontmatter)
  const lines = content.slice(frontmatter.length).replace(/\r\n/g, '\n').split('\n')

  const refs: FileInlineRef[] = []
  let fence: string | null = null

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!

    // A `#tag` in a shell snippet is a comment, and `@decorator` is code.
    const fenceMatch = line.match(FENCE)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]!
      else if (line.trimStart().startsWith(fence)) fence = null
      continue
    }
    if (fence !== null) continue

    for (const ref of scanRefsInText(withoutCodeSpans(line))) {
      refs.push({ ...ref, line: offset + i })
    }
  }

  return refs
}

/** Cheaper than a scan, and most notes have neither. */
export function mightHaveRefs(content: string): boolean {
  return content.includes('#') || content.includes('@')
}
