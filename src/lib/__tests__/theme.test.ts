import { describe, expect, it, beforeEach, vi } from 'vitest'
import { applyTheme, nextTheme, resolveTheme, THEME_ORDER } from '../theme.svelte'

function mockPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('dark') && matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  vi.unstubAllGlobals()
})

describe('resolveTheme', () => {
  it('passes an explicit preference straight through', () => {
    mockPrefersDark(true)
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('follows the OS when set to system', () => {
    mockPrefersDark(true)
    expect(resolveTheme('system')).toBe('dark')
    mockPrefersDark(false)
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('applyTheme', () => {
  it('stamps an explicit choice onto the root element', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('removes the attribute entirely for system rather than blanking it', () => {
    // An empty attribute still matches `[data-theme]`, which would quietly
    // break any future selector written against it.
    applyTheme('dark')
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('nextTheme', () => {
  it('cycles through every option and returns to the start', () => {
    let theme = THEME_ORDER[0]!
    const seen = [theme]
    for (let i = 0; i < THEME_ORDER.length; i += 1) {
      theme = nextTheme(theme)
      seen.push(theme)
    }
    expect(seen.slice(0, THEME_ORDER.length)).toEqual(THEME_ORDER)
    expect(seen[THEME_ORDER.length]).toBe(THEME_ORDER[0])
  })
})
