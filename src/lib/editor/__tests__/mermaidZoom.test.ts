import { describe, expect, it } from 'vitest'
import {
  MERMAID_DEFAULT_ZOOM,
  MERMAID_MAX_ZOOM,
  MERMAID_MIN_ZOOM,
  fitMermaidZoom,
  formatMermaidZoom,
  nextMermaidZoom,
} from '../mermaidZoom'

describe('nextMermaidZoom', () => {
  it('steps between preset levels', () => {
    expect(nextMermaidZoom(1, 1)).toBe(1.25)
    expect(nextMermaidZoom(1, -1)).toBe(0.75)
  })

  it('snaps an off-ladder zoom to the neighbouring preset level', () => {
    expect(nextMermaidZoom(1.1, 1)).toBe(1.25)
    expect(nextMermaidZoom(1.1, -1)).toBe(1)
  })

  it('clamps at the ladder bounds', () => {
    expect(nextMermaidZoom(MERMAID_MAX_ZOOM, 1)).toBe(MERMAID_MAX_ZOOM)
    expect(nextMermaidZoom(MERMAID_MIN_ZOOM, -1)).toBe(MERMAID_MIN_ZOOM)
  })
})

describe('fitMermaidZoom', () => {
  it('shrinks a diagram that is wider than the viewport', () => {
    expect(fitMermaidZoom(1000, 500)).toBe(0.5)
  })

  it('never enlarges a diagram past its natural size', () => {
    expect(fitMermaidZoom(200, 800)).toBe(MERMAID_DEFAULT_ZOOM)
  })

  it('stays within the zoom bounds for extreme diagrams', () => {
    expect(fitMermaidZoom(100000, 100)).toBe(MERMAID_MIN_ZOOM)
  })

  it('falls back to the default zoom for unusable measurements', () => {
    expect(fitMermaidZoom(0, 500)).toBe(MERMAID_DEFAULT_ZOOM)
    expect(fitMermaidZoom(500, 0)).toBe(MERMAID_DEFAULT_ZOOM)
  })
})

describe('formatMermaidZoom', () => {
  it('renders a rounded percentage', () => {
    expect(formatMermaidZoom(1)).toBe('100%')
    expect(formatMermaidZoom(0.25)).toBe('25%')
    expect(formatMermaidZoom(1.333)).toBe('133%')
  })
})
