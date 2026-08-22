import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Home is the one screen people leave open, so the interesting behaviour is not
 * the first fetch — it is what happens for the next hour. Two things have to
 * hold: a burst of file events costs one refetch rather than one each, and a
 * screen that has gone away stops asking for data.
 */
const listeners = new Set<() => void>()
const getDashboard = vi.fn(async () => ({ pinned: [], frequent: [], recentlyEdited: [] }))

vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'getDashboard' ? getDashboard : vi.fn(async () => undefined)),
  }),
  onFileChange: (handler: () => void) => {
    listeners.add(handler)
    return () => listeners.delete(handler)
  },
  isDesktop: true,
}))

const { HOME_REFRESH_MS, loadHome, watchHome } = await import('../homeData')

/** What the push channel does when a file lands on disk. */
function fileChanged() {
  for (const listener of [...listeners]) listener()
}

beforeEach(() => {
  vi.useFakeTimers()
  listeners.clear()
  getDashboard.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loadHome', () => {
  it('returns null rather than throwing when the call fails', async () => {
    getDashboard.mockImplementationOnce(async () => {
      throw new Error('no backend')
    })
    await expect(loadHome()).resolves.toBeNull()
  })
})

describe('watchHome', () => {
  it('coalesces a burst of changes into one reload', () => {
    const reload = vi.fn()
    const stop = watchHome(reload)

    fileChanged()
    fileChanged()
    window.dispatchEvent(new CustomEvent('app:meta-changed'))
    expect(reload).not.toHaveBeenCalled()

    vi.advanceTimersByTime(HOME_REFRESH_MS)
    expect(reload).toHaveBeenCalledTimes(1)
    stop()
  })

  it('reloads again for a change that arrives after the first settled', () => {
    const reload = vi.fn()
    const stop = watchHome(reload)

    fileChanged()
    vi.advanceTimersByTime(HOME_REFRESH_MS)
    fileChanged()
    vi.advanceTimersByTime(HOME_REFRESH_MS)

    expect(reload).toHaveBeenCalledTimes(2)
    stop()
  })

  it('drops a refresh that was still pending when the screen went away', () => {
    const reload = vi.fn()
    const stop = watchHome(reload)

    fileChanged()
    stop()
    vi.advanceTimersByTime(HOME_REFRESH_MS)

    expect(reload).not.toHaveBeenCalled()
  })

  it('stops listening to both channels once it is stopped', () => {
    const reload = vi.fn()
    watchHome(reload)()

    fileChanged()
    window.dispatchEvent(new CustomEvent('app:meta-changed'))
    vi.advanceTimersByTime(HOME_REFRESH_MS)

    expect(reload).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })
})
