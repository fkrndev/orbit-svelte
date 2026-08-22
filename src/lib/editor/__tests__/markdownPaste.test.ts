import { beforeAll, describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { MarkdownManager } from '@tiptap/markdown'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import type { Schema } from '@tiptap/pm/model'
import { richExtensions } from '../richExtensions'
import {
  isLiteralContext,
  isPlainTextCarrier,
  looksLikeMarkdown,
  pasteContentFromDoc,
} from '../markdownPaste'

/**
 * The paste path, in the three decisions it is made of: *should* this text be
 * read as markdown, *may* it be (given what else the clipboard holds and where
 * the caret is), and *what* gets inserted.
 *
 * Driven through `MarkdownManager` and a bare `EditorState` rather than a live
 * editor, for the reason `roundTrip.test.ts` gives: the manager is the parse
 * half `editor.storage.markdown` delegates to, and a real editor in jsdom
 * mounts every Svelte node view to answer a question none of them have a say
 * in.
 */

let manager: MarkdownManager
let schema: Schema

beforeAll(() => {
  manager = new MarkdownManager({ extensions: richExtensions() })
  schema = getSchema(richExtensions())
})

describe('looksLikeMarkdown', () => {
  it.each([
    ['heading', '## Notes'],
    ['bullet list', '- one\n- two'],
    ['task list', '- [ ] buy milk\n- [x] call back'],
    ['ordered list', '1. first\n2. second'],
    ['quote', '> quoted'],
    ['fenced code', '```ts\nconst a = 1\n```'],
    ['thematic break', 'before\n\n---\n\nafter'],
    ['table', '| a | b |\n| --- | --- |\n| 1 | 2 |'],
    ['bold', 'this is **important** news'],
    ['link', 'see [the docs](https://example.com) for more'],
    ['image', '![shot](assets/shot.png)'],
    ['inline code', 'run `bun test` first'],
    ['strikethrough', 'was ~~true~~ false'],
  ])('reads %s as markdown', (_label, text) => {
    expect(looksLikeMarkdown(text)).toBe(true)
  })

  it.each([
    ['plain prose', 'Just a sentence about nothing in particular.'],
    ['two paragraphs', 'First paragraph.\n\nSecond paragraph.'],
    ['empty', '   \n  '],
    ['a bare URL', 'https://example.com/a/(b)/c'],
    ['arithmetic', 'the total is 2 * 3 * 4'],
    ['snake_case identifiers', 'call some_helper_name with other_value'],
    ['a single pipe row', '| not really a table'],
  ])('leaves %s alone', (_label, text) => {
    expect(looksLikeMarkdown(text)).toBe(false)
  })
})

describe('isPlainTextCarrier', () => {
  it('treats an empty clipboard flavour as plain', () => {
    expect(isPlainTextCarrier('')).toBe(true)
  })

  it('treats a code editor’s syntax colouring as plain', () => {
    const vscode =
      '<meta charset="utf-8"><div style="color:#cccccc;background:#1f1f1f">' +
      '<div><span style="color:#569cd6">## Notes</span></div></div>'
    expect(isPlainTextCarrier(vscode)).toBe(true)
  })

  it('keeps its hands off real formatting', () => {
    expect(isPlainTextCarrier('<h2>Notes</h2><ul><li>one</li></ul>')).toBe(false)
    expect(isPlainTextCarrier('<p>see <a href="https://example.com">docs</a></p>')).toBe(false)
    expect(isPlainTextCarrier('<pre><code>const a = 1</code></pre>')).toBe(false)
  })

  it('keeps its hands off a ProseMirror copy', () => {
    expect(isPlainTextCarrier('<div data-pm-slice="1 1 []"><p>- one</p></div>')).toBe(false)
  })

  it('treats an unknown tag as formatting', () => {
    expect(isPlainTextCarrier('<custom-thing>- one</custom-thing>')).toBe(false)
  })
})

describe('isLiteralContext', () => {
  function stateWithCursorIn(node: 'paragraph' | 'codeBlock'): EditorState {
    const doc = schema.node('doc', null, [schema.node(node, null, [schema.text('# text')])])
    const state = EditorState.create({ schema, doc })
    return state.apply(state.tr.setSelection(TextSelection.create(doc, 3)))
  }

  it('lets markdown through in prose', () => {
    expect(isLiteralContext(stateWithCursorIn('paragraph'))).toBe(false)
  })

  it('holds off inside a code block', () => {
    expect(isLiteralContext(stateWithCursorIn('codeBlock'))).toBe(true)
  })

  it('holds off inside an inline code span', () => {
    const state = stateWithCursorIn('paragraph')
    const withCodeMark = state.apply(state.tr.addStoredMark(schema.marks.code.create()))
    expect(isLiteralContext(withCodeMark)).toBe(true)
  })
})

describe('what gets inserted', () => {
  function pasteOf(markdown: string) {
    return pasteContentFromDoc(manager.parse(markdown))
  }

  it('unwraps a one-paragraph paste to inline content, so it merges at the caret', () => {
    const content = pasteOf('this is **important** news')
    expect(content?.every(node => node.type === 'text')).toBe(true)
    expect(content?.some(node => node.marks?.some(mark => mark.type === 'bold'))).toBe(true)
  })

  it('keeps a multi-block paste as blocks', () => {
    const content = pasteOf('## Notes\n\nsome prose')
    expect(content?.map(node => node.type)).toEqual(['heading', 'paragraph'])
    expect(content?.[0].attrs?.level).toBe(2)
  })

  it('renders a pasted checklist as a task list', () => {
    const content = pasteOf('- [ ] buy milk\n- [x] call back')
    expect(content?.[0].type).toBe('taskList')
    const items = content?.[0].content ?? []
    expect(items.map(item => item.attrs?.checked)).toEqual([false, true])
  })

  it('renders a pasted table as a table', () => {
    const content = pasteOf('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(content?.[0].type).toBe('table')
  })

  it('keeps a fenced block fenced, language and all', () => {
    const content = pasteOf('```ts\nconst a = 1\n```')
    expect(content?.[0].type).toBe('codeBlock')
    expect(content?.[0].attrs?.language).toBe('ts')
  })

  it('inserts nothing for markdown that parses to nothing', () => {
    expect(pasteContentFromDoc({ type: 'doc', content: [] })).toBeNull()
    expect(pasteContentFromDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBeNull()
  })
})
