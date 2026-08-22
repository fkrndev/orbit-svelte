import type { PropertyEntry } from './frontmatter'

/**
 * What kind of thing a frontmatter value is, judged from the value itself.
 *
 * This is the **default**, not the last word. Inference is what lets a file the
 * app has never seen open with sensible editors and no setup, and it is right
 * often enough that most properties never need anything else.
 *
 * It is also occasionally wrong — `code: 007` is a string, `count: 3` might be
 * a label — and it used to be unappealable, on the reasoning that a sidecar map
 * of "what `owner` really means" would put us back to metadata only this app
 * can read. What that reasoning missed is that being unable to *correct* the
 * guess is itself unreadable: the user is left editing YAML by hand to change a
 * widget. `propertySchema.ts` now holds an override, kept deliberately small
 * and deliberately optional — delete it and every value here still reads,
 * edits, and saves exactly as before, just with a plainer control.
 *
 * `resolveType` in that module is what callers should ask; this function is the
 * fallback it consults.
 */
export type PropertyType = 'text' | 'number' | 'date' | 'boolean' | 'status' | 'url' | 'tags'

/** Key names that give the type away regardless of the value. */
const KEY_HINTS: Array<[PropertyType, string[]]> = [
  ['status', ['status', 'state']],
  ['date', ['date', 'deadline', 'due', 'scheduled', 'start', 'end', 'published', 'updated']],
  ['tags', ['tags', 'keywords', 'categories', 'labels', 'aliases']],
  ['url', ['url', 'link', 'href', 'website', 'source']],
]

const BOOLEANS = new Set(['true', 'false', 'yes', 'no'])

/** Values that read as a workflow state even under a key that does not say so. */
const STATUS_VALUES = new Set([
  'draft', 'active', 'done', 'todo', 'paused', 'archived', 'dropped', 'open', 'closed',
  'not started', 'in progress', 'blocked', 'cancelled', 'pending', 'published', 'idea',
])

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]|$)/

function keyHint(key: string): PropertyType | null {
  const lower = key.toLowerCase()
  for (const [type, needles] of KEY_HINTS) {
    if (needles.some(needle => lower === needle || lower.includes(needle))) return type
  }
  return null
}

export function detectPropertyType(entry: PropertyEntry): PropertyType {
  if (entry.shape === 'list') return 'tags'

  const value = entry.value.trim()
  const hint = keyHint(entry.key)

  // The value wins over the key when it is unambiguous — a `due` holding
  // "asap" is text, whatever the name promised.
  if (value !== '') {
    if (BOOLEANS.has(value.toLowerCase())) return 'boolean'
    if (/^https?:\/\/\S+$/i.test(value)) return 'url'
    if (ISO_DATE.test(value)) return 'date'
    if (hint === 'date' || hint === 'url') return 'text'
    if (value !== '' && Number.isFinite(Number(value)) && !/^0\d/.test(value)) return 'number'
    if (STATUS_VALUES.has(value.toLowerCase())) return 'status'
  }

  return hint ?? 'text'
}

/**
 * The types a property can be, in the order they are offered.
 *
 * The labels the UI shows live in `propertyChrome.tsx` — this list is the set
 * itself, which the picker and the type menu both iterate.
 */
export const PROPERTY_TYPE_OPTIONS: Array<{ value: PropertyType }> = [
  { value: 'text' },
  { value: 'number' },
  { value: 'date' },
  { value: 'boolean' },
  { value: 'status' },
  { value: 'url' },
  { value: 'tags' },
]

/**
 * Read a frontmatter date as a calendar day.
 *
 * Anchored at local noon on purpose: `new Date('2026-08-14')` is parsed as UTC
 * midnight, which renders as the 13th for anyone west of Greenwich. The day the
 * file names is the day the picker must highlight, whatever the timezone.
 */
export function parseDateValue(raw: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim())
  if (!match) return undefined
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** The wire format: what a hand-written frontmatter date looks like. */
export function toISODateString(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

