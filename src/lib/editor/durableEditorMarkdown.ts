import {
  hasDurableMarkdownBlocks,
  injectDurableMarkdownBlocks,
  preProcessDurableMarkdownBlocks,
  serializeDurableMarkdownBlocks,
  type MarkdownSerializer,
} from './durableMarkdownBlocks'
import { restoreMarkdownHighlightsInBlocks } from './markdownHighlightMarkdown'
import { serializeMathAwareBlocks } from './mathMarkdown'
import { mermaidMarkdownCodec } from './mermaidMarkdown'

/**
 * "Durable" blocks are the ones BlockNote would otherwise mangle on a
 * round trip: fenced content that has to come back out byte-identical.
 *
 * Adapted from tolaria's `editorDurableMarkdown.ts`. Two codecs were dropped:
 * `tldraw` (whiteboards are out of scope) and `fileAttachment` (it resolved
 * paths against a vault root, a concept this app does not have).
 */
const EDITOR_DURABLE_MARKDOWN_CODECS = [mermaidMarkdownCodec] as const

export function preProcessDurableEditorMarkdown({ markdown }: { markdown: string }): string {
  return preProcessDurableMarkdownBlocks({
    markdown,
    codecs: EDITOR_DURABLE_MARKDOWN_CODECS,
  })
}

export function injectDurableEditorMarkdownBlocks(blocks: unknown[]): unknown[] {
  return injectDurableMarkdownBlocks({
    blocks,
    codecs: EDITOR_DURABLE_MARKDOWN_CODECS,
  })
}

export function serializeDurableEditorBlocks(
  editor: MarkdownSerializer,
  blocks: unknown[],
): string {
  return serializeDurableMarkdownBlocks({
    blocks,
    codecs: EDITOR_DURABLE_MARKDOWN_CODECS,
    serializeOrdinaryBlocks: ordinaryBlocks =>
      serializeMathAwareBlocks(editor, restoreMarkdownHighlightsInBlocks(ordinaryBlocks)),
  })
}

export function hasDurableEditorBlocks(blocks: unknown[]): boolean {
  return hasDurableMarkdownBlocks({ blocks, codecs: EDITOR_DURABLE_MARKDOWN_CODECS })
}
