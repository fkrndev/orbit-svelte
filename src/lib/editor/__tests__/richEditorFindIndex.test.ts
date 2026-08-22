import { describe, expect, it } from 'vitest'
import { buildRichFindIndex, type FindTextRun } from '../richEditorFindIndex'

const text = (pos: number, value: string): FindTextRun => ({ kind: 'text', pos, text: value })
const gap = (): FindTextRun => ({ kind: 'gap' })

describe('buildRichFindIndex', () => {
  it('joins runs into one searchable string, one newline per block boundary', () => {
    // BlockNote wraps each content node in a container, so gaps arrive doubled.
    const index = buildRichFindIndex([
      gap(),
      gap(),
      text(2, 'first'),
      gap(),
      gap(),
      text(11, 'second'),
    ])

    expect(index.text).toBe('first\nsecond')
  })

  it('maps a range back to document positions across the gap', () => {
    const index = buildRichFindIndex([text(2, 'alpha'), gap(), text(11, 'beta')])

    expect(index.resolveRange(0, 5)).toEqual({ from: 2, to: 7 })
    // 'beta' starts at offset 6 of "alpha\nbeta" and at position 11.
    expect(index.resolveRange(6, 10)).toEqual({ from: 11, to: 15 })
  })

  it('maps a range that spans two runs of the same block', () => {
    // "one" then bold "two" — two text nodes, no block boundary between them.
    const index = buildRichFindIndex([text(2, 'one '), text(6, 'two')])

    expect(index.resolveRange(2, 6)).toEqual({ from: 4, to: 8 })
  })

  it('refuses a range that ends inside a block boundary', () => {
    const index = buildRichFindIndex([text(2, 'alpha'), gap(), text(11, 'beta')])

    // Offset 5 is the synthetic newline; it belongs to no document position.
    expect(index.resolveRange(3, 6)).toBeNull()
    expect(index.resolveRange(0, 0)).toBeNull()
    expect(index.resolveRange(50, 60)).toBeNull()
  })

  it('ignores empty runs and a leading gap', () => {
    const index = buildRichFindIndex([gap(), text(2, ''), text(2, 'only')])

    expect(index.text).toBe('only')
    expect(index.resolveRange(0, 4)).toEqual({ from: 2, to: 6 })
  })
})
