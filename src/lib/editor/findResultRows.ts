import type { EditorFindMatch } from './editorFind'

/**
 * Turning matches into something a list can render.
 *
 * A result row is one line of the document with the match cut out of it, so the
 * panel can draw the hit without doing any string surgery of its own. Long
 * lines are windowed around the match rather than truncated from the left,
 * because a match 300 characters into a line is exactly the one you would
 * otherwise never see.
 */

export interface FindResultRow {
  /** Index of this match in the full match list — what selecting the row activates. */
  index: number
  /** 1-based line number in the searched text. */
  line: number
  before: string
  match: string
  after: string
  /** True when `before` was cut, so the row can show a leading ellipsis. */
  clipped: boolean
}

const CONTEXT_BEFORE = 28
const MAX_ROW_LENGTH = 140

function lineStartOffsets(text: string): number[] {
  const starts = [0]
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    starts.push(index + 1)
  }
  return starts
}

/** Index of the line containing `offset`, via binary search over line starts. */
function lineIndexAt(starts: readonly number[], offset: number): number {
  let low = 0
  let high = starts.length - 1

  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (starts[middle]! <= offset) low = middle
    else high = middle - 1
  }

  return low
}

export function buildFindResultRows(
  text: string,
  matches: readonly EditorFindMatch[],
): FindResultRow[] {
  if (matches.length === 0) return []
  const starts = lineStartOffsets(text)

  return matches.map((match, index) => {
    const lineIndex = lineIndexAt(starts, match.from)
    const lineStart = starts[lineIndex]!
    const lineEnd = lineIndex + 1 < starts.length ? starts[lineIndex + 1]! - 1 : text.length

    // A match can run past the end of its own line (a multi-line regex hit);
    // the row shows the part that belongs to this line and nothing more.
    const matchEnd = Math.min(match.to, lineEnd)
    // A line that fits is shown whole. Windowing it anyway would put an
    // ellipsis in front of a row with nothing hidden behind it.
    const fits = lineEnd - lineStart <= MAX_ROW_LENGTH
    const windowStart = fits ? lineStart : Math.max(lineStart, match.from - CONTEXT_BEFORE)
    const windowEnd = Math.min(lineEnd, windowStart + MAX_ROW_LENGTH)

    return {
      index,
      line: lineIndex + 1,
      before: text.slice(windowStart, match.from),
      match: text.slice(match.from, matchEnd),
      after: text.slice(matchEnd, Math.max(matchEnd, windowEnd)),
      clipped: windowStart > lineStart,
    }
  })
}
