import { describe, expect, it } from 'vitest'
import {
  EMPTY_NAV,
  canGoBack,
  canGoForward,
  dropNavPath,
  entryFor,
  navAt,
  navKey,
  pushNav,
  retargetNav,
  type NavEntry,
  type NavState,
} from '../navHistory'

const dashboard: NavEntry = { surface: 'dashboard', path: null }

function file(path: string): NavEntry {
  return { surface: 'editor', path }
}

function visit(...entries: NavEntry[]): NavState {
  return entries.reduce(pushNav, EMPTY_NAV)
}

describe('navKey', () => {
  it('separates editor entries by file', () => {
    expect(navKey(file('/a.md'))).not.toBe(navKey(file('/b.md')))
  })

  it('treats a surface without a file as one place', () => {
    expect(navKey(dashboard)).toBe(navKey({ surface: 'dashboard', path: null }))
  })
})

describe('entryFor', () => {
  it('carries the file when the editor is showing', () => {
    expect(entryFor({ surface: 'editor', activePath: '/a.md' })).toEqual(file('/a.md'))
  })

  it('drops the file everywhere else, so a surface is one place', () => {
    expect(entryFor({ surface: 'dashboard', activePath: '/a.md' })).toEqual(dashboard)
  })
})

describe('navAt', () => {
  it('starts a history with nowhere to go', () => {
    const nav = navAt(file('/a.md'))
    expect(canGoBack(nav)).toBe(false)
    expect(canGoForward(nav)).toBe(false)
    expect(nav.index).toBe(0)
  })
})

describe('pushNav', () => {
  it('records visits in order, cursor on the newest', () => {
    const nav = visit(dashboard, file('/a.md'), file('/b.md'))
    expect(nav.entries).toHaveLength(3)
    expect(nav.index).toBe(2)
  })

  it('ignores a repeat of the place already on screen', () => {
    const nav = visit(dashboard, file('/a.md'))
    expect(pushNav(nav, file('/a.md'))).toBe(nav)
  })

  it('abandons the forward path when navigating from the middle', () => {
    const nav = { ...visit(dashboard, file('/a.md'), file('/b.md')), index: 0 }
    const next = pushNav(nav, file('/c.md'))
    expect(next.entries.map(navKey)).toEqual(['dashboard', 'editor:/c.md'])
    expect(next.index).toBe(1)
  })

  it('caps the list, keeping the newest entries', () => {
    let nav = EMPTY_NAV
    for (let i = 0; i < 140; i += 1) nav = pushNav(nav, file(`/note-${i}.md`))
    expect(nav.entries).toHaveLength(100)
    expect(nav.entries[0]).toEqual(file('/note-40.md'))
    expect(nav.index).toBe(99)
  })
})

describe('canGoBack / canGoForward', () => {
  it('has nowhere to go from an empty history', () => {
    expect(canGoBack(EMPTY_NAV)).toBe(false)
    expect(canGoForward(EMPTY_NAV)).toBe(false)
  })

  it('has nowhere to go from the only entry', () => {
    const nav = visit(dashboard)
    expect(canGoBack(nav)).toBe(false)
    expect(canGoForward(nav)).toBe(false)
  })

  it('opens forward once the cursor has moved back', () => {
    const nav = { ...visit(dashboard, file('/a.md')), index: 0 }
    expect(canGoBack(nav)).toBe(false)
    expect(canGoForward(nav)).toBe(true)
  })
})

describe('dropNavPath', () => {
  it('removes every visit to a deleted file', () => {
    const nav = visit(file('/a.md'), dashboard, file('/a.md'), file('/b.md'))
    const next = dropNavPath(nav, '/a.md')
    expect(next.entries.map(navKey)).toEqual(['dashboard', 'editor:/b.md'])
  })

  it('keeps the cursor on the place that is on screen', () => {
    const nav = { ...visit(file('/a.md'), dashboard, file('/b.md')), index: 2 }
    expect(dropNavPath(nav, '/a.md').index).toBe(1)
  })

  it('leaves an untouched history identical', () => {
    const nav = visit(dashboard, file('/a.md'))
    expect(dropNavPath(nav, '/missing.md')).toBe(nav)
  })

  it('empties out when the deleted file was the whole history', () => {
    const next = dropNavPath(visit(file('/a.md')), '/a.md')
    expect(next).toEqual(EMPTY_NAV)
  })
})

describe('retargetNav', () => {
  it('follows a renamed file everywhere it appears', () => {
    const nav = visit(file('/a.md'), dashboard, file('/a.md'))
    const next = retargetNav(nav, '/a.md', '/b.md')
    expect(next.entries.map(navKey)).toEqual(['editor:/b.md', 'dashboard', 'editor:/b.md'])
    expect(next.index).toBe(nav.index)
  })

  it('leaves a history without that file identical', () => {
    const nav = visit(dashboard, file('/a.md'))
    expect(retargetNav(nav, '/other.md', '/b.md')).toBe(nav)
  })
})
