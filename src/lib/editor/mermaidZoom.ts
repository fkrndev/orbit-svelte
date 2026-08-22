// Mermaid flowcharts routinely render several thousand pixels wide, so the ladder has
// to reach far enough down for "fit width" to actually fit one inside the prose measure.
export const MERMAID_ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const
export const MERMAID_DEFAULT_ZOOM = 1
export const MERMAID_MIN_ZOOM = MERMAID_ZOOM_LEVELS[0]
export const MERMAID_MAX_ZOOM = MERMAID_ZOOM_LEVELS[MERMAID_ZOOM_LEVELS.length - 1]

const ZOOM_EPSILON = 0.001

export type MermaidZoomDirection = 1 | -1

export function clampMermaidZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MERMAID_DEFAULT_ZOOM
  return Math.min(MERMAID_MAX_ZOOM, Math.max(MERMAID_MIN_ZOOM, zoom))
}

export function nextMermaidZoom(current: number, direction: MermaidZoomDirection): number {
  const levels: readonly number[] =
    direction === 1 ? MERMAID_ZOOM_LEVELS : [...MERMAID_ZOOM_LEVELS].reverse()
  const next = levels.find(level => direction * (level - current) > ZOOM_EPSILON)
  return next ?? clampMermaidZoom(current)
}

export function fitMermaidZoom(naturalWidth: number, availableWidth: number): number {
  if (naturalWidth <= 0 || availableWidth <= 0) return MERMAID_DEFAULT_ZOOM
  return clampMermaidZoom(Math.min(MERMAID_DEFAULT_ZOOM, availableWidth / naturalWidth))
}

export function formatMermaidZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
