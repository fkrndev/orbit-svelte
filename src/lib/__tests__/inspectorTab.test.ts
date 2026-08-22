import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The inspector's three views are reached by three commands, and each one has
 * to answer two questions at once: which tab to show, and whether the pane
 * should be on screen at all. Pressing the command for the tab you are already
 * looking at is the way back out — otherwise ⌘I would be a key that can only
 * ever open something.
 */
const saveSettings = vi.fn(async () => undefined)

vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'saveSettings' ? saveSettings : vi.fn(async () => undefined)),
  }),
  isDesktop: true,
}))

const { getState, setState } = await import('../store.svelte')
const { showInspectorTab } = await import('../actions')
const { DEFAULT_SETTINGS } = await import('../../shared/types')

beforeEach(() => {
  saveSettings.mockClear()
  setState({ settings: { ...DEFAULT_SETTINGS } })
})

describe('showInspectorTab', () => {
  it('switches tab without closing the pane', () => {
    showInspectorTab('outline')
    expect(getState().settings.inspectorTab).toBe('outline')
    expect(getState().settings.inspectorOpen).toBe(true)
  })

  it('reopens the pane on the tab that was asked for', () => {
    setState(prev => ({ settings: { ...prev.settings, inspectorOpen: false } }))
    showInspectorTab('todos')
    expect(getState().settings).toMatchObject({ inspectorOpen: true, inspectorTab: 'todos' })
  })

  it('closes the pane when the visible tab is asked for again', () => {
    showInspectorTab('outline')
    showInspectorTab('outline')
    expect(getState().settings.inspectorOpen).toBe(false)
    // The tab is remembered, so reopening lands where the user left off.
    expect(getState().settings.inspectorTab).toBe('outline')
  })

  it('does not count a hidden tab as the visible one', () => {
    setState(prev => ({ settings: { ...prev.settings, inspectorOpen: false, inspectorTab: 'info' } }))
    showInspectorTab('info')
    expect(getState().settings.inspectorOpen).toBe(true)
  })

  it('persists both halves in one write', () => {
    showInspectorTab('todos')
    expect(saveSettings).toHaveBeenCalledWith({
      patch: { inspectorOpen: true, inspectorTab: 'todos' },
    })
  })

  it('swallows a failed write', async () => {
    saveSettings.mockImplementation(async () => {
      throw new Error('disk full')
    })
    await expect(showInspectorTab('outline')).resolves.toBeUndefined()
    expect(getState().settings.inspectorTab).toBe('outline')
  })
})
