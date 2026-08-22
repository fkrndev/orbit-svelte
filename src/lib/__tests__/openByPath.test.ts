import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '$shared/types'

/**
 * Opening a note by naming where it is.
 *
 * Two promises worth pinning down. The note opens either way — whatever is
 * decided about the sidebar happens after the file is on screen, never instead
 * of it. And the folder question is only ever asked when there is something to
 * ask: a folder already in the sidebar has no decision left in it.
 */

const opened: Array<{ path: string; addRoot?: boolean }> = []
const addedRoots: string[] = []
const savedPatches: Array<Record<string, unknown>> = []

vi.mock('../rpcClient', () => ({
  isDesktop: true,
  api: {
    openPath: async (params: { path: string; addRoot?: boolean }) => {
      opened.push(params)
      return { path: params.path, content: '# hi', stat: { size: 4, mtimeMs: 1 } }
    },
    addRoot: async ({ path }: { path: string }) => {
      addedRoots.push(path)
      return { id: 'r1', path, name: path.slice(path.lastIndexOf('/') + 1), addedAt: 0, lastOpenedAt: 0, collapsed: false }
    },
    listRoots: async () => [],
    getMeta: async () => null,
    recordEvent: async () => undefined,
    saveSettings: async ({ patch }: { patch: Record<string, unknown> }) => {
      savedPatches.push(patch)
      return { ...DEFAULT_SETTINGS, ...patch }
    },
  },
}))

const { getState, setState } = await import('../store.svelte')
const { openByPath, resolveAddFolderPrompt } = await import('../actions')

function root(path: string) {
  return { id: path, path, name: path, addedAt: 0, lastOpenedAt: 0, collapsed: false }
}

beforeEach(() => {
  opened.length = 0
  addedRoots.length = 0
  savedPatches.length = 0
  setState({
    tabs: [],
    activePath: null,
    roots: [],
    addFolderPrompt: null,
    settings: { ...DEFAULT_SETTINGS },
  })
})

describe('openByPath', () => {
  it('opens the file without registering its folder', async () => {
    await openByPath('/elsewhere/project/README.md')
    expect(opened).toEqual([{ path: '/elsewhere/project/README.md', addRoot: false }])
    expect(getState().tabs.map(t => t.path)).toEqual(['/elsewhere/project/README.md'])
    expect(getState().activePath).toBe('/elsewhere/project/README.md')
    expect(addedRoots).toEqual([])
  })

  it('asks about the folder, by default', async () => {
    await openByPath('/elsewhere/project/README.md')
    expect(getState().addFolderPrompt).toEqual({
      filePath: '/elsewhere/project/README.md',
      folder: '/elsewhere/project',
    })
  })

  it('stays quiet when the folder is already in the sidebar', async () => {
    setState({ roots: [root('/elsewhere/project')] })
    await openByPath('/elsewhere/project/docs/README.md')
    expect(getState().addFolderPrompt).toBeNull()
    expect(addedRoots).toEqual([])
  })

  it('adds without asking once that is the preference', async () => {
    setState({ settings: { ...DEFAULT_SETTINGS, addFolderOnPathOpen: 'always' } })
    await openByPath('/elsewhere/project/README.md')
    expect(addedRoots).toEqual(['/elsewhere/project'])
    expect(getState().addFolderPrompt).toBeNull()
  })

  it('leaves the sidebar alone once that is the preference', async () => {
    setState({ settings: { ...DEFAULT_SETTINGS, addFolderOnPathOpen: 'never' } })
    await openByPath('/elsewhere/project/README.md')
    expect(addedRoots).toEqual([])
    expect(getState().addFolderPrompt).toBeNull()
    // Still opened — the preference is about the folder, not about the file.
    expect(getState().tabs).toHaveLength(1)
  })
})

describe('resolveAddFolderPrompt', () => {
  beforeEach(async () => {
    await openByPath('/elsewhere/project/README.md')
  })

  it('adds the folder and closes the question', async () => {
    await resolveAddFolderPrompt(true, false)
    expect(addedRoots).toEqual(['/elsewhere/project'])
    expect(getState().addFolderPrompt).toBeNull()
  })

  it('declining touches nothing', async () => {
    await resolveAddFolderPrompt(false, false)
    expect(addedRoots).toEqual([])
    expect(getState().settings.addFolderOnPathOpen).toBe('ask')
  })

  it('remembering a yes stops the asking', async () => {
    await resolveAddFolderPrompt(true, true)
    expect(getState().settings.addFolderOnPathOpen).toBe('always')
    expect(savedPatches.some(patch => patch.addFolderOnPathOpen === 'always')).toBe(true)
  })

  it('remembering a no stops it too', async () => {
    await resolveAddFolderPrompt(false, true)
    expect(getState().settings.addFolderOnPathOpen).toBe('never')
  })
})
