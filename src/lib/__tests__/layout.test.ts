import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '$shared/types'
import { PANES, applyPaneVars, clampPane, resizedTo, writePaneVar, type PaneKey } from '../layout'

const PANE_KEYS = Object.keys(PANES) as PaneKey[]

describe('clampPane', () => {
  it('keeps every pane inside its own bounds', () => {
    for (const pane of PANE_KEYS) {
      expect(clampPane(pane, -999)).toBe(PANES[pane].min)
      expect(clampPane(pane, 99_999)).toBe(PANES[pane].max)
    }
  })

  it('rounds to whole pixels, so a drag cannot accumulate a fraction', () => {
    expect(clampPane('sidebarWidth', 260.4)).toBe(260)
  })

  it('falls back to the default when a width is missing or not a number', () => {
    // What a settings file written before a pane existed actually produces.
    expect(clampPane('inspectorWidth', undefined as unknown as number)).toBe(
      DEFAULT_SETTINGS.inspectorWidth,
    )
    expect(clampPane('editorWidth', NaN)).toBe(DEFAULT_SETTINGS.editorWidth)
  })

  it('leaves every default width reachable', () => {
    for (const pane of PANE_KEYS) {
      expect(clampPane(pane, DEFAULT_SETTINGS[pane])).toBe(DEFAULT_SETTINGS[pane])
    }
  })
})

describe('resizedTo', () => {
  it('grows a left-hand pane as the pointer moves right', () => {
    expect(resizedTo('sidebarWidth', 260, 40, 1)).toBe(300)
  })

  it('shrinks a right-hand pane as the pointer moves right', () => {
    expect(resizedTo('inspectorWidth', 288, 40, -1)).toBe(248)
  })

  it('moves a centred measure at twice the pointer, so the edge tracks the cursor', () => {
    // The column is centred, so its right edge travels half as far as its width.
    expect(resizedTo('editorWidth', 704, 50, 1)).toBe(804)
  })

  it('stops at the bounds rather than running away with the pointer', () => {
    expect(resizedTo('sidebarWidth', 260, -10_000, 1)).toBe(PANES.sidebarWidth.min)
    expect(resizedTo('editorWidth', 704, 10_000, 1)).toBe(PANES.editorWidth.max)
  })

  it('is reversible: dragging back to where it started restores the width', () => {
    // Started clear of both bounds: a drag that hits one is not reversible, and
    // is not meant to be.
    const out = resizedTo('inspectorWidth', 360, 60, -1)
    expect(resizedTo('inspectorWidth', out, -60, -1)).toBe(360)
  })
})

describe('CSS variables', () => {
  it('writes a pane as pixels on the root element', () => {
    writePaneVar('sidebarWidth', 300)
    expect(document.documentElement.style.getPropertyValue('--sidebar-width')).toBe('300px')
  })

  it('clamps settings on the way out, so a hand-edited file cannot break the layout', () => {
    applyPaneVars({ ...DEFAULT_SETTINGS, sidebarWidth: 5000, inspectorWidth: 1 })
    const read = (name: string) => document.documentElement.style.getPropertyValue(name)
    expect(read('--sidebar-width')).toBe(`${PANES.sidebarWidth.max}px`)
    expect(read('--inspector-width')).toBe(`${PANES.inspectorWidth.min}px`)
    expect(read('--editor-measure')).toBe(`${DEFAULT_SETTINGS.editorWidth}px`)
  })
})
