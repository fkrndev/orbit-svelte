import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Switching view is a request to carry on writing in the other one.
 *
 * Both the toolbar button and ⌘/ land here, so this is where the two things
 * that used to be missing are pinned: the caret follows the switch, and a code
 * file says why it cannot switch instead of doing nothing.
 */
const saveSettings = vi.fn(async () => undefined)
const focus = vi.fn()

vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'saveSettings' ? saveSettings : vi.fn(async () => undefined)),
  }),
  isDesktop: true,
}))

const { getState, setState } = await import('../store.svelte')
const { toggleEditorMode } = await import('../actions')
const { registerFindEngine, unregisterFindEngine } = await import('../find')
const { DEFAULT_SETTINGS } = await import('../../shared/types')
const { EMPTY_FIND } = await import('../store.svelte')

/** Stands in for whichever editor is mounted — all the switch needs is `focus`. */
const engine = {
  text: '',
  highlight: vi.fn(),
  clearHighlights: vi.fn(),
  reveal: vi.fn(),
  replaceOne: vi.fn(),
  replaceAll: vi.fn(),
  focus,
}

beforeEach(() => {
  saveSettings.mockClear()
  focus.mockClear()
  setState({ settings: { ...DEFAULT_SETTINGS, editorMode: 'rich' }, find: { ...EMPTY_FIND } })
  registerFindEngine(engine)
})

describe('toggleEditorMode', () => {
  it('flips the setting and persists it', async () => {
    await toggleEditorMode('/notes/plan.md')
    expect(getState().settings.editorMode).toBe('raw')
    expect(saveSettings).toHaveBeenCalledWith({ patch: { editorMode: 'raw' } })

    await toggleEditorMode('/notes/plan.md')
    expect(getState().settings.editorMode).toBe('rich')
  })

  it('hands the caret to the editor that arrives', async () => {
    await toggleEditorMode('/notes/plan.md')
    expect(focus).toHaveBeenCalled()
  })

  it('says why a code file cannot switch, and changes nothing', async () => {
    await toggleEditorMode('/app/main.go')
    expect(getState().settings.editorMode).toBe('rich')
    expect(saveSettings).not.toHaveBeenCalled()
    expect(focus).not.toHaveBeenCalled()
    expect(getState().notice?.text).toBe('Code files only open as source')
  })

  it('does not reach for an editor that is not mounted', async () => {
    unregisterFindEngine(engine)
    await expect(toggleEditorMode('/notes/plan.md')).resolves.toBeUndefined()
    expect(getState().settings.editorMode).toBe('raw')
  })
})
