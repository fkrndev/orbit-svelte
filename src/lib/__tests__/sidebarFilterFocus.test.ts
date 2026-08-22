import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ⇧⌘F asks the sidebar's filter box for focus.
 *
 * All three panels have one now, and they filter different things — Files
 * searches every root, Recents narrows the rows it is holding, Bookmarks
 * narrows the list you arranged. So the shortcut has to land on the panel you
 * are looking at rather than always dragging you to Files, which would leave
 * the other two boxes unreachable from the keyboard.
 */
vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, { get: () => vi.fn(async () => undefined) }),
  isDesktop: true,
}))

const { getState, setState } = await import('../store.svelte')
const { focusSidebarFilter } = await import('../sidebar')
const { DEFAULT_SETTINGS } = await import('../../shared/types')

const panel = () => getState().settings.sidebarPanel
const requests = () => getState().sidebar.focusFilter

beforeEach(() => {
  setState({
    settings: { ...DEFAULT_SETTINGS },
    sidebar: { query: '', filter: null, filtering: false, focusFilter: 0 },
  })
})

describe('focusSidebarFilter', () => {
  it('focuses the tree filter when the tree is showing', () => {
    focusSidebarFilter()
    expect(panel()).toBe('files')
    expect(requests()).toBe(1)
  })

  it('stays on Recents, which has a filter of its own', () => {
    setState(prev => ({ settings: { ...prev.settings, sidebarPanel: 'recents' } }))
    focusSidebarFilter()
    expect(panel()).toBe('recents')
    expect(requests()).toBe(1)
  })

  it('stays on Bookmarks, which has a filter of its own too', () => {
    setState(prev => ({ settings: { ...prev.settings, sidebarPanel: 'bookmarks' } }))
    focusSidebarFilter()
    expect(panel()).toBe('bookmarks')
    expect(requests()).toBe(1)
  })

  it('counts each press, so the second one re-selects rather than doing nothing', () => {
    focusSidebarFilter()
    focusSidebarFilter()
    expect(requests()).toBe(2)
  })
})
