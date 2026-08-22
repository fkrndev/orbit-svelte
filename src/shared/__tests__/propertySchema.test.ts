import { describe, expect, it } from 'vitest'
import { readProperty } from '../frontmatter'
import {
  EMPTY_PROPERTY_SCHEMA,
  addOption,
  applyConfig,
  colorOf,
  configFor,
  convertValue,
  forgetProperty,
  formatDate,
  nextColor,
  optionsFor,
  orderEntries,
  removeOption,
  renameOption,
  renameProperty,
  resolveType,
  setOptionColor,
  setOrder,
  type PropertySchema,
} from '../propertySchema'

const entryOf = (line: string) => {
  const key = line.split(':')[0]!.trim()
  const entry = readProperty(`---\n${line}\n---\n`, key)
  if (!entry) throw new Error(`no property parsed from ${line}`)
  return entry
}

const schema = (): PropertySchema => structuredClone(EMPTY_PROPERTY_SCHEMA)

describe('resolveType', () => {
  it('infers when nothing was configured', () => {
    expect(resolveType(schema(), entryOf('count: 42'))).toBe('number')
  })

  it('prefers the configured type over what the value looks like', () => {
    // "42" reads as a number, but the user said this column holds codes.
    const configured = applyConfig(schema(), 'count', { type: 'text' })
    expect(resolveType(configured, entryOf('count: 42'))).toBe('text')
  })

  it('matches config regardless of how the key is capitalised', () => {
    const configured = applyConfig(schema(), 'Due Date', { type: 'text' })
    expect(resolveType(configured, entryOf('due date: 2026-01-05'))).toBe('text')
  })

  it('refuses to call a YAML list anything but tags', () => {
    // No editor for `text` can write a list back, so an override here would
    // offer a control that silently drops the other items.
    const configured = applyConfig(schema(), 'aliases', { type: 'text' })
    expect(resolveType(configured, entryOf('aliases: [one, two]'))).toBe('tags')
  })
})

describe('applyConfig', () => {
  it('merges rather than replaces', () => {
    let next = applyConfig(schema(), 'status', { type: 'status' })
    next = applyConfig(next, 'status', { hidden: true })
    expect(configFor(next, 'status')).toEqual({ type: 'status', hidden: true })
  })

  it('clears a field when the patch sets it to undefined', () => {
    let next = applyConfig(schema(), 'status', { type: 'text', hidden: true })
    next = applyConfig(next, 'status', { type: undefined })
    expect(configFor(next, 'status')).toEqual({ hidden: true })
  })

  it('ignores a blank name rather than storing one', () => {
    expect(applyConfig(schema(), '   ', { type: 'text' })).toEqual(EMPTY_PROPERTY_SCHEMA)
  })

  it('does not mutate the schema it was given', () => {
    const before = schema()
    applyConfig(before, 'status', { type: 'status' })
    expect(before.props).toEqual({})
  })
})

describe('forgetProperty', () => {
  it('drops the config and its place in the order', () => {
    let next = applyConfig(schema(), 'status', { type: 'status' })
    next = setOrder(next, ['status', 'url'])
    next = forgetProperty(next, 'Status')
    expect(next.props).toEqual({})
    expect(next.order).toEqual(['url'])
  })

  it('is a no-op for a property it never knew', () => {
    const before = setOrder(schema(), ['url'])
    expect(forgetProperty(before, 'status')).toBe(before)
  })
})

describe('renameProperty', () => {
  it('carries the config and the position to the new name', () => {
    let next = applyConfig(schema(), 'status', { type: 'status', dateFormat: 'iso' })
    next = setOrder(next, ['url', 'status'])
    next = renameProperty(next, 'status', 'Stage')
    expect(configFor(next, 'stage')).toEqual({ type: 'status', dateFormat: 'iso' })
    expect(configFor(next, 'status')).toEqual({})
    expect(next.order).toEqual(['url', 'stage'])
  })

  it('does not leave the target listed twice in the order', () => {
    let next = setOrder(schema(), ['status', 'stage'])
    next = renameProperty(next, 'status', 'stage')
    expect(next.order).toEqual(['stage'])
  })

  it('ignores a rename to the same name or to nothing', () => {
    const before = applyConfig(schema(), 'status', { type: 'status' })
    expect(renameProperty(before, 'status', 'STATUS')).toBe(before)
    expect(renameProperty(before, 'status', '  ')).toBe(before)
  })
})

describe('orderEntries', () => {
  const entries = [{ key: 'title' }, { key: 'status' }, { key: 'url' }]

  it('keeps file order when the user has arranged nothing', () => {
    expect(orderEntries(schema(), entries)).toEqual(entries)
  })

  it('puts arranged properties first, in their arranged order', () => {
    const arranged = setOrder(schema(), ['url', 'status'])
    expect(orderEntries(arranged, entries).map(entry => entry.key)).toEqual([
      'url',
      'status',
      'title',
    ])
  })

  it('never drops a property missing from the order', () => {
    const arranged = setOrder(schema(), ['url'])
    expect(orderEntries(arranged, entries)).toHaveLength(3)
  })

  it('skips a remembered property this file does not have', () => {
    const arranged = setOrder(schema(), ['owner', 'url'])
    expect(orderEntries(arranged, entries).map(entry => entry.key)).toEqual([
      'url',
      'title',
      'status',
    ])
  })
})

describe('options', () => {
  it('offers a value the file holds even though it was never configured', () => {
    const config = configFor(addOption(schema(), 'status', 'done'), 'status')
    expect(optionsFor(config, ['done', 'shipped']).map(option => option.name)).toEqual([
      'done',
      'shipped',
    ])
  })

  it('gives an unconfigured value the same colour on every read', () => {
    expect(colorOf({}, 'shipped')).toBe(colorOf({}, 'shipped'))
    expect(colorOf({}, 'shipped')).not.toBe('default')
  })

  it('never hands a new option the same colour twice while spares remain', () => {
    let next = schema()
    const colors = new Set<string>()
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      next = addOption(next, 'status', name)
      colors.add(colorOf(configFor(next, 'status'), name))
    }
    expect(colors.size).toBe(5)
  })

  it('never auto-assigns the colourless default', () => {
    expect(nextColor({})).not.toBe('default')
  })

  it('refuses to add an option that already exists', () => {
    const once = addOption(schema(), 'status', 'done')
    expect(addOption(once, 'status', 'done')).toBe(once)
    expect(configFor(once, 'status').options).toHaveLength(1)
  })

  it('ignores a blank option', () => {
    expect(addOption(schema(), 'status', '   ')).toEqual(EMPTY_PROPERTY_SCHEMA)
  })

  it('recolours an inferred option by promoting it into the config', () => {
    // Recolouring a value that only exists in the file must persist it, or the
    // choice is forgotten the moment the panel redraws.
    const next = setOptionColor(schema(), 'status', 'shipped', 'green')
    expect(colorOf(configFor(next, 'status'), 'shipped')).toBe('green')
  })

  it('renames an option without disturbing the others', () => {
    let next = addOption(schema(), 'status', 'done', 'green')
    next = addOption(next, 'status', 'draft', 'gray')
    next = renameOption(next, 'status', 'done', 'shipped')
    expect(configFor(next, 'status').options).toEqual([
      { name: 'shipped', color: 'green' },
      { name: 'draft', color: 'gray' },
    ])
  })

  it('refuses a rename that would collide with another option', () => {
    let next = addOption(schema(), 'status', 'done')
    next = addOption(next, 'status', 'draft')
    expect(renameOption(next, 'status', 'done', 'draft')).toBe(next)
  })

  it('removes an option', () => {
    const next = removeOption(addOption(schema(), 'status', 'done'), 'status', 'done')
    expect(configFor(next, 'status').options).toEqual([])
  })
})

describe('convertValue', () => {
  it('splits a comma list when becoming tags', () => {
    expect(convertValue(entryOf('topic: rust, notes'), 'tags')).toEqual(['rust', 'notes'])
  })

  it('keeps list items intact when they already are tags', () => {
    expect(convertValue(entryOf('tags: [a, b]'), 'tags')).toEqual(['a', 'b'])
  })

  it('joins a list back into text', () => {
    expect(convertValue(entryOf('tags: [a, b]'), 'text')).toBe('a, b')
  })

  it('reads a number out of surrounding text', () => {
    expect(convertValue(entryOf('effort: about 3 days'), 'number')).toBe('3')
    expect(convertValue(entryOf('ratio: -1.5'), 'number')).toBe('-1.5')
  })

  it('empties rather than invents when the value is not convertible', () => {
    // An empty property reads as unfinished; a fabricated date reads as fact.
    expect(convertValue(entryOf('due: asap'), 'date')).toBe('')
    expect(convertValue(entryOf('title: hello'), 'number')).toBe('')
  })

  it('keeps a real date when becoming a date', () => {
    expect(convertValue(entryOf('due: 2026-08-14T09:00:00Z'), 'date')).toBe('2026-08-14')
  })

  it('reads the usual truthy words as true and everything else as false', () => {
    expect(convertValue(entryOf('draft: YES'), 'boolean')).toBe('true')
    expect(convertValue(entryOf('draft: maybe'), 'boolean')).toBe('false')
  })

  it('leaves an empty value empty for every type', () => {
    expect(convertValue(entryOf('status:'), 'date')).toBe('')
    expect(convertValue(entryOf('status:'), 'tags')).toEqual([])
  })
})

describe('formatDate', () => {
  const day = '2026-08-14'

  it('writes each format the way its label promises', () => {
    expect(formatDate(day, 'iso')).toBe('2026-08-14')
    expect(formatDate(day, 'dmy')).toBe('14/08/2026')
    expect(formatDate(day, 'mdy')).toBe('08/14/2026')
  })

  it('counts relative days by the calendar, not by elapsed hours', () => {
    // 23:00 today to 01:00 tomorrow is two hours and one day.
    const now = new Date(2026, 7, 14, 23, 0)
    expect(formatDate('2026-08-15', 'relative', now)).toBe('Tomorrow')
    expect(formatDate('2026-08-14', 'relative', now)).toBe('Today')
    expect(formatDate('2026-08-13', 'relative', now)).toBe('Yesterday')
    expect(formatDate('2026-08-19', 'relative', now)).toBe('In 5 days')
    expect(formatDate('2026-08-09', 'relative', now)).toBe('5 days ago')
  })

  it('gives up on relative once the distance stops being useful', () => {
    const now = new Date(2026, 7, 14, 12, 0)
    expect(formatDate('2027-08-14', 'relative', now)).toBe(formatDate('2027-08-14', 'long'))
  })

  it('hands back text it cannot parse instead of rewriting it', () => {
    expect(formatDate('sometime next week', 'dmy')).toBe('sometime next week')
  })
})
