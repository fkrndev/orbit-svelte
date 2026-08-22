/**
 * What the app remembers *about* a property, as opposed to what the file says.
 *
 * `propertyTypes.ts` infers a type from the value on every read, and that stays
 * the default: a file the app has never seen still opens with sensible widgets.
 * But inference has no answer for the things a person decides rather than
 * writes — that `owner` is a select and not free text, that `done` should be
 * green, that dates read better as `14/08/2026`. Those live here.
 *
 * Three rules keep this from becoming the hidden metadata the app set out to
 * avoid:
 *
 * 1. **The file is still the truth.** Nothing here changes what a value *is* —
 *    only which widget draws it and what colour the chip is. Delete this store
 *    and every property still reads and edits correctly, just plainer.
 * 2. **Keyed by property name, not by file.** `status` means the same thing in
 *    every note, so configuring it once configures it everywhere, and a renamed
 *    or moved file carries nothing to fix up.
 * 3. **Options are a memory, not a schema.** A value the file holds is always
 *    offered, whether or not it was ever configured — the picker never refuses
 *    to show you what is already written down.
 *
 * Lives in `shared/` because the store writes it and the webview mutates it
 * optimistically, and the two must agree byte for byte — see the note on
 * `rename.ts` in AGENTS.md.
 */

import type { PropertyEntry } from './frontmatter'
import { parseDateValue, toISODateString, detectPropertyType, type PropertyType } from './propertyTypes'

// ---- shape ----------------------------------------------------------------

/**
 * The chip palette.
 *
 * Names, not values: the CSS decides what `green` looks like in each theme, so
 * a note configured in light mode is still readable in dark. `default` is the
 * absence of a colour rather than a grey — it draws no chip background at all,
 * which is what most properties should look like.
 */
export type PropertyColor =
  | 'default'
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'

export const PROPERTY_COLORS: readonly PropertyColor[] = [
  'default',
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
]

/** The colours a new option may be given automatically — never `default`. */
const AUTO_COLORS: readonly PropertyColor[] = PROPERTY_COLORS.filter(color => color !== 'default')

export interface PropertyOption {
  name: string
  color: PropertyColor
}

/**
 * How a date reads.
 *
 * `iso` is the format the file always holds; the others are presentation only,
 * so switching between them never rewrites a byte.
 */
export type DateFormat = 'long' | 'iso' | 'dmy' | 'mdy' | 'relative'

export const DATE_FORMAT_OPTIONS: Array<{ value: DateFormat; label: string }> = [
  { value: 'long', label: 'Month day, year' },
  { value: 'dmy', label: 'Day/Month/Year' },
  { value: 'mdy', label: 'Month/Day/Year' },
  { value: 'iso', label: 'Year-Month-Day' },
  { value: 'relative', label: 'Relative' },
]

export interface PropertyConfig {
  /** Set only when the user overruled inference; absent means "keep guessing". */
  type?: PropertyType
  /** Known choices for a status or tags property, in the order they display. */
  options?: PropertyOption[]
  dateFormat?: DateFormat
  /** Folded into the "N more" row rather than shown inline. Never deletes anything. */
  hidden?: boolean
}

export interface PropertySchema {
  version: 1
  /** Config by normalised property name. Presence here also means "known property". */
  props: Record<string, PropertyConfig>
  /** Preferred display order, normalised. Names absent from it follow file order. */
  order: string[]
}

export const EMPTY_PROPERTY_SCHEMA: PropertySchema = { version: 1, props: {}, order: [] }

/**
 * Properties offered to a file that has none of them.
 *
 * A prompt, not a schema: nothing reaches the file until a value is picked, and
 * anything the user has configured before joins this list automatically.
 */
export const SUGGESTED_PROPERTIES: Array<{ key: string; type: PropertyType }> = [
  { key: 'status', type: 'status' },
  { key: 'tags', type: 'tags' },
  { key: 'date', type: 'date' },
  { key: 'url', type: 'url' },
]

/** The vocabulary a fresh `status` property starts with, already coloured. */
export const DEFAULT_STATUS_OPTIONS: PropertyOption[] = [
  { name: 'draft', color: 'gray' },
  { name: 'active', color: 'blue' },
  { name: 'blocked', color: 'red' },
  { name: 'done', color: 'green' },
  { name: 'archived', color: 'brown' },
]

/** Types whose values come from a remembered list of options. */
export function hasOptions(type: PropertyType): boolean {
  return type === 'status' || type === 'tags'
}

// ---- reading --------------------------------------------------------------

/** `Due Date`, `due_date`, and `due date` are one property, so they share config. */
export function propertyId(key: string): string {
  return key.trim().toLowerCase()
}

const NO_CONFIG: PropertyConfig = {}

export function configFor(schema: PropertySchema, key: string): PropertyConfig {
  return schema.props[propertyId(key)] ?? NO_CONFIG
}

/** The stored type when the user set one, otherwise whatever the value looks like. */
export function resolveType(schema: PropertySchema, entry: PropertyEntry): PropertyType {
  // A list in the file is always tags: no override can make `- a\n- b` a number,
  // and pretending otherwise would show an editor that cannot write it back.
  if (entry.shape === 'list') return 'tags'
  return configFor(schema, entry.key).type ?? detectPropertyType(entry)
}

/** Every property the user has touched before, for the "add" picker. */
export function knownPropertyNames(schema: PropertySchema): string[] {
  return Object.keys(schema.props)
}

/**
 * File order, overruled by the user's order where they have one.
 *
 * Reordering must never drop a property: anything not in `order` keeps its
 * position relative to the file, appended after the arranged ones. A stale
 * entry in `order` for a property this file does not have is simply skipped.
 */
export function orderEntries<T extends { key: string }>(
  schema: PropertySchema,
  entries: T[],
): T[] {
  if (schema.order.length === 0) return entries
  const rank = new Map(schema.order.map((name, index) => [name, index]))
  const arranged: Array<{ entry: T; at: number }> = []
  const rest: T[] = []
  for (const entry of entries) {
    const at = rank.get(propertyId(entry.key))
    if (at === undefined) rest.push(entry)
    else arranged.push({ entry, at })
  }
  arranged.sort((a, b) => a.at - b.at)
  return [...arranged.map(item => item.entry), ...rest]
}

/**
 * A stable colour for a value nobody configured.
 *
 * Hand-written frontmatter should not all render grey — but the colour has to
 * be the same on every open, so it is derived from the name rather than picked.
 */
function inferredColor(name: string): PropertyColor {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return AUTO_COLORS[hash % AUTO_COLORS.length]!
}

export function colorOf(config: PropertyConfig, name: string): PropertyColor {
  const found = config.options?.find(option => option.name === name)
  return found ? found.color : inferredColor(name)
}

/**
 * What the picker offers: the configured options, plus anything the file
 * already holds that was never configured.
 *
 * The second half is the point — a value typed by hand into the YAML must show
 * up as a choice rather than as an error, or the picker becomes a thing you
 * have to work around.
 */
export function optionsFor(config: PropertyConfig, used: string[] = []): PropertyOption[] {
  const options = [...(config.options ?? [])]
  const seen = new Set(options.map(option => option.name))
  for (const value of used) {
    if (value === '' || seen.has(value)) continue
    seen.add(value)
    options.push({ name: value, color: inferredColor(value) })
  }
  return options
}

/** The least-used colour, so a run of new options does not come out one shade. */
export function nextColor(config: PropertyConfig): PropertyColor {
  const taken = new Map<PropertyColor, number>()
  for (const option of config.options ?? []) {
    taken.set(option.color, (taken.get(option.color) ?? 0) + 1)
  }
  let best = AUTO_COLORS[0]!
  let bestCount = Number.POSITIVE_INFINITY
  for (const color of AUTO_COLORS) {
    const count = taken.get(color) ?? 0
    if (count < bestCount) {
      best = color
      bestCount = count
    }
  }
  return best
}

// ---- writing --------------------------------------------------------------

function withProps(schema: PropertySchema, props: Record<string, PropertyConfig>): PropertySchema {
  return { ...schema, props }
}

/**
 * Merge a patch into one property's config.
 *
 * An explicit `undefined` in the patch clears the field rather than merging as
 * one — that is how "go back to inferring the type" is expressed.
 */
export function applyConfig(
  schema: PropertySchema,
  key: string,
  patch: Partial<PropertyConfig>,
): PropertySchema {
  const id = propertyId(key)
  if (id === '') return schema
  const next: PropertyConfig = { ...(schema.props[id] ?? {}), ...patch }
  for (const field of Object.keys(patch) as Array<keyof PropertyConfig>) {
    if (patch[field] === undefined) delete next[field]
  }
  return withProps(schema, { ...schema.props, [id]: next })
}

/** Forget a property entirely — config and its place in the order. */
export function forgetProperty(schema: PropertySchema, key: string): PropertySchema {
  const id = propertyId(key)
  if (!(id in schema.props) && !schema.order.includes(id)) return schema
  const props = { ...schema.props }
  delete props[id]
  return { ...schema, props, order: schema.order.filter(name => name !== id) }
}

/**
 * Carry config across a rename.
 *
 * Without this, renaming `status` to `stage` would silently strip its options
 * and colours, which looks exactly like data loss even though the file is fine.
 */
export function renameProperty(schema: PropertySchema, from: string, to: string): PropertySchema {
  const fromId = propertyId(from)
  const toId = propertyId(to)
  if (fromId === '' || toId === '' || fromId === toId) return schema

  const config = schema.props[fromId]
  const props = { ...schema.props }
  delete props[fromId]
  if (config) props[toId] = { ...(props[toId] ?? {}), ...config }

  const order = schema.order.map(name => (name === fromId ? toId : name))
  return { ...schema, props, order: order.filter((name, at) => order.indexOf(name) === at) }
}

/** Record a display order, dropping duplicates and empty names. */
export function setOrder(schema: PropertySchema, keys: string[]): PropertySchema {
  const seen = new Set<string>()
  const order: string[] = []
  for (const key of keys) {
    const id = propertyId(key)
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    order.push(id)
  }
  return { ...schema, order }
}

/** Add an option if it is new, giving it a colour that is not already crowded. */
export function addOption(
  schema: PropertySchema,
  key: string,
  name: string,
  color?: PropertyColor,
): PropertySchema {
  const trimmed = name.trim()
  if (trimmed === '') return schema
  const config = configFor(schema, key)
  if (config.options?.some(option => option.name === trimmed)) return schema
  const option: PropertyOption = { name: trimmed, color: color ?? nextColor(config) }
  return applyConfig(schema, key, { options: [...(config.options ?? []), option] })
}

export function setOptionColor(
  schema: PropertySchema,
  key: string,
  name: string,
  color: PropertyColor,
): PropertySchema {
  const config = configFor(schema, key)
  const options = optionsFor(config, [name]).map(option =>
    option.name === name ? { ...option, color } : option,
  )
  return applyConfig(schema, key, { options })
}

export function removeOption(schema: PropertySchema, key: string, name: string): PropertySchema {
  const config = configFor(schema, key)
  if (!config.options) return schema
  return applyConfig(schema, key, {
    options: config.options.filter(option => option.name !== name),
  })
}

/**
 * Rename an option in the config.
 *
 * The caller is responsible for rewriting the value in any open file — this
 * function only moves the memory, and returns the schema unchanged when the new
 * name is empty or already taken.
 */
export function renameOption(
  schema: PropertySchema,
  key: string,
  from: string,
  to: string,
): PropertySchema {
  const trimmed = to.trim()
  const config = configFor(schema, key)
  if (trimmed === '' || trimmed === from) return schema
  const options = optionsFor(config, [from])
  if (options.some(option => option.name === trimmed)) return schema
  return applyConfig(schema, key, {
    options: options.map(option => (option.name === from ? { ...option, name: trimmed } : option)),
  })
}

// ---- changing a property's type -------------------------------------------

const TRUE_WORDS = new Set(['true', 'yes', 'on', '1'])
const NUMERIC = /-?\d+(?:[.,]\d+)?/

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)
}

/**
 * Rewrite a value so it still makes sense under a different type.
 *
 * Changing a type is a promise about how the value will be *edited*, so the
 * value has to arrive in the new editor already legible: a date picker cannot
 * open on "asap", and a tag row cannot show "a, b" as one chip.
 *
 * Where a conversion cannot preserve the value it yields an empty one rather
 * than a wrong one — an empty property is obviously unfinished, whereas
 * `2026-01-01` invented out of "next week" is a lie the file would then keep.
 */
export function convertValue(entry: PropertyEntry, to: PropertyType): string | string[] {
  const text = (entry.shape === 'list' ? entry.items.join(', ') : entry.value).trim()

  if (to === 'tags') return entry.shape === 'list' ? entry.items : splitList(text)
  if (text === '') return ''

  switch (to) {
    case 'boolean':
      return TRUE_WORDS.has(text.toLowerCase()) ? 'true' : 'false'
    case 'number': {
      // A number hiding inside text is still the number the user meant —
      // "3 days" becomes 3, where a strict parse would throw the value away.
      const found = NUMERIC.exec(text)
      return found ? found[0].replace(',', '.') : ''
    }
    case 'date': {
      const parsed = parseDateValue(text)
      return parsed ? toISODateString(parsed) : ''
    }
    default:
      return text
  }
}

// ---- dates ----------------------------------------------------------------

const MS_PER_DAY = 86_400_000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Whole days between two dates, counted by calendar day rather than by elapsed
 * hours — "tomorrow" must not become "today" because it is only 23 hours away.
 */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / MS_PER_DAY)
}

function relativeDay(day: Date, now: Date): string {
  const delta = daysBetween(now, day)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1 && delta <= 30) return `In ${delta} days`
  if (delta < -1 && delta >= -30) return `${-delta} days ago`
  return longDate(day)
}

function longDate(day: Date): string {
  return day.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * How a date reads in the panel.
 *
 * Anything that is not a parsable day is handed back untouched — a value the
 * app cannot read is still the user's text, and reformatting it would be a lie
 * about what the file says.
 */
export function formatDate(raw: string, format: DateFormat = 'long', now = new Date()): string {
  const day = parseDateValue(raw)
  if (!day) return raw

  switch (format) {
    case 'iso':
      return toISODateString(day)
    case 'dmy':
      return `${pad(day.getDate())}/${pad(day.getMonth() + 1)}/${day.getFullYear()}`
    case 'mdy':
      return `${pad(day.getMonth() + 1)}/${pad(day.getDate())}/${day.getFullYear()}`
    case 'relative':
      return relativeDay(day, now)
    default:
      return longDate(day)
  }
}
