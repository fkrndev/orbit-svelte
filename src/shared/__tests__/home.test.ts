import { describe, expect, it } from 'vitest'
import type { Dashboard, DashboardItem, FileMeta } from '../types'
import { continueList, lastWriteAt, parseRefQuery } from '../home'

function item(
  id: string,
  over: { score?: number; lastEditedAt?: number | null; lastOpenedAt?: number } = {},
): DashboardItem {
  const meta = {
    id,
    path: `/vault/${id}.md`,
    rootId: 'r1',
    labels: [],
    tags: [],
    createdAt: 0,
  } as unknown as FileMeta
  return {
    meta,
    score: over.score ?? 0,
    lastOpenedAt: over.lastOpenedAt ?? 0,
    lastEditedAt: over.lastEditedAt ?? null,
    openCount: 0,
    editCount: 0,
  }
}

function dashboard(over: Partial<Dashboard>): Dashboard {
  return {
    pinned: [],
    frequent: [],
    recentlyEdited: [],
    rootCounts: [],
    ...over,
  }
}

describe('continueList', () => {
  it('merges the two ranked lists into one', () => {
    const data = dashboard({
      frequent: [item('a', { score: 90 })],
      recentlyEdited: [item('b', { score: 40, lastEditedAt: 10 })],
    })
    expect(continueList(data, 3).map(entry => entry.meta.id)).toEqual(['a', 'b'])
  })

  it('shows a file that is in both lists once', () => {
    // The backend answers two questions and the same file can answer both — the
    // one thing the user must never see is the same card twice.
    const both = item('a', { score: 90, lastEditedAt: 10 })
    const data = dashboard({ frequent: [both], recentlyEdited: [both] })
    expect(continueList(data, 3)).toHaveLength(1)
  })

  it('keeps the richer copy of a file that appears in both lists', () => {
    const data = dashboard({
      frequent: [item('a', { score: 90 })],
      recentlyEdited: [item('a', { score: 90, lastEditedAt: 500 })],
    })
    expect(continueList(data, 3)[0]?.lastEditedAt).toBe(500)
  })

  it('breaks a score tie with the more recently written file', () => {
    const data = dashboard({
      frequent: [item('old', { score: 50, lastEditedAt: 100 }), item('new', { score: 50, lastEditedAt: 900 })],
    })
    expect(continueList(data, 2).map(entry => entry.meta.id)).toEqual(['new', 'old'])
  })

  it('falls back to when a file was last opened when nothing was written', () => {
    const data = dashboard({
      frequent: [item('a', { score: 50, lastOpenedAt: 100 }), item('b', { score: 50, lastOpenedAt: 900 })],
    })
    expect(continueList(data, 2).map(entry => entry.meta.id)).toEqual(['b', 'a'])
  })

  it('never returns more than it was asked for', () => {
    const data = dashboard({
      frequent: [item('a', { score: 3 }), item('b', { score: 2 }), item('c', { score: 1 })],
    })
    expect(continueList(data, 2)).toHaveLength(2)
  })

  it('is empty for an empty dashboard', () => {
    expect(continueList(dashboard({}), 3)).toEqual([])
  })
})

describe('lastWriteAt', () => {
  it('is the most recent edit across every list', () => {
    const data = dashboard({
      pinned: [item('a', { lastEditedAt: 700 })],
      recentlyEdited: [item('b', { lastEditedAt: 900 })],
    })
    expect(lastWriteAt(data)).toBe(900)
  })

  it('is null when nothing has ever been written', () => {
    expect(lastWriteAt(dashboard({ frequent: [item('a')] }))).toBeNull()
  })
})

describe('parseRefQuery', () => {
  it('reads a tag out of a #-prefixed query', () => {
    expect(parseRefQuery('#draft')).toEqual({ kind: 'tag', label: 'draft' })
  })

  it('reads a mention out of an @-prefixed one', () => {
    expect(parseRefQuery('@budi')).toEqual({ kind: 'mention', label: 'budi' })
  })

  it('ignores the space a chip click cannot produce but a person can', () => {
    expect(parseRefQuery('  # draft ')).toEqual({ kind: 'tag', label: 'draft' })
  })

  it('is not a ref search until there is a ref', () => {
    expect(parseRefQuery('#')).toBeNull()
    expect(parseRefQuery('# ')).toBeNull()
    expect(parseRefQuery('@')).toBeNull()
  })

  it('leaves an ordinary name search alone', () => {
    expect(parseRefQuery('plan')).toBeNull()
    expect(parseRefQuery('docs/plan#2')).toBeNull()
    // A sigil has to lead. Otherwise every email address typed into Quick Open
    // would stop being a filename search halfway through.
    expect(parseRefQuery('mail budi@example.com')).toBeNull()
  })
})
