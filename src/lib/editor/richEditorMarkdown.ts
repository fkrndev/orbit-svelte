import type { Editor } from '@tiptap/core'
import { compactMarkdown } from './compact-markdown'
import { splitFrontmatter } from './frontmatter'
import { postProcessAssetMarkdown, preProcessAssetMarkdown } from './assetUrls'

/**
 * The rich editor's document <-> markdown boundary.
 *
 * Two invariants live here, and `__tests__/roundTrip.test.ts` is what holds them:
 *
 * 1. **Frontmatter is never owned by the editor.** It is sliced off before the
 *    body is parsed and re-attached verbatim on the way out, so the editor
 *    cannot reorder, requote, or reflow a key it does not understand.
 * 2. **Serialization is idempotent.** A first save may normalise spacing; a
 *    second must change nothing, or every visit to a file would rewrite it and
 *    pollute the user's diff.
 *
 * The markdown itself is `@tiptap/markdown`'s, which Edra already configures —
 * this module is the app's rules *around* it, not a second serializer.
 */

/**
 * The body of a file, ready for `setContent(..., { contentType: 'markdown' })`.
 *
 * The note's path is needed for its images and only for them: `assets/shot.png`
 * is resolved against the *page* by anything that renders it, so it has to be
 * rewritten to a fetchable URL on the way in — and rewritten back by
 * `serializeRichEditorDocument` on the way out. The two are a pair; the reason
 * they are one is that a body which went through only one of them either shows
 * broken images or writes a `localhost` URL into the file. See `assetUrls.ts`.
 */
export function bodyForEditor(fileContent: string, notePath: string): string {
  const [, body] = splitFrontmatter(fileContent)
  return preProcessAssetMarkdown(notePath, body.trimStart())
}

/**
 * The post-processor every serialized body goes through: tight lists, `-`
 * bullets, no runs of blank lines. It is what makes the second save a no-op.
 *
 * Exported on its own so the round-trip test can drive the same normalisation
 * over `MarkdownManager` output without standing up an editor.
 */
export function compactBody(markdown: string): string {
  return compactMarkdown(markdown)
}

/** Editor document -> the body half of a markdown file. */
export function serializeRichEditorBody(editor: Editor): string {
  return compactBody(editor.getMarkdown())
}

/**
 * Editor document -> the whole file.
 *
 * Frontmatter is taken from the *file*, not from the editor, and re-attached
 * unchanged. `tabContent` is therefore the tab's current buffer rather than
 * anything the editor holds — which is also what lets the inspector edit
 * frontmatter while the rich editor is open without the two fighting.
 */
export function serializeRichEditorDocument(
  editor: Editor,
  tabContent: string,
  notePath: string,
): string {
  // Images carry a fetchable URL while they are in the editor; the file gets
  // the relative path back. See `assetUrls.ts`.
  const body = postProcessAssetMarkdown(notePath, serializeRichEditorBody(editor))
  const [frontmatter] = splitFrontmatter(tabContent)
  return `${frontmatter}${body}`
}
