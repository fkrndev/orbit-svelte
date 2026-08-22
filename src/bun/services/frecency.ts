import type { FileId, HistoryEvent, HistoryEventType } from '../../shared/types'

/**
 * Frecency: frequency weighted by recency, in the spirit of the Mozilla
 * awesomebar. A file opened twenty times last year should not outrank one
 * opened three times this week.
 *
 * Pure and fs-free so the ranking can be tested with synthetic event logs.
 */

const DAY_MS = 86_400_000

/** Creating or editing a file says more about intent than merely opening it. */
const TYPE_WEIGHT: Record<HistoryEventType, number> = {
  open: 1,
  edit: 2.5,
  create: 3,
  rename: 0,
}

const DECAY_BUCKETS: Array<{ maxAgeDays: number; weight: number }> = [
  { maxAgeDays: 4, weight: 100 },
  { maxAgeDays: 14, weight: 70 },
  { maxAgeDays: 31, weight: 50 },
  { maxAgeDays: 90, weight: 30 },
]

const TAIL_WEIGHT = 10

export function decayWeight(ageMs: number): number {
  const ageDays = ageMs / DAY_MS
  for (const bucket of DECAY_BUCKETS) {
    if (ageDays <= bucket.maxAgeDays) return bucket.weight
  }
  return TAIL_WEIGHT
}

export interface FrecencyStats {
  score: number
  lastOpenedAt: number
  lastEditedAt: number | null
  openCount: number
  editCount: number
}

export function scoreEvents(events: HistoryEvent[], now: number): Map<FileId, FrecencyStats> {
  const stats = new Map<FileId, FrecencyStats>()

  for (const event of events) {
    const weight = TYPE_WEIGHT[event.type]
    const entry = stats.get(event.fileId) ?? {
      score: 0,
      lastOpenedAt: 0,
      lastEditedAt: null,
      openCount: 0,
      editCount: 0,
    }

    if (weight > 0) {
      // Future-dated events (clock skew, restored backups) would otherwise get
      // a negative age and an inflated bucket; clamp them to "just now".
      entry.score += weight * decayWeight(Math.max(0, now - event.at))
    }

    if (event.at > entry.lastOpenedAt) entry.lastOpenedAt = event.at
    if (event.type === 'open') entry.openCount += 1
    if (event.type === 'edit') {
      entry.editCount += 1
      if (entry.lastEditedAt === null || event.at > entry.lastEditedAt) {
        entry.lastEditedAt = event.at
      }
    }

    stats.set(event.fileId, entry)
  }

  return stats
}
