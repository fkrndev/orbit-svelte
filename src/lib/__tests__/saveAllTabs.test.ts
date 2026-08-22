import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tab } from '../store.svelte'

/**
 * The one guarantee behind ⌘R: reloading the view must not be a way to lose
 * work. Autosave runs on an idle timer, so at the moment a reload is triggered
 * there is almost always a buffer the timer has not flushed yet — and the tabs
 * you are *not* looking at are the ones you would never think to check.
 */

const writes: { path: string; content: string }[] = []
let failOn: string | null = null

vi.mock('../rpcClient', () => ({
  isDesktop: true,
  api: {
    writeFile: async ({ path, content }: { path: string; content: string }) => {
      if (path === failOn) throw new Error('disk on fire')
      writes.push({ path, content })
      return { conflict: false, stat: { mtimeMs: 200 } }
    },
    recordEvent: async () => undefined,
  },
}))

const { getState, setState } = await import('../store.svelte')
const { saveAllTabs } = await import('../actions')

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
  failOn = null
  setState({
    tabs: [
      tab('/v/clean.md', 'same', 'same'),
      tab('/v/one.md', 'edited one', 'one'),
      tab('/v/two.md', 'edited two', 'two'),
    ],
    activePath: '/v/one.md',
  })
})

describe('saveAllTabs', () => {
  it('writes every dirty buffer, not just the visible one', async () => {
    await saveAllTabs()
    expect(writes.map(w => w.path)).toEqual(['/v/one.md', '/v/two.md'])
  })

  it('leaves a clean tab alone', async () => {
    await saveAllTabs()
    expect(writes.some(w => w.path === '/v/clean.md')).toBe(false)
  })

  it('marks what it wrote as saved, so the reload starts clean', async () => {
    await saveAllTabs()
    const dirty = getState().tabs.filter(t => t.content !== t.savedContent)
    expect(dirty).toEqual([])
  })

  it('keeps going when one file fails', async () => {
    // A single unwritable file must not strand the buffers behind it — losing
    // two documents because of one is strictly worse than losing one.
    failOn = '/v/one.md'
    await saveAllTabs()
    expect(writes.map(w => w.path)).toEqual(['/v/two.md'])
    expect(getState().tabs.find(t => t.path === '/v/two.md')?.savedContent).toBe('edited two')
  })
})
