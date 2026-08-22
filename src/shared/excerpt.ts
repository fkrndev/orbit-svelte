import { extractEditorBody } from './frontmatter'

/**
 * A one-line plain-text taste of a note, for list rows that show more than a
 * name.
 *
 * Deliberately not a markdown parse. This runs over every row of the Recents
 * panel, the output is two or three clipped lines, and the editor's parser is
 * the wrong tool for both — it would cost far more and could still throw on a
 * file it cannot read, which is the one thing a preview must never do.
 *
 * Lives in `shared/` because the rule is content, not presentation: the backend
 * derives it and the panel only clamps it. See the note on `rename.ts` in
 * AGENTS.md.
 */

/** Enough for three clipped lines in a sidebar; the panel decides how many. */
export const EXCERPT_MAX_CHARS = 220

/** Thematic breaks and a table's separator row: punctuation, not prose. */
const DROPPED_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,}|\|[\s\-:|]*\|)\s*$/

const FENCE = /^\s*(?:```|~~~)/

const LINE_PREFIX = /^\s*(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/
const TASK_BOX = /^\[[ xX]\]\s+/
const HEADING = /^\s*#{1,6}\s+\S/

/**
 * Inline markup, in the one order that works: images before links, because an
 * image is a link with a `!` in front and stripping the link first would leave
 * the bang behind as a stray character.
 */
const INLINE: Array<[RegExp, string]> = [
  [/<!--[\s\S]*?-->/g, ''],
  [/!\[[^\]]*\]\([^)]*\)/g, ''],
  [/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2'],
  [/\[\[([^\]]+)\]\]/g, '$1'],
  [/\[([^\]]*)\]\([^)]*\)/g, '$1'],
  // `_` is left alone: stripping it would turn `snake_case` into `snakecase`,
  // and a preview that misspells the file's own words is worse than one that
  // shows an underscore.
  [/(\*\*|~~|\*|`)/g, ''],
  // A partial read can cut a multi-byte character in half; the decoder leaves
  // a replacement glyph behind and it must not reach the row.
  [/�/g, ''],
]

/** A table row: pipes are the grid, not the words, so they come out. */
const TABLE_ROW = /^\s*\|.*\|\s*$/

function stripLine(line: string): string {
  let text = line.replace(LINE_PREFIX, '').replace(TASK_BOX, '')
  if (TABLE_ROW.test(line)) text = text.replace(/\|/g, ' ')
  for (const [pattern, replacement] of INLINE) text = text.replace(pattern, replacement)
  return text.trim()
}

/**
 * Drops a leading heading.
 *
 * The row already shows the file's name, and a note that opens with an `# H1`
 * of the same name would otherwise print it twice — the preview reads as if it
 * had nothing to say. Only the first non-empty line qualifies, so a note whose
 * body genuinely starts with a heading loses one line, not its content.
 */
function withoutTitleLine(lines: string[]): string[] {
  const first = lines.findIndex(line => line.trim() !== '')
  if (first === -1 || !HEADING.test(lines[first]!)) return lines
  return lines.slice(first + 1)
}

/**
 * Plain-text opening of a markdown file, frontmatter and markup removed.
 *
 * Takes raw file content — including the YAML block — because every caller has
 * that and none of them should have to remember to slice it off first.
 */
export function excerptFromMarkdown(raw: string, maxChars = EXCERPT_MAX_CHARS): string {
  const lines = withoutTitleLine(extractEditorBody(raw).split(/\r?\n/))

  // Fenced code is held back rather than dropped. A note that opens with a
  // diagram would otherwise preview as `flowchart LR subgraph Main[…` — the
  // markup of the thing rather than anything the note says — while a note that
  // is *only* a snippet still has to show something.
  const prose: string[] = []
  const code: string[] = []
  let fenced = false
  let length = 0

  for (const line of lines) {
    if (FENCE.test(line)) {
      fenced = !fenced
      continue
    }
    if (DROPPED_LINE.test(line)) continue
    const text = stripLine(line)
    if (!text) continue

    if (fenced) {
      if (code.join(' ').length < maxChars) code.push(text)
      continue
    }
    prose.push(text)
    length += text.length + 1
    if (length > maxChars) break
  }

  const joined = (prose.length > 0 ? prose : code).join(' ').replace(/\s+/g, ' ').trim()
  if (joined.length <= maxChars) return joined
  // Clip on a word boundary when there is one nearby, so the last word is
  // either whole or clearly cut, never a plausible-looking different word.
  const clipped = joined.slice(0, maxChars)
  const space = clipped.lastIndexOf(' ')
  const onWord = space > 0 && space >= maxChars - 20
  return `${onWord ? clipped.slice(0, space) : clipped}…`
}
