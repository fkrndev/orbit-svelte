import { describe, expect, it, beforeAll } from 'vitest'
import { MarkdownManager } from '@tiptap/markdown'
import { richExtensions } from '../richExtensions'
import { bodyForEditor, compactBody } from '../richEditorMarkdown'
import { postProcessAssetMarkdown } from '../assetUrls'
import { splitFrontmatter } from '../frontmatter'

/**
 * The one test that would catch a broken editor.
 *
 * It drives the **real extension set** — the same list `RichEditor.svelte`
 * builds its editor from — through the same markdown pipeline the app uses, and
 * asserts that a document survives the trip. If opening and saving a file loses
 * content or mutates it, this fails.
 *
 * Driven through `MarkdownManager` rather than a live `Editor`, and that is a
 * deliberate narrowing rather than a shortcut: the manager is exactly the
 * parse/serialize half that `editor.getMarkdown()` delegates to, and it needs no
 * view. A real editor in jsdom instead mounts every Svelte node view — the
 * mermaid canvas, the media placeholder — none of which have any say in what
 * markdown comes out, and all of which fall over without layout. Testing
 * through them would be testing the renderer.
 */

let manager: MarkdownManager

beforeAll(() => {
  manager = new MarkdownManager({ extensions: richExtensions() })
})

/**
 * A path, because the asset codec needs one — and using the real pair here is
 * the point: `bodyForEditor` rewrites an image to a URL the editor can fetch and
 * `postProcessAssetMarkdown` rewrites it back, exactly as the app does either
 * side of a save. Half the pair, or a broken one, now fails these cases rather
 * than showing up as a broken image nobody tested.
 */
const NOTE = '/vault/notes/one.md'

function roundTrip(markdown: string): string {
  const [frontmatter] = splitFrontmatter(markdown)
  const doc = manager.parse(bodyForEditor(markdown, NOTE))
  const body = postProcessAssetMarkdown(NOTE, compactBody(manager.serialize(doc)))
  return `${frontmatter}${body}`
}

/**
 * Serialization always ends the document with a newline, which is what we want
 * on disk but noise in an equality assertion.
 */
function roundTripTrimmed(markdown: string): string {
  return roundTrip(markdown).trimEnd()
}

describe('markdown round trip through the real extension set', () => {
  it('preserves an image and a link to another file', () => {
    // Both are how this app refers to anything outside the document, so a
    // regression here silently breaks every attachment and cross-reference.
    const markdown = [
      '![A screenshot](assets/shot.png)',
      '',
      'See [the plan](../docs/plan.md) for context.',
    ].join('\n')

    expect(roundTripTrimmed(markdown)).toBe(markdown)
  })

  it('preserves headings, emphasis, and lists', () => {
    const markdown = [
      '# Title',
      '',
      'A paragraph with **bold**, *italic*, and `code`.',
      '',
      '- one',
      '- two',
    ].join('\n')

    expect(roundTripTrimmed(markdown)).toBe(markdown)
  })

  it('preserves fenced code blocks and their language', () => {
    const markdown = ['```ts', 'const x: number = 1', '```'].join('\n')
    expect(roundTripTrimmed(markdown)).toBe(markdown)
  })

  it('preserves checklists and their checked state', () => {
    const markdown = ['- [ ] an open task', '- [x] a done task'].join('\n')
    expect(roundTripTrimmed(markdown)).toBe(markdown)
  })

  it('preserves a blockquote', () => {
    expect(roundTripTrimmed('> a quote')).toBe('> a quote')
  })

  /**
   * Asserted by convergence rather than by exact bytes: the serializer pads
   * cells to a common width (`| a   | b   |`), which is valid markdown and
   * stable. Pinning the unpadded spelling would be pinning a formatting choice
   * that is not ours to make — what has to hold is that the cells survive and
   * that a second save changes nothing.
   */
  it('preserves a table, and settles on one spelling of it', () => {
    const markdown = ['| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n')
    const once = roundTripTrimmed(markdown)
    expect(once).toContain('| 1')
    expect(once).toContain('| 2')
    expect(roundTripTrimmed(once)).toBe(once)
  })

  /**
   * The guarantee that actually matters for a file the user did not write.
   *
   * A first save may normalise spacing — `compactMarkdown` tightens the blank
   * line between two adjacent lists, for instance. What must never happen is
   * *continued* drift: opening and saving a file repeatedly has to converge, or
   * every visit would rewrite the document and pollute the user's git diff.
   */
  it('is idempotent — a second round trip changes nothing', () => {
    const markdown = [
      '# Notes',
      '',
      '- bullet',
      '- bullet two',
      '',
      '1. numbered',
      '2. numbered two',
      '',
      '> a quote',
      '',
      '```js',
      'const a = 1',
      '```',
      '',
      'Trailing paragraph with a [link](https://example.com).',
    ].join('\n')

    const once = roundTrip(markdown)
    const twice = roundTrip(once)
    expect(twice).toBe(once)
  })

  it('passes frontmatter through untouched', () => {
    const markdown = [
      '---',
      'title: Example',
      'weird_key: [1, 2, 3]',
      '---',
      '',
      '# Body',
    ].join('\n')

    const result = roundTrip(markdown)
    expect(result.startsWith('---\ntitle: Example\nweird_key: [1, 2, 3]\n---\n')).toBe(true)
    expect(result).toContain('# Body')
  })

  it('does not lose content on an empty document', () => {
    expect(roundTrip('').trim()).toBe('')
  })

  /*
   * Tags and mentions are *decorations* — the document holds the same
   * characters the file does, and `inlineRefDecorations.ts` only paints over
   * them. This is the assertion that keeps it that way: the day someone makes
   * them a node, a `#` starts coming back escaped as `\#` and every tag in every
   * note quietly stops being a tag.
   */
  it('leaves #tags and @mentions as the plain text they are', () => {
    const markdown = [
      'Kirim ke @budi soal #deploy dan #work/admin.',
      '',
      '- [ ] tanya @first.last dulu',
    ].join('\n')

    expect(roundTripTrimmed(markdown)).toBe(markdown)
  })
})
