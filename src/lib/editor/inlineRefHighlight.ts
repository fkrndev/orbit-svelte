import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { FENCE } from '$shared/outline'
import { scanRefsInText } from '$shared/inlineRefs'

/**
 * The source editor's half of the tag pills.
 *
 * Same classes as `inlineRefDecorations.ts`, so `#draft` looks the same whether
 * you are looking at the prose or at the markdown — which matters more here than
 * anywhere else, because switching between the two views is how you check what
 * the file actually says.
 *
 * Only the visible lines are scanned. A pill is a paint job, and painting the
 * ten thousand lines you are not looking at is how a source editor starts
 * stuttering on a long note.
 */

const tagMark = Decoration.mark({ class: 'inline-ref inline-ref--tag' })
const mentionMark = Decoration.mark({ class: 'inline-ref inline-ref--mention' })
const sigilMark = Decoration.mark({ class: 'inline-ref__sigil' })

/**
 * Whether the line at `lineNumber` sits inside a fenced block.
 *
 * Counted from the top of the document rather than from the top of the viewport:
 * a viewport that begins in the middle of a fence has no opening line to see,
 * and every `#` comment in the snippet would light up as a tag. Counting fences
 * is a scan of line *starts*, not a parse, so it stays cheap on a long file.
 */
function insideFenceAt(view: EditorView, lineNumber: number): boolean {
  let fence: string | null = null
  for (let line = 1; line < lineNumber; line += 1) {
    const text = view.state.doc.line(line).text
    const match = text.match(FENCE)
    if (!match) continue
    if (fence === null) fence = match[1]!
    else if (text.trimStart().startsWith(fence)) fence = null
  }
  return fence !== null
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  for (const { from, to } of view.visibleRanges) {
    const firstLine = view.state.doc.lineAt(from).number
    const lastLine = view.state.doc.lineAt(to).number
    // The opening marker is off-screen above, so its spelling is unknown; what
    // matters is only that the next fence line closes it.
    let fence: string | null = insideFenceAt(view, firstLine) ? '' : null

    for (let number = firstLine; number <= lastLine; number += 1) {
      const line = view.state.doc.line(number)
      const match = line.text.match(FENCE)

      if (match) {
        if (fence === null) fence = match[1]!
        else if (fence === '' || line.text.trimStart().startsWith(fence)) fence = null
        continue
      }
      if (fence !== null) continue

      for (const ref of scanRefsInText(line.text, line.from)) {
        builder.add(ref.start, ref.end, ref.kind === 'tag' ? tagMark : mentionMark)
        builder.add(ref.start, ref.start + 1, sigilMark)
      }
    }
  }

  return builder.finish()
}

export function inlineRefHighlight() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate) {
        // Scrolling counts: the lines that just came into view have never been
        // scanned, so a viewport change is as much a reason to rebuild as an
        // edit is.
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: plugin => plugin.decorations },
  )
}
