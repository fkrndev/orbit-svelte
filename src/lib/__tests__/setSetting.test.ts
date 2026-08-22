import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `setSetting` is the single writer for every preference in the app, so the two
 * things worth pinning down are that the store moves immediately and that the
 * disk write is fire-and-forget — a control that waited for disk before moving
 * would feel broken, and a failed write must never surface as an error.
 */
const saveSettings = vi.fn(async () => undefined)

vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'saveSettings' ? saveSettings : vi.fn(async () => undefined)),
  }),
  isDesktop: true,
}))

const { getState, setState } = await import('../store.svelte')
const { setSetting, togglePanelSetting } = await import('../actions')
const { DEFAULT_SETTINGS } = await import('../../shared/types')

beforeEach(() => {
  saveSettings.mockClear()
  saveSettings.mockImplementation(async () => undefined)
  setState({ settings: { ...DEFAULT_SETTINGS } })
})

describe('setSetting', () => {
  it('updates the store synchronously', () => {
    setSetting('fontSize', 21)
    expect(getState().settings.fontSize).toBe(21)
  })

  it('persists only the key it changed', () => {
    setSetting('recentsPreview', 'large')
    expect(saveSettings).toHaveBeenCalledWith({ patch: { recentsPreview: 'large' } })
  })

  it('leaves every other setting untouched', () => {
    setSetting('sidebarShowPinned', false)
    const { sidebarShowPinned, ...rest } = getState().settings
    expect(sidebarShowPinned).toBe(false)
    const { sidebarShowPinned: _, ...defaults } = DEFAULT_SETTINGS
    expect(rest).toEqual(defaults)
  })

  it('swallows a failed write, keeping the local change', async () => {
    saveSettings.mockImplementation(async () => {
      throw new Error('disk full')
    })
    await expect(setSetting('lineHeight', 1.4)).resolves.toBeUndefined()
    expect(getState().settings.lineHeight).toBe(1.4)
  })

  it('remembers which folder Home scans for tasks', () => {
    // Not session state: someone with a work root and an everything-else root
    // means the same choice tomorrow morning.
    expect(getState().settings.homeTodoScope).toBe('all')
    setSetting('homeTodoScope', 'root-1')
    expect(saveSettings).toHaveBeenCalledWith({ patch: { homeTodoScope: 'root-1' } })
  })
})

describe('togglePanelSetting', () => {
  it('flips the current value through the same writer', () => {
    expect(getState().settings.inspectorOpen).toBe(true)
    togglePanelSetting('inspectorOpen')
    expect(getState().settings.inspectorOpen).toBe(false)
    expect(saveSettings).toHaveBeenCalledWith({ patch: { inspectorOpen: false } })

    togglePanelSetting('inspectorOpen')
    expect(getState().settings.inspectorOpen).toBe(true)
  })

  // The tab strip starts visible, so this one is checked from the other end:
  // hiding it has to survive a restart the same way opening a panel does.
  it('hides the tab strip and persists that it is hidden', () => {
    expect(getState().settings.tabBarOpen).toBe(true)
    togglePanelSetting('tabBarOpen')
    expect(getState().settings.tabBarOpen).toBe(false)
    expect(saveSettings).toHaveBeenCalledWith({ patch: { tabBarOpen: false } })
  })
})
