import { describe, expect, it } from 'vitest'
import { prepareMermaidSvgLayout } from '../mermaidSvgLayout'

describe('prepareMermaidSvgLayout', () => {
  it('reports the natural width from the viewBox', () => {
    expect(prepareMermaidSvgLayout('<svg viewBox="0 0 1240 480"><g /></svg>').naturalWidth).toBe(
      1240,
    )
  })

  it('drops the fit-to-container constraints Mermaid bakes into the SVG', () => {
    const layout = prepareMermaidSvgLayout(
      '<svg width="100%" height="480" style="max-width: 1240px; background-color: white;" viewBox="0 0 1240 480"></svg>',
    )

    expect(layout.markup).not.toContain('max-width')
    expect(layout.markup).not.toContain('width="100%"')
    expect(layout.markup).not.toContain('height="480"')
    expect(layout.markup).toContain('background-color')
    expect(layout.markup).toContain('viewBox="0 0 1240 480"')
  })

  it('removes an emptied style attribute instead of leaving it blank', () => {
    const layout = prepareMermaidSvgLayout('<svg style="max-width: 800px;" viewBox="0 0 800 200"></svg>')

    expect(layout.markup).not.toContain('style')
  })

  it('accepts comma separated viewBox values', () => {
    expect(prepareMermaidSvgLayout('<svg viewBox="0,0,640,200"></svg>').naturalWidth).toBe(640)
  })

  it('keeps the markup untouched when no usable viewBox exists', () => {
    const markup = '<svg style="max-width: 800px;"></svg>'

    expect(prepareMermaidSvgLayout(markup)).toEqual({ markup, naturalWidth: null })
  })

  it('keeps the markup untouched when the viewBox width is not positive', () => {
    const markup = '<svg viewBox="0 0 0 200"></svg>'

    expect(prepareMermaidSvgLayout(markup)).toEqual({ markup, naturalWidth: null })
  })

  it('handles markup without an SVG root', () => {
    expect(prepareMermaidSvgLayout('')).toEqual({ markup: '', naturalWidth: null })
    expect(prepareMermaidSvgLayout('<div>nope</div>')).toEqual({
      markup: '<div>nope</div>',
      naturalWidth: null,
    })
  })
})
