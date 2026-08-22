import { describe, expect, it } from 'vitest'
import {
  blockHeadingLevel,
  collapsedSectionRenderState,
  type CollapsibleBlock,
} from '../collapsedSections'

function heading(id: string, level: number): CollapsibleBlock {
  return { id, props: { level }, type: 'heading' }
}

function paragraph(id: string): CollapsibleBlock {
  return { id, type: 'paragraph' }
}

function listItem(id: string, children: CollapsibleBlock[] = []): CollapsibleBlock {
  return { children, id, type: 'bulletListItem' }
}

function hidden(blocks: CollapsibleBlock[], collapsedIds: string[]) {
  return [...collapsedSectionRenderState(blocks, new Set(collapsedIds)).hiddenIds].sort()
}

describe('blockHeadingLevel', () => {
  it('reads the level whether it arrives as a number or a string', () => {
    expect(blockHeadingLevel(heading('a', 3))).toBe(3)
    expect(blockHeadingLevel({ id: 'a', props: { level: '2' }, type: 'heading' })).toBe(2)
  })

  it('defaults a heading with no level to 1, and rejects out-of-range levels', () => {
    expect(blockHeadingLevel({ id: 'a', type: 'heading' })).toBe(1)
    expect(blockHeadingLevel({ id: 'a', props: { level: 9 }, type: 'heading' })).toBeNull()
  })

  it('is null for anything that is not a heading', () => {
    expect(blockHeadingLevel(paragraph('a'))).toBeNull()
    expect(blockHeadingLevel(undefined)).toBeNull()
  })
})

describe('collapsedSectionRenderState', () => {
  it('hides nothing while nothing is collapsed', () => {
    expect(hidden([heading('h', 1), paragraph('p')], [])).toEqual([])
  })

  it('hides the blocks a collapsed heading owns, but not the heading itself', () => {
    const blocks = [heading('h1', 1), paragraph('p1'), paragraph('p2')]
    expect(hidden(blocks, ['h1'])).toEqual(['p1', 'p2'])
  })

  it('stops at the next heading of the same or higher rank', () => {
    const blocks = [
      heading('h2a', 2),
      paragraph('under-h2a'),
      heading('h3', 3),
      paragraph('under-h3'),
      heading('h2b', 2),
      paragraph('under-h2b'),
      heading('h1', 1),
      paragraph('under-h1'),
    ]
    // The nested h3 and its content belong to the collapsed h2a; h2b ends it.
    expect(hidden(blocks, ['h2a'])).toEqual(['h3', 'under-h2a', 'under-h3'])
  })

  it('stops at a divider', () => {
    const blocks = [
      heading('h', 1),
      paragraph('inside'),
      { id: 'rule', type: 'divider' },
      paragraph('after'),
    ]
    expect(hidden(blocks, ['h'])).toEqual(['inside'])
  })

  it('hides a collapsed list item’s children at every depth', () => {
    const blocks = [listItem('item', [listItem('child', [paragraph('grandchild')])])]
    expect(hidden(blocks, ['item'])).toEqual(['child', 'grandchild'])
  })

  it('leaves a childless list item alone', () => {
    expect(hidden([listItem('item')], ['item'])).toEqual([])
  })

  it('reports a collapsed heading as collapsed only while it is visible', () => {
    const blocks = [heading('outer', 1), heading('inner', 2), paragraph('p')]
    const state = collapsedSectionRenderState(blocks, new Set(['outer', 'inner']))
    // `inner` is hidden by `outer`, so it gets no ellipsis of its own — but it
    // stays in the store, and reappears collapsed when `outer` expands.
    expect([...state.collapsedIds]).toEqual(['outer'])
    expect([...state.hiddenIds].sort()).toEqual(['inner', 'p'])
  })
})
