import { describe, expect, it } from 'vitest'
import type { BookmarkView } from '../types'
import { filterBookmarks } from '../bookmarks'

function file(id: string, path: string, groupId: string | null = null): BookmarkView {
  return { id, kind: 'file', path, groupId, order: 0, exists: true }
}

function group(id: string, title: string): BookmarkView {
  return { id, kind: 'group', title, groupId: null, order: 0, exists: true }
}

const list: BookmarkView[] = [
  file('b1', '/vault/docs-id/plan-home.md'),
  file('b2', '/vault/billing/invoice.md'),
  group('g1', 'Riset'),
  file('b3', '/vault/docs-id/ARCHITECTURE.md', 'g1'),
  file('b4', '/vault/docs-id/sources.md', 'g1'),
]

const ids = (query: string) => filterBookmarks(list, query).map(entry => entry.id)

describe('filterBookmarks', () => {
  it('leaves the list alone for an empty query', () => {
    expect(filterBookmarks(list, '')).toBe(list)
    expect(filterBookmarks(list, '  ')).toBe(list)
  })

  it('matches a bookmark by its file name', () => {
    expect(ids('invoice')).toEqual(['b2'])
  })

  it('matches an abbreviation, the way the palette does', () => {
    expect(ids('arch')).toContain('b3')
  })

  it('keeps the group a matching child lives in', () => {
    // Without its heading the row loses the one piece of context this panel
    // exists to give it.
    expect(ids('arch')).toEqual(['g1', 'b3'])
  })

  it('brings the whole group along when the group itself is named', () => {
    expect(ids('riset')).toEqual(['g1', 'b3', 'b4'])
  })

  it('matches on the folder, so a query naming a place finds what is in it', () => {
    expect(ids('billing')).toEqual(['b2'])
  })

  it('keeps the arrangement rather than re-ordering by match quality', () => {
    expect(ids('m')).toEqual(list.filter(e => ids('m').includes(e.id)).map(e => e.id))
  })

  it('is empty when nothing matches', () => {
    expect(ids('zzzz')).toEqual([])
  })

  it('uses a custom title when the row has one', () => {
    const renamed: BookmarkView[] = [{ ...file('b9', '/vault/x/notes.md'), title: 'Daily log' }]
    expect(filterBookmarks(renamed, 'daily').map(e => e.id)).toEqual(['b9'])
  })
})
