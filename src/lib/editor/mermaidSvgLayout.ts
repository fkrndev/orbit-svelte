export interface MermaidSvgLayout {
  markup: string
  naturalWidth: number | null
}

const VIEW_BOX_SEPARATOR = /[\s,]+/u

function readViewBoxWidth(svg: SVGSVGElement): number | null {
  const parts = svg.getAttribute('viewBox')?.trim().split(VIEW_BOX_SEPARATOR)
  if (parts?.length !== 4) return null

  const width = Number(parts[2])
  return Number.isFinite(width) && width > 0 ? width : null
}

/**
 * Mermaid ships every diagram with `width="100%"` and an inline `max-width`, which
 * scales a wide diagram down to the prose measure until its labels are unreadable.
 * Drop those so the viewport can size the SVG from its own zoom level and scroll.
 */
function releaseWidthConstraints(svg: SVGSVGElement): void {
  svg.style.removeProperty('max-width')
  if (!svg.getAttribute('style')) svg.removeAttribute('style')
  svg.removeAttribute('width')
  svg.removeAttribute('height')
}

export function prepareMermaidSvgLayout(markup: string): MermaidSvgLayout {
  const svg = new DOMParser().parseFromString(markup, 'text/html').body.querySelector('svg')
  const naturalWidth = svg ? readViewBoxWidth(svg) : null
  if (!svg || naturalWidth === null) return { markup, naturalWidth: null }

  releaseWidthConstraints(svg)
  return { markup: svg.outerHTML, naturalWidth }
}
