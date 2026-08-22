import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tab } from '../store.svelte'

/**
 * Closing tabs in bulk has to keep the promise the single close already makes:
 * a tab with unsaved edits is written on the way out, never dropped. Doing it to
 * five tabs at once is exactly when nobody is watching for the ones that were
 * dirty.
 */

const writes: string[] = []

vi.mock('../rpcClient', () => ({
  isDesktop: true,
  api: {
    writeFile: async ({ path }: { path: string }) => {
      writes.push(path)
      return { conflict: false, stat: { mtimeMs: 200 } }
    },
    recordEvent: async () => undefined,
    saveSettings: async () => undefined,
  },
}))

const { getState, setState } = await import('../store.svelte')
const { closeAllTabs, closeOtherTabs } = await import('../actions')

function tab(path: string, content: string, savedContent: string): Tab {
  return {
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    content,
    savedContent,
    mtimeMs: 100,
    meta: null,
    conflict: false,
    missing: false,
  }
}

beforeEach(() => {
  writes.length = 0
  setState({
    tabs: [
      tab('/v/one.md', 'one', 'one'),
      tab('/v/two.md', 'edited two', 'two'),
      tab('/v/three.md', 'three', 'three'),
    ],
    activePath: '/v/two.md',
    surface: 'editor',
  })
})

describe('closeOtherTabs', () => {
  it('leaves only the named tab open', () => {
    closeOtherTabs('/v/two.md')
    expect(getState().tabs.map(t => t.path)).toEqual(['/v/two.md'])
  })

  it('keeps that tab active even when it was not the one in view', () => {
    setState({ activePath: '/v/one.md' })
    closeOtherTabs('/v/two.md')
    expect(getState().activePath).toBe('/v/two.md')
    expect(getState().surface).toBe('editor')
  })

  it('flushes the buffers it closes', async () => {
    setState({ activePath: '/v/one.md' })
    closeOtherTabs('/v/one.md')
    await Promise.resolve()
    expect(writes).toEqual(['/v/two.md'])
  })
})

describe('closeAllTabs', () => {
  it('empties the strip', () => {
    closeAllTabs()
    expect(getState().tabs).toEqual([])
  })

  it('falls back to the dashboard, because there is no file left to show', () => {
    closeAllTabs()
    expect(getState().activePath).toBeNull()
    expect(getState().surface).toBe('dashboard')
  })

  it('flushes every dirty buffer on the way out', async () => {
    closeAllTabs()
    await Promise.resolve()
    expect(writes).toEqual(['/v/two.md'])
  })
})
