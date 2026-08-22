const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Compact, calm relative time. Long enough ago and we just show the date. */
export function relativeTime(at: number, now = Date.now()): string {
  const delta = now - at
  if (delta < MINUTE) return 'just now'
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Stable day bucket label used to group the Recents timeline. */
export function dayLabel(at: number, now = Date.now()): string {
  const date = new Date(at)
  const today = new Date(now)
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (isSameDay(date, today)) return 'Today'

  const yesterday = new Date(now - DAY)
  if (isSameDay(date, yesterday)) return 'Yesterday'

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

/**
 * Words in a markdown document.
 *
 * A token counts only if it contains a letter or a digit, which is what keeps
 * the markup itself out of the total — `##`, `-`, `|`, and `>` are punctuation
 * standing alone, while `**bold**` is still one word. Deliberately crude: the
 * number is a sense of scale, and one a reader can predict beats one that is
 * technically defensible but surprising.
 */
export function countWords(body: string): number {
  let count = 0
  for (const token of body.split(/\s+/)) {
    if (/[\p{L}\p{N}]/u.test(token)) count += 1
  }
  return count
}

/**
 * Characters in a document, counted the way a person counts them.
 *
 * Code points rather than UTF-16 units, so an emoji is one character and not
 * two. The surrounding whitespace goes first: a file that ends in a newline did
 * not gain a character the moment it was saved.
 */
export function countCharacters(body: string): number {
  return Array.from(body.trim()).length
}

/**
 * Paragraphs in a markdown document.
 *
 * A paragraph is what markdown says it is — a run of lines with a blank line on
 * either side — so a wrapped sentence counts once and a bullet list counts once.
 * Blocks holding nothing but punctuation, `---` most of all, are separators
 * rather than prose and are left out.
 */
export function countParagraphs(body: string): number {
  let count = 0
  for (const block of body.split(/\n[^\S\n]*\n/)) {
    if (/[\p{L}\p{N}]/u.test(block)) count += 1
  }
  return count
}

/** The pace of quiet reading, and the roundest number in the literature. */
const WORDS_PER_MINUTE = 200

/**
 * How long the document takes to read, rounded to something worth saying.
 *
 * Never "0m": a document with any words in it takes a moment, and a zero there
 * reads as a failure to measure rather than as a short file.
 */
export function readingTime(words: number): string {
  if (words <= 0) return '—'
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

const UNITS = ['B', 'KB', 'MB', 'GB']

/** File size at the precision a person reads: never more than three digits. */
export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${value.toFixed(digits)} ${UNITS[unit]}`
}

/** Absolute date for the Info rows, where "3d ago" hides more than it tells. */
export function absoluteDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
