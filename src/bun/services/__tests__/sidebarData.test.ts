import { describe, expect, it } from 'vitest'
import type { BookmarkEntry, FolderDecor } from '../../../shared/types'
import {
  addEntry,
  applyDecor,
  moveEntry,
  normalizeOrders,
  nudgeEntry,
  removeEntry,
  renameEntry,
  retargetDecor,
  retargetExact,
  retargetPrefix,
  sortEntries,
} from '../sidebarData'

function build(...inputs: Array<Parameters<typeof addEntry>[1]>): BookmarkEntry[] {
  return inputs.reduce<BookmarkEntry[]>((entries, input) => addEntry(entries, input), [])
}

const paths = (entries: BookmarkEntry[]) =>
  sortEntries(entries).map(entry => entry.path ?? entry.title ?? entry.id)

describe('addEntry', () => {
  it('appends in order', () => {
    const entries = build(
      { id: 'a', kind: 'file', path: '/n/a.md' },
      { id: 'b', kind: 'file', path: '/n/b.md' },
    )
    expect(entries.map(e => e.order)).toEqual([0, 1])
  })

  it('refuses a duplicate path', () => {
    const once = build({ id: 'a', kind: 'file', path: '/n/a.md' })
    expect(addEntry(once, { id: 'b', kind: 'file', path: '/n/a.md' })).toBe(once)
  })

  it('treats a folder and a file at the same path as different bookmarks', () => {
    const entries = build(
      { id: 'a', kind: 'file', path: '/n/x' },
      { id: 'b', kind: 'folder', path: '/n/x' },
    )
    expect(entries).toHaveLength(2)
  })

  it('allows two groups with the same name', () => {
    const entries = build(
      { id: 'g1', kind: 'group', title: 'Work' },
      { id: 'g2', kind: 'group', title: 'Work' },
    )
    expect(entries).toHaveLength(2)
  })

  it('numbers each group independently', () => {
    let entries = build({ id: 'g', kind: 'group', title: 'Work' })
    entries = addEntry(entries, { id: 'a', kind: 'file', path: '/n/a.md', groupId: 'g' })
    entries = addEntry(entries, { id: 'b', kind: 'file', path: '/n/b.md', groupId: 'g' })
    expect(entries.filter(e => e.groupId === 'g').map(e => e.order)).toEqual([0, 1])
  })
})

describe('removeEntry', () => {
  it('re-homes a group’s children instead of deleting them', () => {
    // The failure this guards against loses shortcuts the user built by hand,
    // and there is no undo behind this list.
    let entries = build({ id: 'g', kind: 'group', title: 'Work' })
    entries = addEntry(entries, { id: 'a', kind: 'file', path: '/n/a.md', groupId: 'g' })
    entries = addEntry(entries, { id: 'b', kind: 'file', path: '/n/b.md', groupId: 'g' })

    const after = removeEntry(entries, 'g')
    expect(after).toHaveLength(2)
    expect(after.every(entry => entry.groupId === null)).toBe(true)
    expect(paths(after)).toEqual(['/n/a.md', '/n/b.md'])
  })

  it('closes the order gap it leaves behind', () => {
    const entries = build(
      { id: 'a', kind: 'file', path: '/n/a.md' },
      { id: 'b', kind: 'file', path: '/n/b.md' },
      { id: 'c', kind: 'file', path: '/n/c.md' },
    )
    expect(removeEntry(entries, 'b').map(e => e.order)).toEqual([0, 1])
  })

  it('ignores an unknown id', () => {
    const entries = build({ id: 'a', kind: 'file', path: '/n/a.md' })
    expect(removeEntry(entries, 'nope')).toBe(entries)
  })
})

describe('moveEntry', () => {
  const three = () =>
    build(
      { id: 'a', kind: 'file', path: '/n/a.md' },
      { id: 'b', kind: 'file', path: '/n/b.md' },
      { id: 'c', kind: 'file', path: '/n/c.md' },
    )

  it('reorders within the top level', () => {
    expect(paths(moveEntry(three(), 'c', null, 0))).toEqual(['/n/c.md', '/n/a.md', '/n/b.md'])
  })

  it('clamps an out-of-range position rather than dropping the entry', () => {
    expect(paths(moveEntry(three(), 'a', null, 99))).toEqual(['/n/b.md', '/n/c.md', '/n/a.md'])
    expect(paths(moveEntry(three(), 'c', null, -5))).toEqual(['/n/c.md', '/n/a.md', '/n/b.md'])
  })

  it('moves an entry into a group', () => {
    let entries = three()
    entries = addEntry(entries, { id: 'g', kind: 'group', title: 'Work' })
    const moved = moveEntry(entries, 'a', 'g', 0)
    expect(moved.find(e => e.id === 'a')?.groupId).toBe('g')
  })

  it('refuses to nest a group inside a group', () => {
    let entries = build({ id: 'g1', kind: 'group', title: 'One' })
    entries = addEntry(entries, { id: 'g2', kind: 'group', title: 'Two' })
    expect(moveEntry(entries, 'g2', 'g1', 0)).toBe(entries)
  })

  it('refuses a group id that does not exist', () => {
    const entries = three()
    expect(moveEntry(entries, 'a', 'ghost', 0)).toBe(entries)
  })

  it('nudges one step and stops at the ends', () => {
    expect(paths(nudgeEntry(three(), 'a', 1))).toEqual(['/n/b.md', '/n/a.md', '/n/c.md'])
    expect(nudgeEntry(three(), 'a', -1)).toEqual(three())
  })
})

describe('renameEntry', () => {
  it('trims the title', () => {
    const entries = build({ id: 'a', kind: 'file', path: '/n/a.md' })
    expect(renameEntry(entries, 'a', '  Plan  ')[0]!.title).toBe('Plan')
  })

  it('an emptied file title falls back to the basename rather than rendering blank', () => {
    const entries = build({ id: 'a', kind: 'file', path: '/n/a.md', title: 'Plan' })
    expect(renameEntry(entries, 'a', '   ')[0]!.title).toBeUndefined()
  })

  it('a group always keeps a title, because it has no path to fall back to', () => {
    const entries = build({ id: 'g', kind: 'group', title: 'Work' })
    expect(renameEntry(entries, 'g', '')[0]!.title).toBe('Group')
  })
})

describe('normalizeOrders', () => {
  it('repairs gaps left by a hand-edited store', () => {
    const messy: BookmarkEntry[] = [
      { id: 'a', kind: 'file', path: '/n/a.md', groupId: null, order: 7 },
      { id: 'b', kind: 'file', path: '/n/b.md', groupId: null, order: 3 },
      { id: 'c', kind: 'file', path: '/n/c.md', groupId: 'g', order: 42 },
    ]
    const fixed = normalizeOrders(messy)
    expect(fixed.filter(e => e.groupId === null).map(e => e.order)).toEqual([0, 1])
    expect(fixed.find(e => e.id === 'c')?.order).toBe(0)
  })
})

describe('retargeting paths', () => {
  it('follows a renamed file', () => {
    const entries = build({ id: 'a', kind: 'file', path: '/n/a.md' })
    expect(retargetExact(entries, '/n/a.md', '/n/b.md')[0]!.path).toBe('/n/b.md')
  })

  it('follows a renamed folder and everything bookmarked inside it', () => {
    const entries = build(
      { id: 'f', kind: 'folder', path: '/n/docs' },
      { id: 'a', kind: 'file', path: '/n/docs/adr/1.md' },
      { id: 'b', kind: 'file', path: '/n/other.md' },
    )
    const moved = retargetPrefix(entries, '/n/docs', '/n/documents')
    expect(paths(moved)).toEqual(['/n/documents', '/n/documents/adr/1.md', '/n/other.md'])
  })

  it('does not drag along a folder that merely shares a prefix', () => {
    const entries = build({ id: 'a', kind: 'file', path: '/n/docs-old/x.md' })
    expect(retargetPrefix(entries, '/n/docs', '/n/documents')).toBe(entries)
  })
})

describe('folder decoration', () => {
  const decorated: Record<string, FolderDecor> = {
    '/n/docs': { icon: 'book', color: '#f00' },
    '/n/docs/adr': { color: '#0f0' },
    '/n/docs-old': { icon: 'archive' },
  }

  it('clears the key when the decoration is emptied', () => {
    const next = applyDecor(decorated, '/n/docs', {})
    expect('/n/docs' in next).toBe(false)
    expect(next['/n/docs/adr']).toBeDefined()
  })

  it('stores only the fields that were set', () => {
    expect(applyDecor({}, '/n/x', { color: '#00f' })['/n/x']).toEqual({ color: '#00f' })
  })

  it('rewrites the folder and every decorated descendant', () => {
    // Missing the descendants is the failure that matters: the renamed folder
    // visibly loses its colour, but its children keep theirs under a key
    // nothing will ever look up again.
    const moved = retargetDecor(decorated, '/n/docs', '/n/documents')
    expect(Object.keys(moved).sort()).toEqual([
      '/n/docs-old',
      '/n/documents',
      '/n/documents/adr',
    ])
    expect(moved['/n/documents']).toEqual({ icon: 'book', color: '#f00' })
    expect(moved['/n/documents/adr']).toEqual({ color: '#0f0' })
  })

  it('leaves the map alone when nothing matched', () => {
    expect(retargetDecor(decorated, '/n/nothing', '/n/else')).toBe(decorated)
  })
})

describe('sortEntries', () => {
  it('puts the top level before grouped entries', () => {
    const entries: BookmarkEntry[] = [
      { id: 'c', kind: 'file', path: '/n/c.md', groupId: 'g', order: 0 },
      { id: 'a', kind: 'file', path: '/n/a.md', groupId: null, order: 1 },
      { id: 'g', kind: 'group', title: 'Work', groupId: null, order: 0 },
    ]
    expect(sortEntries(entries).map(e => e.id)).toEqual(['g', 'a', 'c'])
  })
})
