import { describe, expect, it } from 'vitest'
import { decayWeight, scoreEvents } from '../frecency'
import type { HistoryEvent } from '../../../shared/types'

const DAY = 86_400_000
const NOW = 1_800_000_000_000

const at = (daysAgo: number) => NOW - daysAgo * DAY

describe('decayWeight', () => {
  it('weights recent activity far above old activity', () => {
    expect(decayWeight(0)).toBe(100)
    expect(decayWeight(3 * DAY)).toBe(100)
    expect(decayWeight(10 * DAY)).toBe(70)
    expect(decayWeight(20 * DAY)).toBe(50)
    expect(decayWeight(60 * DAY)).toBe(30)
    expect(decayWeight(400 * DAY)).toBe(10)
  })
})

describe('scoreEvents', () => {
  it('ranks a recently used file above a heavily used old one', () => {
    const events: HistoryEvent[] = [
      // Opened twenty times, but a year ago.
      ...Array.from({ length: 20 }, (): HistoryEvent => ({ fileId: 'old', type: 'open', at: at(400) })),
      // Opened three times this week.
      ...Array.from({ length: 3 }, (): HistoryEvent => ({ fileId: 'fresh', type: 'open', at: at(2) })),
    ]

    const stats = scoreEvents(events, NOW)
    expect(stats.get('fresh')!.score).toBeGreaterThan(stats.get('old')!.score)
  })

  it('weights an edit above an open', () => {
    const stats = scoreEvents(
      [
        { fileId: 'read', type: 'open', at: at(1) },
        { fileId: 'written', type: 'edit', at: at(1) },
      ],
      NOW,
    )

    expect(stats.get('written')!.score).toBeGreaterThan(stats.get('read')!.score)
  })

  it('counts opens and edits separately and tracks the last edit', () => {
    const stats = scoreEvents(
      [
        { fileId: 'a', type: 'open', at: at(3) },
        { fileId: 'a', type: 'open', at: at(2) },
        { fileId: 'a', type: 'edit', at: at(1) },
      ],
      NOW,
    )

    const entry = stats.get('a')!
    expect(entry.openCount).toBe(2)
    expect(entry.editCount).toBe(1)
    expect(entry.lastEditedAt).toBe(at(1))
    expect(entry.lastOpenedAt).toBe(at(1))
  })

  it('leaves lastEditedAt null when a file was only ever read', () => {
    const stats = scoreEvents([{ fileId: 'a', type: 'open', at: at(1) }], NOW)
    expect(stats.get('a')!.lastEditedAt).toBeNull()
  })

  it('contributes no score for a rename', () => {
    const stats = scoreEvents([{ fileId: 'a', type: 'rename', at: at(1) }], NOW)
    expect(stats.get('a')!.score).toBe(0)
  })

  it('does not let a future timestamp inflate the score', () => {
    // Clock skew or a restored backup can produce events dated ahead of now;
    // a negative age must not be treated as more recent than "just now".
    const future = scoreEvents([{ fileId: 'a', type: 'open', at: NOW + 10 * DAY }], NOW)
    const present = scoreEvents([{ fileId: 'b', type: 'open', at: NOW }], NOW)
    expect(future.get('a')!.score).toBe(present.get('b')!.score)
  })
})
