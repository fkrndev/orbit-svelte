import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Clicking a task on Home has to open a file that may not be open yet, and only
 * then jump to a line — the editor that does the jumping does not exist at the
 * moment of the click. So the request is parked, and whoever mounts next picks
 * it up.
 *
 * Two risks, and the tests are about both. A request that outlives its file
 * would scroll a completely different document to line 42. And a request
 * consumed the moment it is *seen* is destroyed by StrictMode, which runs every
 * effect, tears it down, and runs it again — so the jump has to survive being
 * looked at.
 */
vi.mock('../rpcClient', () => ({
  api: new Proxy({} as Record<string, unknown>, { get: () => vi.fn(async () => undefined) }),
  isDesktop: true,
}))

const { getState, setState } = await import('../store.svelte')
const { clearPendingReveal, pendingRevealFor } = await import('../revealPending')

beforeEach(() => {
  setState({ pendingReveal: null })
})

describe('pendingRevealFor', () => {
  it('hands the line to the file it was meant for', () => {
    setState({ pendingReveal: { path: '/vault/plan.md', line: 12 } })
    expect(pendingRevealFor('/vault/plan.md')).toBe(12)
  })

  it('survives being looked at twice, which is what StrictMode does', () => {
    setState({ pendingReveal: { path: '/vault/plan.md', line: 12 } })
    pendingRevealFor('/vault/plan.md')
    expect(pendingRevealFor('/vault/plan.md')).toBe(12)
  })

  it('drops a request whose file never arrived', () => {
    // The user changed their mind and opened something else. The request is now
    // about a document nobody asked to see.
    setState({ pendingReveal: { path: '/vault/plan.md', line: 12 } })
    expect(pendingRevealFor('/vault/other.md')).toBeNull()
    expect(getState().pendingReveal).toBeNull()
  })

  it('is quiet when there is nothing parked', () => {
    expect(pendingRevealFor('/vault/plan.md')).toBeNull()
  })

  it('accepts line zero, which is a real line', () => {
    setState({ pendingReveal: { path: '/vault/plan.md', line: 0 } })
    expect(pendingRevealFor('/vault/plan.md')).toBe(0)
  })
})

describe('clearPendingReveal', () => {
  it('ends the request once it has landed', () => {
    setState({ pendingReveal: { path: '/vault/plan.md', line: 12 } })
    clearPendingReveal()
    expect(getState().pendingReveal).toBeNull()
    expect(pendingRevealFor('/vault/plan.md')).toBeNull()
  })

  it('is safe to call when nothing is parked', () => {
    expect(() => clearPendingReveal()).not.toThrow()
  })
})
