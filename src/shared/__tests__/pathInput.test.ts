import { describe, expect, it } from 'vitest'
import {
  containingRootPath,
  folderOf,
  looksLikePath,
  normalizePathInput,
  splitPathInput,
} from '../pathInput'

const HOME = '/Users/me'

describe('looksLikePath', () => {
  it('recognises the three ways a path is actually pasted', () => {
    expect(looksLikePath('/Users/me/notes.md')).toBe(true)
    expect(looksLikePath('~/notes.md')).toBe(true)
    expect(looksLikePath('file:///Users/me/notes.md')).toBe(true)
  })

  it('sees through the quotes Finder adds', () => {
    expect(looksLikePath('"/Users/me/My Notes/plan.md"')).toBe(true)
  })

  it('leaves an ordinary search alone', () => {
    // The whole palette still has to work for people typing a filename.
    expect(looksLikePath('plan')).toBe(false)
    expect(looksLikePath('./plan.md')).toBe(false)
    expect(looksLikePath('')).toBe(false)
  })
})

describe('normalizePathInput', () => {
  it('expands ~ on its own and as a prefix', () => {
    expect(normalizePathInput('~', HOME)).toBe(HOME)
    expect(normalizePathInput('~/project/a.md', HOME)).toBe('/Users/me/project/a.md')
  })

  it('unescapes the spaces a terminal paste carries', () => {
    expect(normalizePathInput('/Users/me/My\\ Notes/a.md', HOME)).toBe('/Users/me/My Notes/a.md')
  })

  it('decodes a file:// URL, with or without a host', () => {
    expect(normalizePathInput('file:///Users/me/My%20Notes/a.md', HOME)).toBe(
      '/Users/me/My Notes/a.md',
    )
    expect(normalizePathInput('file://localhost/Users/me/a.md', HOME)).toBe('/Users/me/a.md')
  })

  it('keeps a trailing slash but collapses doubled ones', () => {
    // The trailing slash is meaning, not noise: it is what says "list inside".
    expect(normalizePathInput('/Users//me/project/', HOME)).toBe('/Users/me/project/')
  })

  it('survives a half-encoded paste instead of throwing', () => {
    expect(normalizePathInput('file:///Users/me/100%.md', HOME)).toBe('/Users/me/100%.md')
  })
})

describe('splitPathInput', () => {
  it('treats a trailing slash as the folder itself', () => {
    expect(splitPathInput('/a/b/')).toEqual({ dir: '/a/b', prefix: '' })
  })

  it('treats the last segment as something to match on', () => {
    expect(splitPathInput('/a/b/RE')).toEqual({ dir: '/a/b', prefix: 'RE' })
  })

  it('handles the root itself', () => {
    expect(splitPathInput('/')).toEqual({ dir: '/', prefix: '' })
    expect(splitPathInput('/Users')).toEqual({ dir: '/', prefix: 'Users' })
  })
})

describe('folderOf', () => {
  it('drops the filename', () => {
    expect(folderOf('/a/b/c.md')).toBe('/a/b')
  })

  it('never climbs past the root', () => {
    expect(folderOf('/a.md')).toBe('/')
  })
})

describe('containingRootPath', () => {
  it('finds the folder a file lives under', () => {
    expect(containingRootPath(['/a', '/b'], '/a/notes/x.md')).toBe('/a')
  })

  it('prefers the nested folder over its parent', () => {
    // Otherwise opening a file in a nested root would offer to add the parent
    // it is already reachable from.
    expect(containingRootPath(['/a', '/a/docs'], '/a/docs/x.md')).toBe('/a/docs')
  })

  it('does not match a folder that merely shares a name prefix', () => {
    expect(containingRootPath(['/a/proj'], '/a/project/x.md')).toBeNull()
  })

  it('reports nothing when no folder covers it', () => {
    expect(containingRootPath([], '/a/x.md')).toBeNull()
  })
})
