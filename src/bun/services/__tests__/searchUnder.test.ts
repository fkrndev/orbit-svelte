import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * The way out of "I know the note's name, not which subfolder it is in".
 *
 * The completion beside it only ever reads one directory, which is what keeps
 * it instant — and what leaves you stuck exactly here.
 */

vi.mock('../roots', () => ({ rootIdForPath: () => null }))

const { searchUnder } = await import('../searchUnder')

let root = ''
const names = (query: string) => searchUnder(root, query).hits.map(hit => hit.name)

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'searchunder-'))
  mkdirSync(join(root, 'docs-id/deep'), { recursive: true })
  mkdirSync(join(root, 'node_modules/pkg'), { recursive: true })
  writeFileSync(join(root, 'README.md'), '#')
  writeFileSync(join(root, 'docs-id/plan-setting.md'), '#')
  writeFileSync(join(root, 'docs-id/deep/architecture.md'), '#')
  writeFileSync(join(root, 'node_modules/pkg/readme.md'), '#')
  writeFileSync(join(root, 'docs-id/notes.txt'), 'x')
  writeFileSync(join(root, 'docs-id/diagram.png'), 'x')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('searchUnder', () => {
  it('finds a note several folders down', () => {
    expect(names('architecture')).toEqual(['architecture.md'])
  })

  it('matches an abbreviation of the name', () => {
    expect(names('plnset')).toContain('plan-setting.md')
  })

  it('matches on the folder too, because that is how notes are remembered', () => {
    expect(names('deep arch')).toEqual([])
    expect(names('deep/arch')).toEqual(['architecture.md'])
  })

  it('skips the folders the rest of the app skips', () => {
    // Otherwise every JS project answers "readme" with its dependencies.
    expect(names('readme')).toEqual(['README.md'])
  })

  it('finds code as well as notes', () => {
    expect(names('notes')).toEqual(['notes.txt'])
  })

  it('ignores files the app cannot open', () => {
    expect(names('diagram')).toEqual([])
  })

  it('answers an empty query with nothing rather than everything', () => {
    expect(searchUnder(root, '   ')).toEqual({ hits: [], truncated: false })
  })

  it('reports honestly that it did not hit its cap', () => {
    expect(searchUnder(root, 'md').truncated).toBe(false)
  })

  it('survives a folder that is not there', () => {
    expect(searchUnder(join(root, 'nope'), 'x').hits).toEqual([])
  })
})
