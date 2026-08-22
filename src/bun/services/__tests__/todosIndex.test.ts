import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The cross-file todo scan behind Home.
 *
 * Reading every file to answer one question is the expensive thing this app
 * does, so the tests pin down the two properties that make it affordable: the
 * cap is reported rather than swallowed, and a second call inside the window
 * does not touch the disk again.
 */

let root = ''
let other = ''

vi.mock('../roots', () => ({
  liveRoots: () => [
    { id: 'r1', path: root, name: 'notes' },
    { id: 'r2', path: other, name: 'archive' },
  ],
  rootIdForPath: (path: string) => (path.startsWith(`${root}/`) ? 'r1' : 'r2'),
}))

// Ordering is by how much you actually use a file; the scan itself has no
// opinion about that, it asks history.
const scores = new Map<string, number>()
vi.mock('../history', () => ({ scoreByPath: () => scores }))

const { invalidateTodosCache, listTodos } = await import('../todosIndex')

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'todos-'))
  other = mkdtempSync(join(tmpdir(), 'todos-other-'))
  mkdirSync(join(root, 'deep'), { recursive: true })

  writeFileSync(
    join(root, 'plan.md'),
    ['# Plan', '', '- [ ] write the thing', '- [x] read the thing', ''].join('\n'),
  )
  writeFileSync(
    join(root, 'deep/notes.md'),
    ['- [ ] buried task', '', '```', '- [ ] not a task, it is a code sample', '```', ''].join('\n'),
  )
  writeFileSync(join(root, 'prose.md'), 'Just words, no checklist.\n')
  writeFileSync(join(other, 'old.md'), '- [ ] archived task\n')
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(other, { recursive: true, force: true })
})

beforeEach(() => {
  scores.clear()
  invalidateTodosCache()
})

describe('listTodos', () => {
  it('finds unchecked tasks across folders', () => {
    const texts = listTodos({}).items.map(hit => hit.text)
    expect(texts).toContain('write the thing')
    expect(texts).toContain('buried task')
    expect(texts).toContain('archived task')
  })

  it('leaves finished tasks out of the list', () => {
    expect(listTodos({}).items.map(hit => hit.text)).not.toContain('read the thing')
  })

  it('still counts finished tasks in the file tally', () => {
    expect(listTodos({}).byFile[join(root, 'plan.md')]).toEqual({ total: 2, open: 1 })
  })

  it('has no tally for a file without a checklist', () => {
    expect(listTodos({}).byFile[join(root, 'prose.md')]).toBeUndefined()
  })

  it('does not mistake a checklist inside a fenced block for a task', () => {
    const texts = listTodos({}).items.map(hit => hit.text)
    expect(texts).not.toContain('not a task, it is a code sample')
  })

  it('carries the line so opening the file can land on the task', () => {
    const hit = listTodos({}).items.find(entry => entry.text === 'write the thing')
    expect(hit).toMatchObject({ line: 2, section: 'Plan', name: 'plan.md', rootId: 'r1' })
  })

  it('can be narrowed to one root', () => {
    const scan = listTodos({ rootId: 'r2' })
    expect(scan.items.map(hit => hit.text)).toEqual(['archived task'])
  })

  it('puts the files you actually use first', () => {
    scores.set(join(root, 'deep/notes.md'), 900)
    scores.set(join(root, 'plan.md'), 10)
    expect(listTodos({}).items[0]?.text).toBe('buried task')
  })

  it('reports a truncated list rather than quietly shortening it', () => {
    const scan = listTodos({ limit: 1 })
    expect(scan.items).toHaveLength(1)
    expect(scan.truncated).toBe(true)
    expect(scan.total).toBe(3)
  })

  it('says nothing was truncated when everything fits', () => {
    expect(listTodos({}).truncated).toBe(false)
  })
})

describe('cache', () => {
  it('does not re-read the disk for a repeat call', () => {
    listTodos({})
    writeFileSync(join(root, 'plan.md'), '- [ ] written behind the cache\n')
    expect(listTodos({}).items.map(hit => hit.text)).not.toContain('written behind the cache')
  })

  it('re-reads the root a changed file belongs to', () => {
    listTodos({})
    writeFileSync(join(root, 'plan.md'), '- [ ] written after invalidating\n')
    invalidateTodosCache(join(root, 'plan.md'))
    expect(listTodos({}).items.map(hit => hit.text)).toContain('written after invalidating')
  })

  it('leaves other roots cached when one file changes', () => {
    listTodos({})
    writeFileSync(join(other, 'old.md'), '- [ ] changed in the other root\n')
    invalidateTodosCache(join(root, 'plan.md'))
    expect(listTodos({}).items.map(hit => hit.text)).not.toContain('changed in the other root')
  })
})
