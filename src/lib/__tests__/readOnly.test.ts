import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Read-only mode, tested where it makes its promise: nothing reaches disk.
 *
 * The RPC layer is a spy that records every call, so each case asserts the thing
 * the user actually cares about — that `writeFile`, `renameFile`, `deleteFile`
 * and friends were never *asked* — rather than that some component looked
 * disabled. A control that is greyed out but still fires is the failure this is
 * here to catch.
 */

const calls: Array<{ method: string; params: unknown }> = []

vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, {
    get: (_target, method: string) => async (params?: unknown) => {
      calls.push({ method, params })
      // Enough of a response for the actions under test to keep going.
      if (method === 'writeFile') return { stat: { size: 0, mtimeMs: 2 }, conflict: false }
      if (method === 'createFile') {
        return { path: '/notes/new.md', content: '', stat: { size: 0, mtimeMs: 1 } }
      }
      return undefined
    },
  }),
  isDesktop: true,
}))

const { getState, setState } = await import('../store.svelte')
const actions = await import('../actions')
const { DEFAULT_SETTINGS } = await import('../../shared/types')

const TAB = {
  path: '/notes/a.md',
  name: 'a.md',
  content: '---\ntitle: A\n---\nhello',
  savedContent: '---\ntitle: A\n---\nhello',
  mtimeMs: 1,
  meta: null,
  conflict: false,
  missing: false,
}

/** Every RPC that would change a file, whether or not it was expected here. */
const wrote = () =>
  calls.filter(call =>
    ['writeFile', 'createFile', 'renameFile', 'renameFolder', 'deleteFile', 'saveAsset'].includes(
      call.method,
    ),
  )

beforeEach(() => {
  calls.length = 0
  setState({
    settings: { ...DEFAULT_SETTINGS, readOnly: true },
    tabs: [{ ...TAB }],
    activePath: TAB.path,
    rename: null,
    confirmDelete: null,
  })
})

describe('read-only mode', () => {
  it('refuses text typed into the buffer', () => {
    actions.setTabContent(TAB.path, 'something else entirely')
    expect(getState().tabs[0]!.content).toBe(TAB.content)
  })

  /**
   * The case that matters most, because it is the one that looks harmless.
   * Frontmatter is edited from a side panel rather than by typing, so it is easy
   * to leave out of a rule about "editing".
   */
  it('refuses a frontmatter property, and leaves the buffer byte-identical', () => {
    actions.setProperty(TAB.path, 'status', 'published')
    actions.removeProperty(TAB.path, 'title')
    expect(getState().tabs[0]!.content).toBe(TAB.content)
  })

  it('does not open the rename or delete dialogs', () => {
    actions.startRename(TAB.path)
    actions.startDelete(TAB.path)
    expect(getState().rename).toBe(null)
    expect(getState().confirmDelete).toBe(null)
  })

  it('creates no file', async () => {
    expect(await actions.createFileIn('/notes')).toBe(null)
    expect(wrote()).toEqual([])
  })

  /** Belt and braces: a buffer dirtied before the lock closed still cannot land. */
  it('refuses to save a tab that is already dirty', async () => {
    setState({ tabs: [{ ...TAB, content: 'edited before the lock' }] })
    expect(await actions.saveTab(TAB.path)).toBe(false)
    expect(wrote()).toEqual([])
  })

  it('refuses the conflict banner’s overwrite', async () => {
    setState({ tabs: [{ ...TAB, content: 'mine', conflict: true }] })
    await actions.forceSave(TAB.path)
    expect(wrote()).toEqual([])
  })

  it('asks for no file write at all across every refused action', async () => {
    actions.setTabContent(TAB.path, 'x')
    actions.setProperty(TAB.path, 'k', 'v')
    actions.startRename(TAB.path)
    actions.startDelete(TAB.path)
    await actions.createFileIn('/notes')
    await actions.saveTab(TAB.path)
    expect(wrote()).toEqual([])
  })
})

describe('leaving read-only', () => {
  /**
   * Turning the mode *on* flushes first. Without this the buffer stays dirty
   * with no way to write it, and the edit sits there looking saved until the app
   * is closed — a protection that costs you the paragraph you just wrote.
   */
  it('writes pending edits to disk before the lock closes', async () => {
    setState({
      settings: { ...DEFAULT_SETTINGS, readOnly: false },
      tabs: [{ ...TAB, content: 'typed just now' }],
    })

    await actions.toggleReadOnly()

    expect(getState().settings.readOnly).toBe(true)
    const write = calls.find(call => call.method === 'writeFile')
    expect(write?.params).toMatchObject({ path: TAB.path, content: 'typed just now' })
  })

  it('accepts edits again once it is off', async () => {
    await actions.toggleReadOnly()
    expect(getState().settings.readOnly).toBe(false)
    actions.setTabContent(TAB.path, 'now writable')
    expect(getState().tabs[0]!.content).toBe('now writable')
  })
})
