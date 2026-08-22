import { describe, expect, it } from 'vitest'
import { outline, outlineDepth } from '../outline'

describe('outline', () => {
  it('reads headings in order with their level', () => {
    const doc = '# One\n\ntext\n\n## Two\n\n### Three\n\n## Four\n'
    expect(outline(doc).map(h => [h.level, h.text])).toEqual([
      [1, 'One'],
      [2, 'Two'],
      [3, 'Three'],
      [2, 'Four'],
    ])
  })

  it('ignores a hash inside a fenced code block', () => {
    const doc = '# Real\n\n```sh\n# not a heading\n$ echo hi\n```\n\n## Also real\n'
    expect(outline(doc).map(h => h.text)).toEqual(['Real', 'Also real'])
  })

  it('handles tilde fences and unclosed ones', () => {
    expect(outline('# A\n\n~~~\n# hidden\n~~~\n\n# B\n').map(h => h.text)).toEqual(['A', 'B'])
    // An unterminated fence swallows the rest, which is what a renderer does too.
    expect(outline('# A\n\n```\n# hidden\n').map(h => h.text)).toEqual(['A'])
  })

  it('strips inline markup from the label', () => {
    const doc = '# `code` and **bold** and [link](http://x) and ==mark==\n'
    expect(outline(doc)[0]!.text).toBe('code and bold and link and mark')
  })

  it('drops the closing hashes of a closed ATX heading', () => {
    expect(outline('## Closed ##\n')[0]!.text).toBe('Closed')
  })

  it('is not fooled by a hash with no space', () => {
    expect(outline('#hashtag\n\n# Heading\n').map(h => h.text)).toEqual(['Heading'])
  })

  it('reports lines against the whole file, past the frontmatter', () => {
    const doc = '---\ntitle: T\nstatus: draft\n---\n\n# First\n\n## Second\n'
    expect(outline(doc).map(h => [h.text, h.line])).toEqual([
      ['First', 5],
      ['Second', 7],
    ])
  })

  it('numbers headings so the editor can find the nth block', () => {
    expect(outline('# A\n## B\n### C\n').map(h => h.index)).toEqual([0, 1, 2])
  })

  it('is empty for a document with no headings', () => {
    expect(outline('Just prose.\n\nMore prose.\n')).toEqual([])
  })
})

describe('outlineDepth', () => {
  it('indents relative to the shallowest heading in the document', () => {
    // A note that starts at `##` should not be indented for its whole length.
    const headings = outline('## Top\n### Under\n')
    expect(headings.map(h => outlineDepth(headings, h))).toEqual([0, 1])
  })
})
