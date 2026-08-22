import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tags and mentions read from the documents themselves.
 *
 * There is a `tags` field in the sidecar too, and it is a trap: it was written
 * by a panel that no longer exists, so every count taken from it is zero. The
 * tags people actually have are in the file — the `tags:` property the
 * properties panel edits, *and* the `#tag`s written in the prose, which are one
 * thing here because they are one thing to the person who wrote them.
 */
let root = ''

vi.mock('../roots', () => ({
  liveRoots: () => [{ id: 'r1', path: root, name: 'notes' }],
  rootIdForPath: () => 'r1',
}))

// Frecency ranks the hits. Flat here, so the tie-breakers below are what the
// assertions are actually testing.
vi.mock('../history', () => ({ scoreByPath: () => new Map() }))

const { hitsForRef, invalidateTagCache, pathsWithRef, pathsWithTag, refCounts, tagCounts } =
  await import('../tagIndex')

const note = (name: string, frontmatter: string, body = 'text\n') =>
  writeFileSync(join(root, name), `---\n${frontmatter}\n---\n\n${body}`)

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'tagindex-'))
  mkdirSync(join(root, 'deep'), { recursive: true })

  note('a.md', 'tags:\n  - draft\n  - kampus')
  note('b.md', 'tags: [draft]')
  note('c.md', 'status: done')
  writeFileSync(join(root, 'plain.md'), 'No frontmatter at all.\n')
  writeFileSync(join(root, 'deep/d.md'), '---\ntags:\n  - Draft\n---\n\ntext\n')

  // Prose refs. `prose.md` says `#draft` in a file whose property already says
  // it, which is the case that decides whether the two lists are one thing.
  note('prose.md', 'tags: [draft]', 'Kirim ke @budi soal #draft dan #rilis.\n')
  writeFileSync(
    join(root, 'notes.md'),
    'Tanya @budi lagi.\n\n@budi bilang oke, #rilis minggu depan.\n',
  )
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

beforeEach(() => invalidateTagCache())

describe('tagCounts', () => {
  it('counts a tag across the vault', () => {
    // `Draft` in the third file is the same tag as `draft`; nothing else in the
    // app treats case as meaningful.
    expect(tagCounts().find(entry => entry.tag === 'draft')?.count).toBe(4)
  })

  it('reads both YAML list shapes', () => {
    expect(tagCounts().map(entry => entry.tag)).toContain('kampus')
  })

  it('leaves out files with no tags at all', () => {
    expect(tagCounts().every(entry => entry.count > 0)).toBe(true)
    expect(tagCounts().map(entry => entry.tag)).not.toContain('done')
  })

  it('puts the most used tag first', () => {
    expect(tagCounts()[0]?.tag).toBe('draft')
  })
})

describe('pathsWithTag', () => {
  it('finds every file carrying the tag', () => {
    expect(pathsWithTag('draft')).toHaveLength(4)
  })

  it('matches regardless of case', () => {
    expect(pathsWithTag('DRAFT')).toEqual(pathsWithTag('draft'))
  })

  it('is empty for a tag nobody used', () => {
    expect(pathsWithTag('nonexistent')).toEqual([])
  })
})

describe('tags written in the prose', () => {
  it('counts a `#tag` nobody put in frontmatter', () => {
    expect(tagCounts().find(entry => entry.tag === 'rilis')?.count).toBe(2)
  })

  it('counts a note once when the property and the prose agree', () => {
    // `prose.md` carries `tags: [draft]` *and* writes `#draft` in the body. A
    // chip that said 5 here would be counting spellings, not notes.
    expect(pathsWithTag('draft').filter(path => path.endsWith('prose.md'))).toHaveLength(1)
  })

  it('reaches a file with no frontmatter at all', () => {
    expect(pathsWithRef('tag', 'rilis').some(path => path.endsWith('notes.md'))).toBe(true)
  })
})

describe('mentions', () => {
  it('counts the notes a name appears in, not the times it is written', () => {
    // `notes.md` says `@budi` twice; it is still one note to open.
    expect(refCounts('mention')).toEqual([{ label: 'budi', count: 2 }])
  })

  it('is a separate namespace from tags', () => {
    expect(pathsWithRef('tag', 'budi')).toEqual([])
    expect(pathsWithRef('mention', 'draft')).toEqual([])
  })
})

describe('hitsForRef', () => {
  it('reports where in the file to land, and how busy the file is', () => {
    const hits = hitsForRef('mention', 'budi')
    const busiest = hits.find(hit => hit.name === 'notes.md')
    expect(busiest?.count).toBe(2)
    // First line of a file with no frontmatter — 0-based, as `line` is
    // documented, so opening the note can jump straight to it.
    expect(busiest?.line).toBe(0)
  })

  it('puts the note that uses it most first, frecency being equal', () => {
    expect(hitsForRef('mention', 'budi').map(hit => hit.name)).toEqual(['notes.md', 'prose.md'])
  })

  it('says nothing for a ref nobody wrote', () => {
    expect(hitsForRef('mention', 'nobody')).toEqual([])
    expect(hitsForRef('tag', '  ')).toEqual([])
  })
})

describe('cache', () => {
  it('serves a repeat call without re-reading', () => {
    tagCounts()
    note('e.md', 'tags: [fresh]')
    expect(tagCounts().map(entry => entry.tag)).not.toContain('fresh')
  })

  it('re-reads the root a changed file belongs to', () => {
    tagCounts()
    note('e.md', 'tags: [fresh]')
    invalidateTagCache(join(root, 'e.md'))
    expect(tagCounts().map(entry => entry.tag)).toContain('fresh')
  })
})
