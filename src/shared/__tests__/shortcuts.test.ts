import { describe, expect, it } from 'vitest'
import {
  SHORTCUTS,
  SHORTCUT_GROUPS,
  keysFor,
  labelWithKeys,
  type ShortcutId,
} from '../shortcuts'

describe('SHORTCUTS', () => {
  it('has no duplicate ids', () => {
    const ids = SHORTCUTS.map(shortcut => shortcut.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('binds each key combination to exactly one action', () => {
    // Two entries sharing a combination means the table is telling the reader
    // something the app cannot honour.
    const keys = SHORTCUTS.map(shortcut => shortcut.keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('puts every shortcut in a group the settings page renders', () => {
    for (const shortcut of SHORTCUTS) {
      expect(SHORTCUT_GROUPS).toContain(shortcut.group)
    }
  })

  it('leaves no group empty', () => {
    for (const group of SHORTCUT_GROUPS) {
      expect(SHORTCUTS.some(shortcut => shortcut.group === group)).toBe(true)
    }
  })
})

describe('keysFor', () => {
  it('returns the binding', () => {
    expect(keysFor('quickOpen')).toBe('⌘P')
  })

  it('throws on an unknown id rather than rendering an empty tooltip', () => {
    expect(() => keysFor('nope' as ShortcutId)).toThrow()
  })
})

describe('labelWithKeys', () => {
  it('reads as a button title', () => {
    expect(labelWithKeys('toggleSidebar')).toBe('Toggle sidebar (⌘B)')
  })

  it('takes an override for controls whose label differs from the list', () => {
    expect(labelWithKeys('quickOpen', 'Search')).toBe('Search (⌘P)')
  })
})
