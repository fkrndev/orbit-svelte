import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '$shared/types'
import { browsedDir, newNoteName, UNTITLED_NOTE } from '../quickOpenPath'

/**
 * Creating a note, and opening a folder, from the page that names places.
 *
 * The failure worth pinning down is the quiet one: a new file written to a
 * folder nobody was looking at. ⌘N used to mean "beside the active tab" no
 * matter which surface you were on, so pressing it in the browser put the note
 * next to whatever had been left open — a file created out of sight, in a
 * folder the user had navigated away from.
 *
 * The other half is the folder itself. Adding a root while the browser is on
 * screen used to change nothing visible, because that page hides the very
 * sidebar the folder was added to.
 */

const created: Array<{ dir: string; name: string }> = []
const addedRoots: string[] = []
let addFails = false

vi.mock('../rpcClient', () => ({
  isDesktop: true,
  api: {
    createFile: async ({ dir, name }: { dir: string; name: string }) => {
      created.push({ dir, name })
      return { path: `${dir}/${name}`, content: '', stat: { size: 0, mtimeMs: 1 } }
    },
    addRoot: async ({ path }: { path: string }) => {
      if (addFails) throw new Error('nope')
      addedRoots.push(path)
      return {
        id: 'r1',
        path,
        name: path.slice(path.lastIndexOf('/') + 1),
        addedAt: 0,
        lastOpenedAt: 0,
        collapsed: false,
      }
    },
    listRoots: async () => [],
    getMeta: async () => null,
    saveSettings: async ({ patch }: { patch: Record<string, unknown> }) => ({
      ...DEFAULT_SETTINGS,
      ...patch,
    }),
  },
}))

const { getState, setState } = await import('../store.svelte')
type Tab = import('../store.svelte').Tab
const { createFileBesideActive, openFolderInSidebar } = await import('../actions')

function tab(path: string): Tab {
  return {
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    content: '',
    savedContent: '',
    mtimeMs: 1,
    meta: null,
    conflict: false,
    missing: false,
  }
}

beforeEach(() => {
  created.length = 0
  addedRoots.length = 0
  addFails = false
  setState({
    tabs: [],
    activePath: null,
    roots: [],
    surface: 'editor',
    settings: { ...DEFAULT_SETTINGS },
  })
})

describe('newNoteName', () => {
  it('names the file after the fragment left in the field', () => {
    expect(newNoteName('standup')).toBe('standup.md')
  })

  it('keeps a markdown extension the user typed rather than doubling it', () => {
    expect(newNoteName('standup.md')).toBe('standup.md')
    expect(newNoteName('standup.markdown')).toBe('standup.markdown')
  })

  it('falls back to the default when there is nothing to go on', () => {
    expect(newNoteName('')).toBe(UNTITLED_NOTE)
    expect(newNoteName('   ')).toBe(UNTITLED_NOTE)
  })

  it('refuses to quietly repair a name the rename rules would reject', () => {
    expect(newNoteName('../escape')).toBe(UNTITLED_NOTE)
    expect(newNoteName('..')).toBe(UNTITLED_NOTE)
    expect(newNoteName('a:b')).toBe(UNTITLED_NOTE)
  })
})

describe('browsedDir', () => {
  it('drops the trailing slash the stored query carries', () => {
    expect(browsedDir('/Users/me/notes/')).toBe('/Users/me/notes')
  })

  it('keeps the root a folder rather than reducing it to nothing', () => {
    expect(browsedDir('/')).toBe('/')
  })

  it('has no answer before anywhere has been browsed', () => {
    expect(browsedDir('')).toBeNull()
    expect(browsedDir('~/notes/')).toBeNull()
  })
})

describe('createFileBesideActive', () => {
  it('writes into the browsed folder while the browser is on screen', async () => {
    setState({
      surface: 'browse',
      tabs: [tab('/elsewhere/old.md')],
      activePath: '/elsewhere/old.md',
      settings: { ...DEFAULT_SETTINGS, browsePath: '/Users/me/notes/' },
    })

    await createFileBesideActive()

    expect(created).toEqual([{ dir: '/Users/me/notes', name: 'untitled.md' }])
  })

  it('still lands beside the active tab everywhere else', async () => {
    setState({
      surface: 'editor',
      tabs: [tab('/elsewhere/old.md')],
      activePath: '/elsewhere/old.md',
      settings: { ...DEFAULT_SETTINGS, browsePath: '/Users/me/notes/' },
    })

    await createFileBesideActive()

    expect(created).toEqual([{ dir: '/elsewhere', name: 'untitled.md' }])
  })

  it('opens the new note in a tab, on the surface that can show it', async () => {
    setState({ surface: 'browse', settings: { ...DEFAULT_SETTINGS, browsePath: '/Users/me/notes/' } })

    await createFileBesideActive()

    expect(getState().surface).toBe('editor')
    expect(getState().activePath).toBe('/Users/me/notes/untitled.md')
  })
})

describe('openFolderInSidebar', () => {
  it('leaves the browser, which was covering the sidebar it just filled', async () => {
    setState({ surface: 'browse' })

    await openFolderInSidebar('/Users/me/notes')

    expect(addedRoots).toEqual(['/Users/me/notes'])
    expect(getState().surface).toBe('editor')
    expect(getState().settings.sidebarPanel).toBe('files')
  })

  it('stays put when the folder could not be added', async () => {
    addFails = true
    setState({ surface: 'browse' })

    await openFolderInSidebar('/Users/me/notes')

    expect(getState().surface).toBe('browse')
  })
})
