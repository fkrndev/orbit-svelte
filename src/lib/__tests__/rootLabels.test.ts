import { describe, expect, it } from 'vitest'
import { folderLabels, rootLabels } from '@/components/sidebar/names'

const root = (path: string) => ({ path, name: path.slice(path.lastIndexOf('/') + 1) })

describe('rootLabels', () => {
  it('leaves a unique name alone', () => {
    const labels = rootLabels([root('/a/docs'), root('/a/notes')])
    expect(labels.get('/a/docs')).toBe('docs')
    expect(labels.get('/a/notes')).toBe('notes')
  })

  it('adds the parent folder when names collide', () => {
    const labels = rootLabels([root('/p/orbit/docs'), root('/p/crm/docs')])
    expect(labels.get('/p/orbit/docs')).toBe('docs — orbit')
    expect(labels.get('/p/crm/docs')).toBe('docs — crm')
  })

  it('walks further up when the parents collide too', () => {
    const labels = rootLabels([root('/p/a/src/docs'), root('/p/b/src/docs')])
    expect(labels.get('/p/a/src/docs')).toBe('docs — a/src')
    expect(labels.get('/p/b/src/docs')).toBe('docs — b/src')
  })
})

describe('folderLabels', () => {
  it('names the folder of each file, keyed by folder path', () => {
    const labels = folderLabels(['/p/orbit/docs/README.md', '/p/orbit/notes/todo.md'])
    expect(labels.get('/p/orbit/docs')).toBe('docs')
    expect(labels.get('/p/orbit/notes')).toBe('notes')
  })

  it('grows the badge when two projects both call it docs', () => {
    const labels = folderLabels(['/p/orbit/docs/README.md', '/p/crm/docs/README.md'])
    expect(labels.get('/p/orbit/docs')).toBe('docs — orbit')
    expect(labels.get('/p/crm/docs')).toBe('docs — crm')
  })

  it('collapses repeats of the same folder into one entry', () => {
    const labels = folderLabels(['/p/orbit/docs/a.md', '/p/orbit/docs/b.md'])
    expect(labels.size).toBe(1)
    expect(labels.get('/p/orbit/docs')).toBe('docs')
  })
})
