import { describe, expect, it } from 'vitest'
import { mentionItems, tagItems } from '../refSuggestionItems'

/**
 * What `#` and `@` offer.
 *
 * The rule that matters most is the one that is easiest to lose: the menu can
 * never be a gate. A tag nobody has used is still a tag, so every query that is
 * not already on the list has to come back offered as new — otherwise the first
 * `#` of a fresh vault opens an empty box and teaches you the feature is broken.
 */

const TAGS = [
  { tag: 'draft', count: 9 },
  { tag: 'rilis', count: 4 },
  { tag: 'kampus', count: 1 },
]

const MENTIONS = [
  { mention: 'budi', count: 3 },
  { mention: 'sari', count: 1 },
]

const NOTES = [
  { path: '/vault/docs/plan-rilis.md', name: 'plan-rilis.md' },
  { path: '/vault/docs/budi-notes.md', name: 'budi-notes.md' },
  { path: '/vault/docs/here.md', name: 'here.md' },
]

const HERE = '/vault/docs/here.md'

const labels = (items: Array<{ label: string }>) => items.map(item => item.label)

describe('#', () => {
  it('offers the tags already in the vault, most used first', () => {
    expect(labels(tagItems('', TAGS))).toEqual(['draft', 'rilis', 'kampus'])
  })

  it('narrows as you type', () => {
    expect(labels(tagItems('ril', TAGS))).toContain('rilis')
    expect(labels(tagItems('ril', TAGS))).not.toContain('kampus')
  })

  it('offers an unknown word as a new tag', () => {
    const items = tagItems('anggaran', TAGS)
    expect(items.at(-1)).toMatchObject({ kind: 'new', label: 'anggaran' })
  })

  it('does not offer to create a tag that exists in another case', () => {
    // `#Draft` beside `#draft` is one tag split in two, and the index counts
    // them as one — so the menu must not suggest making the second.
    expect(tagItems('Draft', TAGS).some(item => item.kind === 'new')).toBe(false)
  })

  it('has nothing to create before anything is typed', () => {
    expect(tagItems('', []).length).toBe(0)
  })
})

describe('@', () => {
  it('offers names before notes', () => {
    const kinds = mentionItems('budi', MENTIONS, NOTES, HERE).map(item => item.kind)
    expect(kinds.indexOf('mention')).toBeLessThan(kinds.indexOf('note'))
  })

  it('links a note relative to the note being written in', () => {
    const note = mentionItems('plan', MENTIONS, NOTES, HERE).find(item => item.kind === 'note')
    expect(note).toMatchObject({ label: 'plan-rilis', href: './plan-rilis.md' })
  })

  it('never offers a link to the note you are already in', () => {
    // The word still comes back as a *new mention* — `@here` is a legitimate
    // thing to write. What must not appear is a link pointing at this file.
    const items = mentionItems('here', MENTIONS, NOTES, HERE)
    expect(items.filter(item => item.kind === 'note')).toEqual([])
    expect(items.at(-1)).toMatchObject({ kind: 'new', label: 'here' })
  })

  it('offers an unknown word as a new mention', () => {
    const items = mentionItems('rina', MENTIONS, NOTES, HERE)
    expect(items.at(-1)).toMatchObject({ kind: 'new', label: 'rina' })
  })

  it('does not offer to create a name that is already used', () => {
    expect(mentionItems('sari', MENTIONS, NOTES, HERE).some(item => item.kind === 'new')).toBe(
      false,
    )
  })
})
