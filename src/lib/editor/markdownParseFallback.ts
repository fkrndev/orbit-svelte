type EditorBlocks = unknown[]
type ParseMarkdownBlocks = (markdown: string) => EditorBlocks | Promise<EditorBlocks>

export type MarkdownParseResult = {
  blocks: EditorBlocks
  usedSourceFallback: boolean
}

/**
 * A parse failure must never look like an empty file.
 *
 * If BlockNote throws — or silently returns nothing for markdown that clearly
 * had content — the document is rendered as plain paragraphs instead. The user
 * still sees every byte and can still save without loss; only the rich
 * rendering is degraded.
 *
 * Lifted from tolaria's `editorMarkdownParseFallback.ts`, minus the image
 * normalisation step, which existed to rewrite vault-relative asset URLs.
 */

function buildSourceLineBlock(line: string): Record<string, unknown> {
  return {
    type: 'paragraph',
    content: line ? [{ type: 'text', text: line, styles: {} }] : [],
    children: [],
  }
}

function buildMarkdownSourceBlocks(markdown: string): EditorBlocks {
  return markdown.split('\n').map(buildSourceLineBlock)
}

function parsedBlocksOrSourceFallback(
  blocks: EditorBlocks,
  sourceMarkdown: string,
): MarkdownParseResult {
  if (blocks.length > 0 || sourceMarkdown.trim().length === 0) {
    return { blocks, usedSourceFallback: false }
  }
  return { blocks: buildMarkdownSourceBlocks(sourceMarkdown), usedSourceFallback: true }
}

export async function parseMarkdownBlocksWithFallback(options: {
  parseMarkdownBlocks: ParseMarkdownBlocks
  preprocessed: string
  sourceMarkdown: string
  context: string
}): Promise<MarkdownParseResult> {
  const { parseMarkdownBlocks, preprocessed, sourceMarkdown, context } = options

  try {
    return parsedBlocksOrSourceFallback(await parseMarkdownBlocks(preprocessed), sourceMarkdown)
  } catch (error) {
    console.warn(
      `[editor] rendering ${context} as plain markdown because it could not be parsed:`,
      error,
    )
    return { blocks: buildMarkdownSourceBlocks(sourceMarkdown), usedSourceFallback: true }
  }
}
