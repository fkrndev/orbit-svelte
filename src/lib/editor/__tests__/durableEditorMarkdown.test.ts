import { describe, expect, it, vi } from 'vitest'
import {
  injectDurableEditorMarkdownBlocks,
  preProcessDurableEditorMarkdown,
  serializeDurableEditorBlocks,
} from '../durableEditorMarkdown'
import { MERMAID_BLOCK_TYPE } from '../mermaidMarkdown'

/**
 * Adapted from tolaria's `editorDurableMarkdown.test.ts`. The tldraw half of
 * the original round-trip was removed along with the codec; what is asserted
 * here is the property that matters either way — a durable fence survives
 * markdown -> blocks -> markdown byte for byte.
 */
describe('durable editor markdown blocks', () => {
  it('round-trips a mermaid fence through the durable pipeline', () => {
    const markdown = ['Intro', '', '```mermaid', 'flowchart LR', '  A --> B', '```'].join('\n')

    const preprocessed = preProcessDurableEditorMarkdown({ markdown })
    const blocks = injectDurableEditorMarkdownBlocks([
      { type: 'paragraph', content: [{ type: 'text', text: 'Intro', styles: {} }], children: [] },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: preprocessed.split('\n\n')[1], styles: {} }],
        children: [],
      },
    ]) as Array<{ type: string; props?: Record<string, string> }>

    expect(blocks.map(block => block.type)).toEqual(['paragraph', MERMAID_BLOCK_TYPE])
    expect(blocks[1]!.props).toMatchObject({ diagram: 'flowchart LR\n  A --> B\n' })

    const editor = {
      blocksToMarkdownLossy: vi.fn((ordinaryBlocks: unknown[]) =>
        (ordinaryBlocks as Array<{ content?: Array<{ text?: string }> }>)
          .map(block => block.content?.map(item => item.text ?? '').join('') ?? '')
          .join('\n\n'),
      ),
    }

    expect(serializeDurableEditorBlocks(editor, blocks)).toBe(markdown)
  })

  it('leaves ordinary markdown untouched', () => {
    const markdown = '# Title\n\nJust a paragraph.'
    expect(preProcessDurableEditorMarkdown({ markdown })).toBe(markdown)
  })
})
