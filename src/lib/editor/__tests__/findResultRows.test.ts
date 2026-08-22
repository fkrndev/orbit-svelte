import { describe, expect, it } from 'vitest'
import { findEditorMatches } from '../editorFind'
import { buildFindResultRows } from '../findResultRows'

const PLAIN = { caseSensitive: false, regex: false }

function rowsFor(text: string, query: string) {
  return buildFindResultRows(text, findEditorMatches(text, query, PLAIN).matches)
}

describe('buildFindResultRows', () => {
  it('reports the 1-based line of each hit with the match cut out', () => {
    const rows = rowsFor('alpha one\nbeta\nalpha two', 'alpha')

    expect(rows).toEqual([
      { index: 0, line: 1, before: '', match: 'alpha', after: ' one', clipped: false },
      { index: 2, line: 3, before: '', match: 'alpha', after: ' two', clipped: false },
    ].map((row, position) => ({ ...row, index: position })))
  })

  it('keeps the surrounding words on the same line only', () => {
    const rows = rowsFor('one target two\nthree', 'target')

    expect(rows[0]).toMatchObject({ line: 1, before: 'one ', match: 'target', after: ' two' })
  })

  it('shows a short line whole, even for a match far along it', () => {
    const rows = rowsFor('one two three four five six seven eight nine target', 'target')

    expect(rows[0]).toMatchObject({
      before: 'one two three four five six seven eight nine ',
      clipped: false,
    })
  })

  it('windows a long line around the match instead of truncating from the start', () => {
    const rows = rowsFor(`${'x'.repeat(400)}needle${'y'.repeat(400)}`, 'needle')

    expect(rows[0]!.clipped).toBe(true)
    expect(rows[0]!.match).toBe('needle')
    expect(rows[0]!.before.length).toBeLessThanOrEqual(28)
    expect(rows[0]!.after.length).toBeGreaterThan(0)
    expect(rows[0]!.before.length + rows[0]!.match.length + rows[0]!.after.length)
      .toBeLessThanOrEqual(140)
  })

  it('clips a multi-line regex match to the line it starts on', () => {
    const matches = findEditorMatches('alpha\nbeta', 'a\\nb', { caseSensitive: false, regex: true })
    const rows = buildFindResultRows('alpha\nbeta', matches.matches)

    expect(rows[0]).toMatchObject({ line: 1, match: 'a', after: '' })
  })

  it('returns nothing when there are no matches', () => {
    expect(buildFindResultRows('alpha', [])).toEqual([])
  })
})
