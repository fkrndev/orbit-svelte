import { describe, expect, it } from 'vitest'
import { readProperty } from '../frontmatter'
import { detectPropertyType, parseDateValue, toISODateString } from '../propertyTypes'

const typeOf = (line: string) => {
  const entry = readProperty(`---\n${line}\n---\n`, line.split(':')[0]!.trim())
  if (!entry) throw new Error(`no property parsed from ${line}`)
  return detectPropertyType(entry)
}

describe('detectPropertyType', () => {
  it.each([
    ['status: draft', 'status'],
    ['state: blocked', 'status'],
    ['due: 2026-09-01', 'date'],
    ['published: 2026-09-01T10:00:00Z', 'date'],
    ['url: https://example.com', 'url'],
    ['count: 42', 'number'],
    ['ratio: -1.5', 'number'],
    ['draft: true', 'boolean'],
    ['reviewed: no', 'boolean'],
    ['tags: [a, b]', 'tags'],
    ['title: Hello world', 'text'],
  ])('%s → %s', (line, expected) => {
    expect(typeOf(line)).toBe(expected)
  })

  it('lets the value overrule a misleading key', () => {
    // Named like a date, but nothing here is one.
    expect(typeOf('due: asap')).toBe('text')
    expect(typeOf('link: ask Ada')).toBe('text')
  })

  it('falls back to the key when there is no value to read', () => {
    expect(typeOf('status:')).toBe('status')
    expect(typeOf('due:')).toBe('date')
  })

  it('does not turn a zero-padded string into a number', () => {
    // Phone numbers and ids lose their leading zero if treated as numeric.
    expect(typeOf('code: 007')).toBe('text')
  })

  it('treats any list as tags', () => {
    expect(typeOf('aliases: [one, two]')).toBe('tags')
  })
})

describe('date property values', () => {
  it('reads a plain ISO day as that day, not the one before it', () => {
    // The bug this guards: `new Date('2026-08-14')` is UTC midnight, which is
    // still the 13th anywhere west of Greenwich.
    const parsed = parseDateValue('2026-08-14')
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(7)
    expect(parsed?.getDate()).toBe(14)
  })

  it('reads a timestamp down to its day', () => {
    expect(toISODateString(parseDateValue('2026-08-14T23:30:00Z')!)).toBe('2026-08-14')
  })

  it('refuses anything that is not a date', () => {
    expect(parseDateValue('asap')).toBeUndefined()
    expect(parseDateValue('')).toBeUndefined()
  })

  it('round-trips a picked day back to the wire format', () => {
    expect(toISODateString(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })

})
