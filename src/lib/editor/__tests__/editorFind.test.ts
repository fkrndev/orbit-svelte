import { describe, expect, it } from 'vitest'
import {
  buildEditorFindReplacementChange,
  buildEditorFindReplacementChanges,
  clampEditorFindIndex,
  findEditorMatches,
  nextEditorFindIndex,
} from '../editorFind'

describe('editorFind', () => {
  it('finds plain-text matches case-insensitively by default', () => {
    const result = findEditorMatches('Alpha beta alpha', 'alpha', {
      caseSensitive: false,
      regex: false,
    })

    expect(result.error).toBeNull()
    expect(result.matches).toEqual([
      { from: 0, text: 'Alpha', to: 5 },
      { from: 11, text: 'alpha', to: 16 },
    ])
  })

  it('supports case-sensitive matching', () => {
    const result = findEditorMatches('Alpha beta alpha', 'alpha', {
      caseSensitive: true,
      regex: false,
    })

    expect(result.matches).toEqual([{ from: 11, text: 'alpha', to: 16 }])
  })

  it('treats regex metacharacters as literals when regex is off', () => {
    const result = findEditorMatches('a.c abc', 'a.c', { caseSensitive: false, regex: false })

    expect(result.matches).toEqual([{ from: 0, text: 'a.c', to: 3 }])
  })

  it('reports invalid or zero-width regex patterns', () => {
    expect(findEditorMatches('body', '[', { caseSensitive: false, regex: true })).toMatchObject({
      error: 'Invalid regex',
      matches: [],
    })

    expect(findEditorMatches('body', '^', { caseSensitive: false, regex: true })).toMatchObject({
      error: 'Regex must match text',
      matches: [],
    })
  })

  it('refuses patterns that can backtrack catastrophically', () => {
    expect(findEditorMatches('aaaa', '(a+)+$', { caseSensitive: false, regex: true })).toMatchObject({
      error: 'Unsafe regex',
      matches: [],
    })
  })

  it('builds regex replacement changes with capture groups', () => {
    const result = findEditorMatches('foo-123 foo-456', 'foo-(\\d+)', {
      caseSensitive: false,
      regex: true,
    })

    expect(buildEditorFindReplacementChange(result.matches[0]!, 'foo-(\\d+)', 'bar-$1', {
      caseSensitive: false,
      regex: true,
    })).toEqual({ from: 0, insert: 'bar-123', to: 7 })

    expect(buildEditorFindReplacementChanges(result.matches, 'foo-(\\d+)', 'bar-$1', {
      caseSensitive: false,
      regex: true,
    })).toEqual([
      { from: 0, insert: 'bar-123', to: 7 },
      { from: 8, insert: 'bar-456', to: 15 },
    ])
  })

  it('inserts the replacement verbatim when regex is off', () => {
    const result = findEditorMatches('a$1b', 'a', { caseSensitive: false, regex: false })

    expect(buildEditorFindReplacementChange(result.matches[0]!, 'a', '$&x', {
      caseSensitive: false,
      regex: false,
    })).toEqual({ from: 0, insert: '$&x', to: 1 })
  })

  it('wraps next and previous match navigation', () => {
    expect(nextEditorFindIndex(0, 3, 1)).toBe(1)
    expect(nextEditorFindIndex(2, 3, 1)).toBe(0)
    expect(nextEditorFindIndex(0, 3, -1)).toBe(2)
    expect(nextEditorFindIndex(5, 0, 1)).toBe(0)
  })

  it('clamps a stale index when the match list shrinks', () => {
    expect(clampEditorFindIndex(7, 3)).toBe(2)
    expect(clampEditorFindIndex(-1, 3)).toBe(0)
    expect(clampEditorFindIndex(2, 0)).toBe(0)
  })
})
