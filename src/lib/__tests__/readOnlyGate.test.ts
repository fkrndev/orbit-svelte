import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The gate itself, with the real `rpcClient` rather than a stand-in.
 *
 * `readOnly.test.ts` proves the actions behave; this proves the guarantee
 * underneath them. They are separate because they fail for different reasons: a
 * missing check in one action breaks the first, and this one still passes —
 * which is the whole argument for having a gate that no caller can route around.
 *
 * Electrobun is stubbed only so the module loads. Without a preload the client
 * takes its HTTP path, so "did this reach the outside world" is answerable by
 * watching `fetch`.
 */

vi.mock('electrobun/view', () => ({
  default: { Electroview: class {} },
  Electroview: { defineRPC: () => ({}) },
}))

const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ result: {} })))
vi.stubGlobal('fetch', fetchSpy)

const { api, ReadOnlyError } = await import('../rpcClient')
const { setState } = await import('../store.svelte')
const { FILE_WRITE_METHODS } = await import('../../shared/rpc')
const { DEFAULT_SETTINGS } = await import('../../shared/types')

beforeEach(() => {
  fetchSpy.mockClear()
  setState({ settings: { ...DEFAULT_SETTINGS, readOnly: true } })
})

describe('the read-only gate in rpcClient', () => {
  it.each([...FILE_WRITE_METHODS])('rejects %s and never reaches the transport', async method => {
    const call = (api as unknown as Record<string, (p: unknown) => Promise<unknown>>)[method]!
    await expect(call({})).rejects.toBeInstanceOf(ReadOnlyError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  /**
   * Rejects rather than resolving with something plausible. A caller that got a
   * fake success would update the store as though the write had landed, and the
   * app would then show a file that does not match the one on disk — which is a
   * worse outcome than the write it was preventing.
   */
  it('reports a refusal, not a failure', async () => {
    await expect(api.writeFile({ path: '/a.md', content: 'x' })).rejects.toThrow(/Read-only/)
  })

  it('lets reads and sidecar writes through', async () => {
    await api.getSettings()
    await api.updateMeta({ path: '/a.md', patch: { pinned: true } })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('lets file writes through once the mode is off', async () => {
    setState({ settings: { ...DEFAULT_SETTINGS, readOnly: false } })
    await api.writeFile({ path: '/a.md', content: 'x' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
