import { describe, expect, it } from 'vitest'
import {
  canGroupByDay,
  compareRecents,
  filterRecents,
  foldersOf,
  groupByDay,
  previewLines,
  previewNeedsExcerpt,
  type Rankable,
} from '../recents'

const DAY = 86_400_000
const NOW = 1_800_000_000_000

interface Row extends Rankable {
  name: string
}

const rows: Row[] = [
  { name: 'old-favourite', lastOpenedAt: NOW - 30 * DAY, openCount: 40, score: 400 },
  { name: 'today', lastOpenedAt: NOW - 1000, openCount: 2, score: 200 },
  { name: 'yesterday', lastOpenedAt: NOW - DAY, openCount: 9, score: 900 },
]

const order = (sort: Parameters<typeof compareRecents>[0]) =>
  [...rows].sort(compareRecents(sort)).map(row => row.name)

describe('compareRecents', () => {
  it('orders by recency', () => {
    expect(order('recent')).toEqual(['today', 'yesterday', 'old-favourite'])
  })

  it('orders by open count', () => {
    expect(order('opens')).toEqual(['old-favourite', 'yesterday', 'today'])
  })

  it('orders by frecency', () => {
    expect(order('frecency')).toEqual(['yesterday', 'old-favourite', 'today'])
  })

  it('breaks ties by recency, so the list does not reshuffle between reads', () => {
    const tied: Row[] = [
      { name: 'older', lastOpenedAt: NOW - DAY, openCount: 3, score: 10 },
      { name: 'newer', lastOpenedAt: NOW, openCount: 3, score: 10 },
    ]
    expect([...tied].sort(compareRecents('opens')).map(r => r.name)).toEqual(['newer', 'older'])
    expect([...tied].reverse().sort(compareRecents('opens')).map(r => r.name)).toEqual([
      'newer',
      'older',
    ])
  })

  it('falls back to recency for an unknown sort from an older settings file', () => {
    expect([...rows].sort(compareRecents('nonsense' as never)).map(r => r.name)).toEqual(
      order('recent'),
    )
  })
})

describe('canGroupByDay', () => {
  it('only applies to the time-ordered list', () => {
    // Grouping the most-opened list would print a day heading, then an older
    // day, then the first one again — headings describing an order the list is
    // not in.
    expect(canGroupByDay('recent')).toBe(true)
    expect(canGroupByDay('opens')).toBe(false)
    expect(canGroupByDay('frecency')).toBe(false)
  })
})

describe('groupByDay', () => {
  const label = (at: number) => (at > NOW - DAY ? 'Today' : 'Yesterday')
  const items = [
    { lastOpenedAt: NOW - 100 },
    { lastOpenedAt: NOW - 200 },
    { lastOpenedAt: NOW - 2 * DAY },
  ]

  it('buckets consecutive runs', () => {
    const groups = groupByDay(items, label)
    expect(groups.map(group => [group.label, group.items.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
    ])
  })

  it('returns one unlabelled run when grouping is off', () => {
    const groups = groupByDay(items, label, false)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.label).toBeNull()
  })

  it('returns nothing for an empty list, grouped or not', () => {
    expect(groupByDay([], label)).toEqual([])
    expect(groupByDay([], label, false)).toEqual([])
  })

  it('does not merge a run that breaks and returns', () => {
    // Out-of-order input means the caller sorted wrong; showing that plainly
    // beats hiding it by stitching the runs back together.
    const jumbled = [{ lastOpenedAt: NOW - 100 }, { lastOpenedAt: NOW - 2 * DAY }, { lastOpenedAt: NOW - 50 }]
    expect(groupByDay(jumbled, label).map(group => group.label)).toEqual([
      'Today',
      'Yesterday',
      'Today',
    ])
  })
})

describe('preview style', () => {
  it('draws no excerpt at all in the compact style', () => {
    expect(previewLines('small')).toBe(0)
    expect(previewNeedsExcerpt('small')).toBe(false)
  })

  it('grows the row with the style', () => {
    expect(previewLines('medium')).toBeGreaterThan(previewLines('small'))
    expect(previewLines('large')).toBeGreaterThan(previewLines('medium'))
  })

  it('asks for the excerpt exactly when it has a line to draw it in', () => {
    // The fetch costs one file read per row, so the two must not drift: asking
    // without drawing wastes the reads, drawing without asking prints nothing.
    for (const preview of ['small', 'medium', 'large'] as const) {
      expect(previewNeedsExcerpt(preview)).toBe(previewLines(preview) > 0)
    }
  })
})

describe('foldersOf', () => {
  const file = (path: string, score: number, lastOpenedAt = 0) => ({ path, score, lastOpenedAt })

  it('rolls files up into the folders they live in', () => {
    expect(
      foldersOf([file('/a/one.md', 1), file('/a/two.md', 1), file('/b/three.md', 1)], 10),
    ).toEqual([
      { path: '/a', noteCount: 2, lastOpenedAt: 0 },
      { path: '/b', noteCount: 1, lastOpenedAt: 0 },
    ])
  })

  it('sums rather than averages, so a busy folder outranks a hot single file', () => {
    const ranked = foldersOf([file('/a/one.md', 3), file('/a/two.md', 3), file('/b/hot.md', 5)], 10)
    expect(ranked[0]?.path).toBe('/a')
  })

  it('breaks a tie on recency', () => {
    const ranked = foldersOf([file('/old/x.md', 1, 100), file('/new/y.md', 1, 200)], 10)
    expect(ranked.map(f => f.path)).toEqual(['/new', '/old'])
  })

  it('carries the newest open of anything inside', () => {
    expect(foldersOf([file('/a/x.md', 1, 100), file('/a/y.md', 1, 300)], 10)[0]?.lastOpenedAt).toBe(300)
  })

  it('honours the limit', () => {
    expect(foldersOf([file('/a/x.md', 3), file('/b/y.md', 2), file('/c/z.md', 1)], 2)).toHaveLength(2)
  })

  it('handles a file at the filesystem root', () => {
    expect(foldersOf([file('/x.md', 1)], 10)[0]?.path).toBe('/')
  })
})

describe('filterRecents', () => {
  const rows = [
    { name: 'plan-home.md', path: '/vault/docs-id/plan-home.md' },
    { name: 'ARCHITECTURE.md', path: '/vault/docs-id/ARCHITECTURE.md' },
    { name: 'invoice.md', path: '/vault/billing/invoice.md' },
  ]

  it('leaves the list alone for an empty query', () => {
    expect(filterRecents(rows, '')).toBe(rows)
    expect(filterRecents(rows, '   ')).toBe(rows)
  })

  it('matches on the file name', () => {
    expect(filterRecents(rows, 'invoice').map(row => row.name)).toEqual(['invoice.md'])
  })

  it('matches an abbreviation, the way the palette does', () => {
    expect(filterRecents(rows, 'arch').map(row => row.name)).toEqual(['ARCHITECTURE.md'])
  })

  it('ignores case', () => {
    expect(filterRecents(rows, 'PLAN').map(row => row.name)).toEqual(['plan-home.md'])
  })

  it('falls back to the folder, so a query naming a place still finds its files', () => {
    expect(filterRecents(rows, 'billing').map(row => row.name)).toEqual(['invoice.md'])
  })

  it('keeps the order it was given rather than re-ranking by match quality', () => {
    // The list is already in the order the sort menu asked for. Re-sorting by
    // how well a name matched would quietly override that choice.
    const matches = filterRecents(rows, 'e')
    expect(matches.map(row => row.name)).toEqual(rows.filter(r => matches.includes(r)).map(r => r.name))
  })

  it('is empty when nothing matches', () => {
    expect(filterRecents(rows, 'zzz')).toEqual([])
  })
})
