import { beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * `openPath` is the one thing navigation calls that touches the world, so it is
 * replaced with the part that matters here: it moves the store to the file, and
 * refuses for a file that is no longer there.
 */
const missing = new Set<string>()

vi.mock('../actions', () => ({
  openPath: async (path: string) => {
    if (missing.has(path)) return
    const { setState } = await import('../store.svelte')
    setState({ surface: 'editor', activePath: path })
  },
}))

const { getState, setState } = await import('../store.svelte')
const { goBack, goForward, trackNavigation } = await import('../navigation')
const { navKey } = await import('../navHistory')

function keys(): string[] {
  return getState().nav.entries.map(navKey)
}

function open(path: string) {
  setState({ surface: 'editor', activePath: path })
}

describe('navigation tracking', () => {
  beforeAll(() => {
    trackNavigation()
    setState({ ready: true })
  })

  it('records the surface the app opened on', () => {
    expect(keys()).toEqual(['dashboard'])
    expect(getState().nav.index).toBe(0)
  })

  it('records each place visited, however it was reached', () => {
    open('/a.md')
    open('/b.md')
    setState({ surface: 'dashboard', activePath: '/b.md' })

    expect(keys()).toEqual(['dashboard', 'editor:/a.md', 'editor:/b.md', 'dashboard'])
    expect(getState().nav.index).toBe(3)
  })

  it('ignores writes that do not move the user', () => {
    setState({ notice: { kind: 'info', text: 'saved' } })
    expect(keys()).toHaveLength(4)
  })

  it('walks back without recording the walk', async () => {
    await goBack()
    expect(getState().surface).toBe('editor')
    expect(getState().activePath).toBe('/b.md')
    expect(keys()).toHaveLength(4)
    expect(getState().nav.index).toBe(2)

    await goBack()
    expect(getState().activePath).toBe('/a.md')
    expect(getState().nav.index).toBe(1)
  })

  it('walks forward again to the same places', async () => {
    await goForward()
    expect(getState().activePath).toBe('/b.md')
    expect(getState().nav.index).toBe(2)
  })

  it('abandons the forward path once you go somewhere new', () => {
    open('/c.md')
    expect(keys()).toEqual(['dashboard', 'editor:/a.md', 'editor:/b.md', 'editor:/c.md'])
    expect(getState().nav.index).toBe(3)
  })

  it('stays put when the file behind an entry has gone', async () => {
    missing.add('/b.md')
    await goBack()

    expect(getState().activePath).toBe('/c.md')
    expect(getState().nav.index).toBe(3)
    missing.delete('/b.md')
  })

  it('does nothing at the ends of the history', async () => {
    await goForward()
    expect(getState().nav.index).toBe(3)
  })
})
