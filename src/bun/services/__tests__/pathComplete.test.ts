import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { completePath, pathColumns } from '../pathComplete'

/**
 * A small pretend home, because the whole point of the feature is reaching
 * files the app has never been told about — so the fixture must be a folder no
 * root, index or cache knows anything about either.
 */
let home = ''
const names = (input: string) => completePath(input, home).entries.map(e => e.name)

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'pathcomplete-'))
  mkdirSync(join(home, 'project/docs'), { recursive: true })
  // A folder and a note that both answer "plan" — the tie the ranking exists for.
  mkdirSync(join(home, 'project/plans'), { recursive: true })
  writeFileSync(join(home, 'project/plan.md'), '# plan')
  mkdirSync(join(home, 'project/node_modules'), { recursive: true })
  mkdirSync(join(home, 'project/.github'), { recursive: true })
  writeFileSync(join(home, 'project/README.md'), '# readme')
  writeFileSync(join(home, 'project/RELEASE.markdown'), '# release')
  writeFileSync(join(home, 'project/package.json'), '{}')
  writeFileSync(join(home, 'project/docs/plan.md'), '# plan')
  writeFileSync(join(home, 'project/.github/CONTRIBUTING.md'), '# contributing')
})

afterAll(() => rmSync(home, { recursive: true, force: true }))

describe('completePath', () => {
  it('lists a folder when the path ends in a slash', () => {
    expect(names('~/project/')).toEqual([
      'docs',
      'plans',
      'plan.md',
      'README.md',
      'RELEASE.markdown',
    ])
  })

  it('filters by the last segment instead of listing everything', () => {
    expect(names('~/project/RE')).toEqual(['README.md', 'RELEASE.markdown'])
  })

  it('ignores case, so a half-remembered name still lands', () => {
    expect(names('~/project/re')).toEqual(['README.md', 'RELEASE.markdown'])
  })

  it('matches inside a name once the prefix does not', () => {
    expect(names('~/project/ADME')).toEqual(['README.md'])
  })

  it('matches an abbreviation, not just a substring', () => {
    // `rdme` is nowhere in "README.md" as a run of characters — it is how
    // people actually type when they are moving fast.
    expect(names('~/project/rdme')).toContain('README.md')
  })

  it('puts a note above a folder that answers equally well', () => {
    // The moment something is typed you are hunting a file; a folder is only
    // ever the road to one.
    expect(names('~/project/plan')).toEqual(['plan.md', 'plans'])
  })

  it('still prefers a folder whose match is the better one', () => {
    // `d` starts "docs" but is scattered through "README.md". Kind breaks ties;
    // it does not outrank match quality.
    expect(names('~/project/d')[0]).toBe('docs')
  })

  it('lists folders first when nothing is typed, like the sidebar', () => {
    expect(names('~/project/')[0]).toBe('docs')
  })

  it('prefers the shorter of two prefix matches', () => {
    expect(names('~/project/RE')).toEqual(['README.md', 'RELEASE.markdown'])
  })

  it('prefers the shorter of two equally fuzzy matches', () => {
    // `pln` scatters identically across both; the one that is nearly what was
    // typed must not lose on the alphabet.
    expect(names('~/project/pln')).toEqual(['plan.md', 'plans'])
  })

  it('counts the markdown directly inside each folder it offers', () => {
    const docs = completePath('~/project/', home).entries.find(e => e.name === 'docs')
    expect(docs?.noteCount).toBe(1)
  })

  it('says how many files it is not showing', () => {
    // package.json is here and will never be listed; a folder that looks empty
    // because of that is a lie told by omission.
    expect(completePath('~/project/', home).hiddenCount).toBe(1)
  })

  it('leaves out files the app cannot open', () => {
    expect(names('~/project/pack')).toEqual([])
  })

  it('hides build folders until they are asked for by name', () => {
    expect(names('~/project/')).not.toContain('node_modules')
    expect(names('~/project/node_')).toEqual(['node_modules'])
  })

  it('hides dotfolders until the prefix starts with a dot', () => {
    expect(names('~/project/')).not.toContain('.github')
    expect(names('~/project/.git')).toEqual(['.github'])
  })

  it('reports an openable file when the whole path is typed out', () => {
    const result = completePath('~/project/README.md', home)
    expect(result.kind).toBe('file')
    expect(result.openable).toBe(true)
    expect(result.resolved).toBe(join(home, 'project/README.md'))
  })

  it('refuses to call a folder openable', () => {
    const result = completePath('~/project/docs', home)
    expect(result.kind).toBe('directory')
    expect(result.openable).toBe(false)
    // Still offered as a suggestion, so one more keystroke walks into it.
    expect(result.entries.map(e => e.name)).toEqual(['docs'])
  })

  it('separates a folder that is empty from one that is not there', () => {
    expect(completePath('~/project/', home).dirExists).toBe(true)
    expect(completePath('~/nope/', home).dirExists).toBe(false)
    expect(completePath('~/nope/', home).entries).toEqual([])
  })

  it('survives a typo mid-path rather than throwing', () => {
    expect(completePath('~/nope/deeper/x.md', home).kind).toBe('missing')
  })

  it('accepts the shapes a path is pasted in', () => {
    // `READ` also matches RELEASE.markdown as a subsequence; the prefix match
    // is what has to come first.
    expect(completePath(`${home}/project/READ`, home).entries[0]?.name).toBe('README.md')
    expect(completePath(`"${home}/project/README.md"`, home).openable).toBe(true)
    expect(completePath(`file://${home}/project/README.md`, home).openable).toBe(true)
  })
})

describe('pathColumns', () => {
  const chain = (input: string) => pathColumns(input, home)
  const dirs = (input: string) => chain(input).columns.map(c => c.dir.slice(home.length) || '~')

  it('walks home downwards, one column per level', () => {
    expect(dirs('~/project/docs/')).toEqual(['~', '/project', '/project/docs'])
  })

  it('stops at home rather than starting at the filesystem root', () => {
    // Otherwise the first two columns are always `Users` and your own account
    // name, which nobody is browsing.
    expect(dirs('~/')).toEqual(['~'])
  })

  it('starts at the root for a path outside home', () => {
    expect(pathColumns('/usr/', home).columns[0]?.dir).toBe('/')
  })

  it('marks the row each column is being read through', () => {
    const columns = chain('~/project/docs/').columns
    expect(columns[0]?.selected).toBe(join(home, 'project'))
    expect(columns[1]?.selected).toBe(join(home, 'project/docs'))
    // The last column leads nowhere yet — nothing is chosen inside it.
    expect(columns[2]?.selected).toBeNull()
  })

  it('marks the file itself when the path ends at one', () => {
    const columns = chain('~/project/README.md').columns
    expect(columns[columns.length - 1]?.selected).toBe(join(home, 'project/README.md'))
  })

  it('filters only the folder being read, never the columns behind it', () => {
    const columns = chain('~/project/RE').columns
    expect(columns[0]?.entries.some(e => e.name === 'project')).toBe(true)
    expect(columns[1]?.entries.map(e => e.name)).toEqual(['README.md', 'RELEASE.markdown'])
  })

  it('counts notes only in the folder being read', () => {
    // One `readdir` per row is affordable for the column you are looking at and
    // not for every ancestor of it.
    const columns = chain('~/project/').columns
    expect(columns[0]?.entries.find(e => e.name === 'project')?.noteCount).toBeUndefined()
    expect(columns[1]?.entries.find(e => e.name === 'docs')?.noteCount).toBe(1)
  })

  it('counts the markdown in every column, not only the one being read', () => {
    // The per-row counts stop at the folder in front of you because they cost a
    // `readdir` each; a column's own heading is one `readdir` per level, so the
    // headings behind you can afford to say how much is in them too.
    const columns = chain('~/project/docs/').columns
    expect(columns[1]?.noteCount).toBe(3) // plan.md, README.md, RELEASE.markdown
    expect(columns[2]?.noteCount).toBe(1)
  })

  it('counts a folder that is not there as empty rather than failing', () => {
    const columns = chain('~/project/nope/').columns
    expect(columns[columns.length - 1]?.noteCount).toBe(0)
  })

  it('reports a typo without losing the chain that is real', () => {
    const result = chain('~/project/nope/')
    expect(result.dirExists).toBe(false)
    expect(result.columns[1]?.entries.length).toBeGreaterThan(0)
    expect(result.columns[result.columns.length - 1]?.entries).toEqual([])
  })
})
