import { describe, expect, it } from 'vitest'
import {
  readProperties,
  readProperty,
  removeProperty,
  renamePropertyKey,
  splitFrontmatter,
  writeProperty,
} from '../frontmatter'

const DOC = `---
title: Hello world
status: draft
tags: [rust, notes]
aliases:
  - one
  - two
---

# Body

Text.
`

describe('readProperties', () => {
  it('reads keys in file order', () => {
    expect(readProperties(DOC).map(p => p.key)).toEqual(['title', 'status', 'tags', 'aliases'])
  })

  it('reads a scalar', () => {
    expect(readProperty(DOC, 'title')).toMatchObject({ shape: 'scalar', value: 'Hello world' })
  })

  it('reads an inline list', () => {
    expect(readProperty(DOC, 'tags')).toMatchObject({ shape: 'list', items: ['rust', 'notes'] })
  })

  it('reads a block list', () => {
    expect(readProperty(DOC, 'aliases')).toMatchObject({ shape: 'list', items: ['one', 'two'] })
  })

  it('strips quotes', () => {
    expect(readProperty(`---\na: "quoted"\n---\n`, 'a')?.value).toBe('quoted')
  })

  it('finds nothing in a file with no frontmatter', () => {
    expect(readProperties('# Just a heading\n')).toEqual([])
  })

  it('refuses to claim it understands a nested map', () => {
    const nested = `---\nauthor:\n  name: Ada\n  city: London\n---\n`
    expect(readProperty(nested, 'author')?.shape).toBe('unsupported')
  })

  it('refuses to claim it understands a block scalar', () => {
    const block = `---\nabstract: |\n  line one\n  line two\nafter: yes\n---\n`
    expect(readProperty(block, 'abstract')?.shape).toBe('unsupported')
    // The key after it is still found, so one hard value does not hide the rest.
    expect(readProperty(block, 'after')?.value).toBe('yes')
  })
})

describe('writeProperty', () => {
  it('leaves every other byte alone', () => {
    const next = writeProperty(DOC, 'status', 'done')
    expect(next).toContain('status: done')
    expect(next).toContain('title: Hello world')
    expect(next).toContain('tags: [rust, notes]')
    expect(next).toContain('# Body\n\nText.\n')
  })

  it('appends a key that does not exist yet', () => {
    const next = writeProperty(DOC, 'due', '2026-09-01')
    expect(readProperty(next, 'due')?.value).toBe('2026-09-01')
    // Existing keys keep their order; the new one lands last.
    expect(readProperties(next).map(p => p.key)).toEqual([
      'title', 'status', 'tags', 'aliases', 'due',
    ])
  })

  it('creates the block when the file has none', () => {
    const next = writeProperty('# Heading\n\nText.\n', 'status', 'draft')
    expect(next).toBe('---\nstatus: draft\n---\n# Heading\n\nText.\n')
  })

  it('replaces a block list without leaking the old items', () => {
    const next = writeProperty(DOC, 'aliases', ['three'])
    expect(readProperty(next, 'aliases')?.items).toEqual(['three'])
    expect(next).not.toContain('- one')
    expect(next).not.toContain('- two')
  })

  it('quotes a value that would otherwise change meaning', () => {
    expect(writeProperty(DOC, 'title', 'yes: no')).toContain("title: 'yes: no'")
    expect(writeProperty(DOC, 'title', '  padded  ')).toContain("title: '  padded  '")
    expect(writeProperty(DOC, 'title', '')).toContain("title: ''")
  })

  it('refuses to rewrite a value it cannot parse', () => {
    const nested = `---\nauthor:\n  name: Ada\n---\n# Body\n`
    expect(writeProperty(nested, 'author', 'Grace')).toBe(nested)
  })

  it('matches an existing key case-insensitively rather than duplicating it', () => {
    const next = writeProperty(DOC, 'Status', 'done')
    expect(readProperties(next).filter(p => p.key.toLowerCase() === 'status')).toHaveLength(1)
    expect(next).toContain('status: done')
  })

  it('preserves CRLF line endings', () => {
    const crlf = '---\r\nstatus: draft\r\n---\r\n# Body\r\n'
    expect(writeProperty(crlf, 'status', 'done')).toBe('---\r\nstatus: done\r\n---\r\n# Body\r\n')
  })
})

describe('key names', () => {
  it('refuses to add a name that would read back as a different key', () => {
    // `a: b` written naively becomes `a: b: draft` — one property turned into
    // another plus a syntax error, in a file the app did not create.
    expect(writeProperty(DOC, 'a: b', 'draft')).toBe(DOC)
    expect(writeProperty(DOC, '2 stage', 'draft')).toBe(DOC)
  })

  it('still writes an ordinary new key', () => {
    expect(readProperty(writeProperty(DOC, 'owner', 'ada'), 'owner')?.value).toBe('ada')
  })
})

describe('removeProperty', () => {
  it('takes the continuation lines with it', () => {
    const next = removeProperty(DOC, 'aliases')
    expect(readProperty(next, 'aliases')).toBeNull()
    expect(next).not.toContain('- one')
    expect(readProperty(next, 'tags')?.items).toEqual(['rust', 'notes'])
  })

  it('is a no-op for an unknown key', () => {
    expect(removeProperty(DOC, 'nope')).toBe(DOC)
  })
})

describe('renamePropertyKey', () => {
  it('keeps the value and the position in the block', () => {
    const next = renamePropertyKey(DOC, 'status', 'stage')
    expect(readProperty(next, 'stage')?.value).toBe('draft')
    expect(readProperty(next, 'status')).toBeNull()
    // Second key before, second key after — a rename must not reshuffle a file.
    expect(readProperties(next).map(entry => entry.key)).toEqual([
      'title',
      'stage',
      'tags',
      'aliases',
    ])
  })

  it('carries a multi-line list across', () => {
    const next = renamePropertyKey(DOC, 'aliases', 'also known as')
    expect(readProperty(next, 'also known as')?.items).toEqual(['one', 'two'])
    expect(readProperty(next, 'aliases')).toBeNull()
  })

  it('changes the capitalisation of a key without treating it as a collision', () => {
    expect(readProperty(renamePropertyKey(DOC, 'status', 'Status'), 'Status')?.key).toBe('Status')
  })

  it('refuses to overwrite a key that already exists', () => {
    expect(renamePropertyKey(DOC, 'status', 'title')).toBe(DOC)
  })

  it('refuses a name YAML would not read back as a key', () => {
    expect(renamePropertyKey(DOC, 'status', '  ')).toBe(DOC)
    expect(renamePropertyKey(DOC, 'status', '2 stage')).toBe(DOC)
    expect(renamePropertyKey(DOC, 'status', 'a: b')).toBe(DOC)
  })

  it('leaves a value it cannot rewrite alone', () => {
    const block = '---\nnested:\n  deep: 1\n---\n'
    expect(renamePropertyKey(block, 'nested', 'flat')).toBe(block)
  })

  it('is a no-op for an unknown key', () => {
    expect(renamePropertyKey(DOC, 'nope', 'something')).toBe(DOC)
  })
})

describe('splitFrontmatter', () => {
  it('still round-trips the whole file', () => {
    const [block, body] = splitFrontmatter(DOC)
    expect(block + body).toBe(DOC)
  })
})
