import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Collapse All has two halves that live in different places: the folders inside
 * a root are keys in `tree.expanded`, while a root's own open/closed flag is a
 * field on the root record. Clearing only the tree left every root header still
 * open — with one root and nothing expanded under it, the button did visibly
 * nothing at all.
 */
const setRootCollapsed = vi.fn(async () => undefined)

vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'setRootCollapsed' ? setRootCollapsed : vi.fn(async () => undefined)),
  }),
  isDesktop: true,
}))

const { getState, setState } = await import('../store.svelte')
const { collapseEverything } = await import('../sidebar')
const { expandMany } = await import('../tree')

function root(id: string, path: string, collapsed?: boolean) {
  return { id, path, name: path.split('/').pop() ?? path, addedAt: 0, lastOpenedAt: 0, collapsed }
}

beforeEach(() => {
  setRootCollapsed.mockClear()
  setState({
    roots: [root('a', '/vault/docs-id'), root('b', '/vault/notes')],
    tree: expandMany({ expanded: new Set() }, ['/vault/docs-id/assets']),
  })
})

describe('collapseEverything', () => {
  it('closes the folders inside every root', async () => {
    await collapseEverything()
    expect(getState().tree.expanded.size).toBe(0)
  })

  it('closes the root headers too', async () => {
    await collapseEverything()
    expect(getState().roots.map(entry => entry.collapsed)).toEqual([true, true])
  })

  it('persists the collapsed roots', async () => {
    await collapseEverything()
    expect(setRootCollapsed).toHaveBeenCalledWith({ id: 'a', collapsed: true })
    expect(setRootCollapsed).toHaveBeenCalledWith({ id: 'b', collapsed: true })
  })

  it('does not re-write a root that was already collapsed', async () => {
    setState({ roots: [root('a', '/vault/docs-id', true), root('b', '/vault/notes')] })
    await collapseEverything()
    expect(setRootCollapsed).toHaveBeenCalledTimes(1)
    expect(setRootCollapsed).toHaveBeenCalledWith({ id: 'b', collapsed: true })
  })

  it('swallows a failed write, keeping the sidebar closed', async () => {
    setRootCollapsed.mockImplementation(async () => {
      throw new Error('disk full')
    })
    await expect(collapseEverything()).resolves.toBeUndefined()
    expect(getState().roots.every(entry => entry.collapsed)).toBe(true)
  })
})
