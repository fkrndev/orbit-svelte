/**
 * Flattening the rich document into one searchable string.
 *
 * The find model works on offsets into a plain string; ProseMirror works on
 * document positions. This is the map between them, kept pure so the arithmetic
 * — which is the part that can select the wrong words — is testable without an
 * editor.
 */

export type FindTextRun =
  /** A text node, at its ProseMirror document position. */
  | { kind: 'text'; pos: number; text: string }
  /**
   * A block boundary. It contributes a newline to the searchable text so that
   * two adjacent blocks do not read as one word, but it maps to no document
   * position — a match that lands inside it is discarded rather than guessed at.
   */
  | { kind: 'gap' }

interface FindTextSegment {
  /** Offset of this run's first character in the flattened text. */
  start: number
  /** Offset one past its last character. */
  end: number
  /** Document position of that first character. */
  pos: number
}

export interface RichFindIndex {
  text: string
  /**
   * The document range covering `[from, to)` of the flattened text, or null if
   * either end falls in a gap — a match spanning a block boundary has no single
   * range that could be selected or replaced.
   */
  resolveRange(from: number, to: number): { from: number; to: number } | null
}

const GAP_TEXT = '\n'

function segmentAt(segments: readonly FindTextSegment[], offset: number): FindTextSegment | null {
  let low = 0
  let high = segments.length - 1

  while (low <= high) {
    const middle = (low + high) >> 1
    const segment = segments[middle]!
    if (offset < segment.start) high = middle - 1
    else if (offset >= segment.end) low = middle + 1
    else return segment
  }

  return null
}

export function buildRichFindIndex(runs: readonly FindTextRun[]): RichFindIndex {
  const segments: FindTextSegment[] = []
  let text = ''

  for (const run of runs) {
    if (run.kind === 'gap') {
      // Leading and doubled gaps would only pad the text with newlines nothing
      // can match against.
      if (text.length > 0 && !text.endsWith(GAP_TEXT)) text += GAP_TEXT
      continue
    }
    if (run.text.length === 0) continue

    segments.push({ start: text.length, end: text.length + run.text.length, pos: run.pos })
    text += run.text
  }

  return {
    text,
    resolveRange(from, to) {
      if (to <= from) return null

      const startSegment = segmentAt(segments, from)
      // `to` is exclusive, so the last character it covers is at `to - 1`.
      const endSegment = segmentAt(segments, to - 1)
      if (!startSegment || !endSegment) return null

      return {
        from: startSegment.pos + (from - startSegment.start),
        to: endSegment.pos + (to - endSegment.start),
      }
    },
  }
}
