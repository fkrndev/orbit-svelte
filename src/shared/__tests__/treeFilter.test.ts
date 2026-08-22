import { describe, expect, it } from 'vitest'
import { ancestorDirs, isStaleFilter } from '../treeFilter'

const ROOT = '/home/me/notes'
const OTHER = '/home/me/work'

describe('ancestorDirs', () => {
  it('returns every folder between the root and each hit', () => {
    const dirs = ancestorDirs([`${ROOT}/docs/adr/0001.md`], [ROOT])
    expect(dirs.sort()).toEqual([`${ROOT}/docs`, `${ROOT}/docs/adr`])
  })

  it('excludes the root itself, which the root row draws', () => {
    expect(ancestorDirs([`${ROOT}/plan.md`], [ROOT])).toEqual([])
  })

  it('deduplicates folders shared by several hits', () => {
    const dirs = ancestorDirs([`${ROOT}/docs/a.md`, `${ROOT}/docs/b.md`], [ROOT])
    expect(dirs).toEqual([`${ROOT}/docs`])
  })

  it('handles hits across more than one root', () => {
    const dirs = ancestorDirs([`${ROOT}/docs/a.md`, `${OTHER}/src/b.md`], [ROOT, OTHER])
    expect(dirs.sort()).toEqual([`${ROOT}/docs`, `${OTHER}/src`])
  })

  it('ignores a hit that belongs to no known root', () => {
    expect(ancestorDirs(['/elsewhere/deep/a.md'], [ROOT])).toEqual([])
  })

  it('does not treat a same-prefix sibling as being inside the root', () => {
    // `/home/me/notes-archive` starts with the root as a string but is a
    // different folder; walking up from it would never terminate at the root.
    expect(ancestorDirs(['/home/me/notes-archive/x/a.md'], [ROOT])).toEqual([])
  })

  it('returns nothing for no hits — an empty result is not an empty tree', () => {
    expect(ancestorDirs([], [ROOT])).toEqual([])
  })
})

describe('isStaleFilter', () => {
  it('drops a response for a query the user has moved on from', () => {
    // The failure this prevents: a slow answer for `pl` arriving after a fast
    // one for `plan` replaces the right result, which reads as the search
    // skipping characters.
    expect(isStaleFilter('plan', 'pl')).toBe(true)
    expect(isStaleFilter('plan', 'plan')).toBe(false)
  })

  it('treats whitespace as part of the query, matching what was sent', () => {
    expect(isStaleFilter('plan ', 'plan')).toBe(true)
  })
})
