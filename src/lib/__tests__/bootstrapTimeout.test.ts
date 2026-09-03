import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '$shared/types'

/**
 * Startup that is never answered.
 *
 * The boot placeholder in `app.html` is only removed once `ready` flips, so a
 * request that neither resolves nor rejects leaves the window on the loading
 * skeleton with nothing on screen that says why — the state a webview reload
 * and a launch at login were both reported stuck in. What is pinned here is
 * that the app tries again before giving up, and that when it does give up it
 * says so in a notice that waits for an answer instead of fading.
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
const { bootstrap, STARTUP_TIMEOUT_MS, STARTUP_ATTEMPTS, STARTUP_RETRY_DELAY_MS } = await import(
  '../actions'
)

/** One attempt's budget plus the pause before the next one. */
const ROUND_MS = STARTUP_TIMEOUT_MS + STARTUP_RETRY_DELAY_MS

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
  it('keeps the skeleton up while it retries', async () => {
    vi.useFakeTimers()
    try {
      const done = bootstrap()
      // One deadline past, attempts left: giving up here would be the old bug.
      await vi.advanceTimersByTimeAsync(ROUND_MS)
      expect(getState().ready).toBe(false)
      expect(getState().notice).toBe(null)

      await vi.advanceTimersByTimeAsync(ROUND_MS * STARTUP_ATTEMPTS)
      await done
    } finally {
      vi.useRealTimers()
    }
  })

  it('flips ready and says so, with a way back, when nothing answers', async () => {
    vi.useFakeTimers()
    try {
      const done = bootstrap()
      await vi.advanceTimersByTimeAsync(ROUND_MS * STARTUP_ATTEMPTS)
      await done

      expect(getState().ready).toBe(true)
      expect(getState().notice?.kind).toBe('error')
      expect(getState().notice?.text).toContain('Could not load your data')
      expect(getState().notice?.text).toContain('safe on disk')
      // A notice carrying an action is the one kind `notify` does not time out,
      // so this is also what keeps the explanation on screen.
      expect(getState().notice?.action?.label).toBe('Try again')
    } finally {
      vi.useRealTimers()
    }
  })
})
