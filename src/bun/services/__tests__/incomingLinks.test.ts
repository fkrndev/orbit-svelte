import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * "Which of the folders I have open link to this file?"
 *
 * The interesting cases are all about *not* over-claiming: same-named files in
 * other folders, links inside code fences, and images — each of which would
 * turn a precise answer into a plausible-looking wrong one.
 */

let root = ''

vi.mock('../roots', () => ({
  liveRoots: () => [{ id: 'r1', path: root, name: 'root', collapsed: false, pinned: false }],
}))

const { findIncomingLinks } = await import('../incomingLinks')

const linkersOf = (path: string) =>
  findIncomingLinks(path)
    .hits.map(hit => hit.name)
    .sort()

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'incoming-links-'))
  mkdirSync(join(root, 'clients'), { recursive: true })
  mkdirSync(join(root, 'archive'), { recursive: true })

  writeFileSync(join(root, 'plan.md'), '# Plan\n')
  // Up one folder — the ordinary shape of a link between two notes.
  writeFileSync(join(root, 'clients/acme.md'), 'Agreed in [the plan](../plan.md).\n')
  // Same file, reached without a leading `./`, and twice.
  writeFileSync(join(root, 'clients/beta.md'), '[a](../plan.md)\n\n[b](../plan.md#scope)\n')
  // A different plan.md entirely, in this folder.
  writeFileSync(join(root, 'clients/plan.md'), '# Client plan\n')
  writeFileSync(join(root, 'clients/local.md'), 'See [plan](./plan.md).\n')
  // Mentions the name, but only inside a fence and as an image.
  writeFileSync(
    join(root, 'archive/sample.md'),
    ['```md', '[x](../plan.md)', '```', '', '![shot](../plan.md)'].join('\n'),
  )
  // Mentions the name in prose without linking it.
  writeFileSync(join(root, 'archive/mentions.md'), 'The plan.md file is elsewhere.\n')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('findIncomingLinks', () => {
  it('finds the files that link to the target', () => {
    expect(linkersOf(join(root, 'plan.md'))).toEqual(['acme.md', 'beta.md'])
  })

  it('does not confuse a same-named file in another folder', () => {
    expect(linkersOf(join(root, 'clients/plan.md'))).toEqual(['local.md'])
  })

  it('counts every link in a file but returns the file once', () => {
    const hit = findIncomingLinks(join(root, 'plan.md')).hits.find(h => h.name === 'beta.md')
    expect(hit?.count).toBe(2)
    expect(hit?.line).toBe(0)
  })

  it('reports how many files it read, so an empty answer is not read as "none exist"', () => {
    const scan = findIncomingLinks(join(root, 'archive/mentions.md'))
    expect(scan.hits).toEqual([])
    expect(scan.scanned).toBeGreaterThan(0)
    expect(scan.truncated).toBe(false)
  })

  it('never reports the file as linking to itself', () => {
    const self = join(root, 'clients/beta.md')
    writeFileSync(self, '[a](../plan.md)\n[me](./beta.md)\n')
    expect(findIncomingLinks(self).hits.map(hit => hit.path)).not.toContain(self)
  })

  it('shows the line the link is on, for context', () => {
    const hit = findIncomingLinks(join(root, 'plan.md')).hits.find(h => h.name === 'acme.md')
    expect(hit?.excerpt).toBe('Agreed in [the plan](../plan.md).')
    expect(hit?.folder).toBe('clients')
  })

  it('stops at the limit and says so rather than trimming silently', () => {
    const scan = findIncomingLinks(join(root, 'plan.md'), 1)
    expect(scan.hits).toHaveLength(1)
    expect(scan.truncated).toBe(true)
  })
})
