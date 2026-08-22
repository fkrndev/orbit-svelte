import { describe, expect, it } from 'vitest'
import { fuzzyMatch, matchTier } from '../fuzzy'

describe('fuzzyMatch', () => {
  it('matches characters in order and reports their positions', () => {
    const result = fuzzyMatch('abc', 'aXbXc')
    expect(result.match).toBe(true)
    expect(result.matched).toEqual([0, 2, 4])
  })

  it('fails when a character is missing or out of order', () => {
    expect(fuzzyMatch('abc', 'acb').match).toBe(false)
    expect(fuzzyMatch('abcd', 'abc').match).toBe(false)
  })

  it('is case insensitive', () => {
    expect(fuzzyMatch('PLAN', 'plan.md').match).toBe(true)
  })

  it('scores a contiguous match above a scattered one', () => {
    const contiguous = fuzzyMatch('plan', 'plan.md')
    const scattered = fuzzyMatch('plan', 'p-l-a-n.md')
    expect(contiguous.score).toBeGreaterThan(scattered.score)
  })

  it('rewards matching at a word boundary', () => {
    // `/` is treated as a boundary because we also match against paths.
    const boundary = fuzzyMatch('note', 'docs/note.md')
    const midword = fuzzyMatch('note', 'keynotes.md')
    expect(boundary.score).toBeGreaterThan(midword.score)
  })

  it('matches everything against an empty query', () => {
    expect(fuzzyMatch('', 'anything').match).toBe(true)
  })
})

describe('matchTier', () => {
  it('orders exact above prefix above substring above fuzzy', () => {
    expect(matchTier('plan', 'plan')).toBe(0)
    expect(matchTier('plan', 'plan.md')).toBe(1)
    expect(matchTier('plan', 'my-plan.md')).toBe(2)
    expect(matchTier('plan', 'p-l-a-n')).toBe(3)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(matchTier('  PLAN ', 'plan')).toBe(0)
  })
})
