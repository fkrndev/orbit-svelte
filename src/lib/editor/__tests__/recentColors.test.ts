import { describe, expect, it } from 'vitest'
import { rememberColor } from '../recentColors'

describe('rememberColor', () => {
  it('puts the newest pick first', () => {
    const list = rememberColor([{ kind: 'text', color: 'red' }], { kind: 'text', color: 'blue' })

    expect(list).toEqual([
      { kind: 'text', color: 'blue' },
      { kind: 'text', color: 'red' },
    ])
  })

  it('moves a re-used colour to the front instead of duplicating it', () => {
    const list = rememberColor(
      [
        { kind: 'text', color: 'blue' },
        { kind: 'text', color: 'red' },
      ],
      { kind: 'text', color: 'red' },
    )

    expect(list).toEqual([
      { kind: 'text', color: 'red' },
      { kind: 'text', color: 'blue' },
    ])
  })

  it('keeps the same colour once per kind', () => {
    const list = rememberColor([{ kind: 'text', color: 'yellow' }], {
      kind: 'background',
      color: 'yellow',
    })

    expect(list).toEqual([
      { kind: 'background', color: 'yellow' },
      { kind: 'text', color: 'yellow' },
    ])
  })

  it('caps the list at one row', () => {
    const full = ['gray', 'brown', 'red', 'orange', 'yellow'].map(color => ({
      kind: 'text' as const,
      color,
    }))

    const list = rememberColor(full, { kind: 'text', color: 'green' })

    expect(list).toHaveLength(5)
    expect(list[0]).toEqual({ kind: 'text', color: 'green' })
    expect(list).not.toContainEqual({ kind: 'text', color: 'yellow' })
  })

  it('does not remember the absence of a colour', () => {
    const before = [{ kind: 'text' as const, color: 'red' }]

    expect(rememberColor(before, { kind: 'text', color: 'default' })).toEqual(before)
  })
})
