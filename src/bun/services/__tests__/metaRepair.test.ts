import { describe, expect, it } from 'vitest'
import { findRepairTarget, hasUserData, type RepairCandidate } from '../metaRepair'
import type { FileMeta, Fingerprint } from '../../../shared/types'

function meta(overrides: Partial<FileMeta> & { path: string; id: string }): FileMeta {
  return {
    rootId: null,
    labels: [],
    tags: [],
    note: '',
    pinned: false,
    createdAt: 0,
    updatedAt: 0,
    fingerprint: null,
    ...overrides,
  }
}

const print = (head: string, size = 100): Fingerprint => ({ head, size, mtimeMs: 0 })

describe('findRepairTarget', () => {
  it('re-links an orphaned record with matching content', () => {
    const candidates: RepairCandidate[] = [
      {
        meta: meta({ id: 'f1', path: '/old/notes.md', tags: ['x'], fingerprint: print('aaa') }),
        stillExists: false,
      },
    ]

    const result = findRepairTarget('/new/notes.md', print('aaa'), candidates)
    expect(result).toEqual({ kind: 'matched', meta: candidates[0]!.meta })
  })

  it('ignores records whose own file still exists', () => {
    // The original is alive, so this must be treated as a *copy*, not a move —
    // otherwise duplicating a file would steal the original's metadata.
    const candidates: RepairCandidate[] = [
      {
        meta: meta({ id: 'f1', path: '/live/notes.md', tags: ['x'], fingerprint: print('aaa') }),
        stillExists: true,
      },
    ]

    expect(findRepairTarget('/copy/notes.md', print('aaa'), candidates).kind).toBe('none')
  })

  it('returns none when nothing matches the content', () => {
    const candidates: RepairCandidate[] = [
      {
        meta: meta({ id: 'f1', path: '/old/a.md', tags: ['x'], fingerprint: print('aaa') }),
        stillExists: false,
      },
    ]

    expect(findRepairTarget('/new/b.md', print('zzz'), candidates).kind).toBe('none')
  })

  it('breaks a content tie using the filename', () => {
    const candidates: RepairCandidate[] = [
      {
        meta: meta({ id: 'f1', path: '/old/keep.md', tags: ['x'], fingerprint: print('aaa') }),
        stillExists: false,
      },
      {
        meta: meta({ id: 'f2', path: '/old/other.md', tags: ['x'], fingerprint: print('aaa') }),
        stillExists: false,
      },
    ]

    const result = findRepairTarget('/new/keep.md', print('aaa'), candidates)
    expect(result).toEqual({ kind: 'matched', meta: candidates[0]!.meta })
  })

  it('reports ambiguity rather than guessing', () => {
    const candidates: RepairCandidate[] = [
      {
        meta: meta({ id: 'f1', path: '/old/a.md', tags: ['x'], fingerprint: print('aaa') }),
        stillExists: false,
      },
      {
        meta: meta({ id: 'f2', path: '/old/b.md', tags: ['x'], fingerprint: print('aaa') }),
        stillExists: false,
      },
    ]

    const result = findRepairTarget('/new/c.md', print('aaa'), candidates)
    expect(result.kind).toBe('ambiguous')
  })

  it('does not match when size differs even if the head hash collides', () => {
    const candidates: RepairCandidate[] = [
      {
        meta: meta({
          id: 'f1',
          path: '/old/a.md',
          tags: ['x'],
          fingerprint: print('aaa', 100),
        }),
        stillExists: false,
      },
    ]

    expect(findRepairTarget('/new/a.md', print('aaa', 999), candidates).kind).toBe('none')
  })

  it('gives up when the incoming file could not be fingerprinted', () => {
    expect(findRepairTarget('/new/a.md', null, [])).toEqual({ kind: 'none' })
  })
})

describe('hasUserData', () => {
  it('is false for an untouched record', () => {
    expect(hasUserData(meta({ id: 'f1', path: '/a.md' }))).toBe(false)
  })

  it('is true once anything has been set', () => {
    expect(hasUserData(meta({ id: 'f1', path: '/a.md', tags: ['x'] }))).toBe(true)
    expect(hasUserData(meta({ id: 'f2', path: '/a.md', pinned: true }))).toBe(true)
    expect(hasUserData(meta({ id: 'f3', path: '/a.md', note: 'hi' }))).toBe(true)
    expect(hasUserData(meta({ id: 'f4', path: '/a.md', labels: ['draft'] }))).toBe(true)
  })

  it('treats a whitespace-only note as empty', () => {
    expect(hasUserData(meta({ id: 'f1', path: '/a.md', note: '   \n ' }))).toBe(false)
  })
})
