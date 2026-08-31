import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '$shared/types'

/**
 * Startup that is never answered.
 *
 * The boot placeholder in `app.html` is only removed once `ready` flips, so a
 * request that neither resolves nor rejects leaves the window on the loading
 * skeleton with nothing on screen that says why — the state a webview reload
 * was reported stuck in. What is pinned here is that the app gives up out loud
 * instead: the shell comes up, and the notice names the failure.
 */

const never = () => new Promise<never>(() => {})

vi.mock('../rpcClient', () => ({
  isDesktop: true,
  api: {
    getSettings: never,
    listRoots: never,
    listLabels: never,
    listTags: never,
    getPropertySchema: never,
  },
}))

const { getState, setState } = await import('../store.svelte')
const { bootstrap, STARTUP_TIMEOUT_MS } = await import('../actions')

beforeEach(() => {
  setState({
    ready: false,
    notice: null,
    tabs: [],
    activePath: null,
    roots: [],
    settings: { ...DEFAULT_SETTINGS },
  })
})

describe('bootstrap', () => {
  it('flips ready and says so when nothing answers', async () => {
    vi.useFakeTimers()
    try {
      const done = bootstrap()
      // Just past the deadline: the notice times itself out a few seconds
      // later, so running the clock further would clear what is asserted below.
      await vi.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS + 1)
      await done

      expect(getState().ready).toBe(true)
      expect(getState().notice?.kind).toBe('error')
      expect(getState().notice?.text).toContain('Startup failed')
    } finally {
      vi.useRealTimers()
    }
  })
})
