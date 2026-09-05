import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDir } from '../files'
import { folderNameProblem } from '../../../shared/rename'

/**
 * The failure this guards against is silent, which is the only reason it is
 * worth a file: `mkdirSync(path, { recursive: true })` on a name that is taken
 * *succeeds*, so a folder made over an existing one would report success and
 * change nothing — and over a file of the same name it fails with an errno the
 * user cannot read.
 */
let root = ''

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'createdir-'))
  mkdirSync(join(root, 'taken'))
  writeFileSync(join(root, 'note.md'), '#')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('createDir', () => {
  it('creates the folder and returns its path', () => {
    const path = createDir(root, 'fresh')
    expect(path).toBe(join(root, 'fresh'))
    expect(existsSync(path)).toBe(true)
  })

  it('refuses a name another folder already has', () => {
    expect(() => createDir(root, 'taken')).toThrow(/already exists/)
  })

  it('refuses a name a file already has', () => {
    expect(() => createDir(root, 'note.md')).toThrow(/already exists/)
  })

  it('refuses a parent that is not there', () => {
    expect(() => createDir(join(root, 'nowhere'), 'child')).toThrow()
  })
})

describe('folderNameProblem', () => {
  it('accepts an ordinary name', () => {
    expect(folderNameProblem('drafts')).toBeNull()
  })

  // A dot-folder is skipped by every walk and listing, so it would vanish from
  // the sidebar, quick open and search the moment it was made.
  it('refuses a hidden folder', () => {
    expect(folderNameProblem('.archive')).toMatch(/hidden/)
  })

  it('refuses the names that are not names', () => {
    expect(folderNameProblem('')).toMatch(/empty/)
    expect(folderNameProblem('..')).toMatch(/not a name/)
    expect(folderNameProblem('a/b')).toMatch(/cannot contain/)
  })
})
