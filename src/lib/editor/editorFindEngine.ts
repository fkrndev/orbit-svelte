import type { EditorFindChange, EditorFindMatch } from './editorFind'

/**
 * What the find bar needs from an editor.
 *
 * Both editors can be searched, and they have nothing in common underneath —
 * one is CodeMirror over markdown source, the other is ProseMirror over a block
 * document. This is the whole of the difference, so the bar itself is written
 * once and neither editor knows the other exists.
 *
 * Note what `text` means: in the source editor it is the markdown as written,
 * in the rich editor it is the prose as rendered. Searching for `**bold**` finds
 * it in one and not the other, which is what a reader of either view expects.
 */
export interface EditorFindEngine {
  /** The text the query runs against; changes as the document does. */
  text: string
  /** Paint every match, marking `activeIndex` as the one in hand. */
  highlight(matches: readonly EditorFindMatch[], activeIndex: number): void
  /** Remove the paint — the bar has closed. */
  clearHighlights(): void
  /** Put the caret on a match and bring it into view, without taking focus. */
  reveal(match: EditorFindMatch): void
  replaceOne(change: EditorFindChange): void
  replaceAll(changes: readonly EditorFindChange[]): void
  /** Hand focus back to the document. */
  focus(): void
}
