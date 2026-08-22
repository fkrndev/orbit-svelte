import { describe, expect, it } from 'vitest'
import { getFormattingToolbarItems } from '@blocknote/react'
import { groupToolbarItems } from '../RichFormattingToolbar'

/** The keys BlockNote gives its items, in toolbar order. */
function keysOf(items: ReturnType<typeof groupToolbarItems>) {
  return items.map(item => (item as { key?: string | null } | null)?.key)
}

describe('groupToolbarItems', () => {
  it('collapses the three alignment buttons into one control', () => {
    const keys = keysOf(groupToolbarItems(getFormattingToolbarItems()))

    expect(keys).toContain('textAlignMenuButton')
    expect(keys).not.toContain('textAlignLeftButton')
    expect(keys).not.toContain('textAlignCenterButton')
    expect(keys).not.toContain('textAlignRightButton')
  })

  it('collapses nest and unnest into one control', () => {
    const keys = keysOf(groupToolbarItems(getFormattingToolbarItems()))

    expect(keys).toContain('indentMenuButton')
    expect(keys).not.toContain('nestBlockButton')
    expect(keys).not.toContain('unnestBlockButton')
  })

  it('swaps the colour list for the grid, in the slot the list had', () => {
    const before = keysOf(getFormattingToolbarItems())
    const after = keysOf(groupToolbarItems(getFormattingToolbarItems()))

    expect(after).toContain('colorGridButton')
    expect(after).not.toContain('colorStyleButton')
    // Its neighbours on the left survive, so the button did not drift to the end.
    expect(after.indexOf('colorGridButton')).toBeGreaterThan(after.indexOf('strikeStyleButton'))
    expect(before.indexOf('colorStyleButton')).toBeGreaterThan(before.indexOf('strikeStyleButton'))
  })

  it('keeps inline code with the other character styles', () => {
    const keys = keysOf(groupToolbarItems(getFormattingToolbarItems()))

    expect(keys.indexOf('codeStyleButton')).toBe(keys.indexOf('strikeStyleButton') + 1)
  })

  it('leaves every button it does not group alone', () => {
    const before = keysOf(getFormattingToolbarItems())
    const after = keysOf(groupToolbarItems(getFormattingToolbarItems()))
    const grouped = new Set([
      'textAlignLeftButton',
      'textAlignCenterButton',
      'textAlignRightButton',
      'colorStyleButton',
      'nestBlockButton',
      'unnestBlockButton',
    ])

    expect(before.filter(key => !grouped.has(key as string))).toEqual(
      after.filter(key => !key?.endsWith('MenuButton') && key !== 'colorGridButton' && key !== 'codeStyleButton'),
    )
  })
})
