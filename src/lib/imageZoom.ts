/**
 * The zoom ladder behind the image preview.
 *
 * Deliberately not shared with `editor/mermaidZoom.ts`, which looks almost
 * identical and is answering the opposite question. A flowchart arrives several
 * thousand pixels wide and the interesting range is *below* 1:1 — its ladder
 * reaches 0.1 so "fit" can succeed. A screenshot is opened to be read, and the
 * interesting range is above 1:1: 8× so the small print in a UI capture is
 * legible. One ladder covering both would be mostly useless steps at either end.
 *
 * Pure and separate from the component for the usual reason: the arithmetic is
 * what breaks (a fit that upscales, a step that sticks at the top of the ladder),
 * and none of it needs a DOM to check.
 */

export const IMAGE_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const
export const IMAGE_MIN_ZOOM = IMAGE_ZOOM_LEVELS[0]
export const IMAGE_MAX_ZOOM = IMAGE_ZOOM_LEVELS[IMAGE_ZOOM_LEVELS.length - 1]
/** 1:1 — one image pixel per CSS pixel, which is what "100%" has to mean here. */
export const IMAGE_ACTUAL_ZOOM = 1

const ZOOM_EPSILON = 0.001

export type ImageZoomDirection = 1 | -1

export function clampImageZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return IMAGE_ACTUAL_ZOOM
  return Math.min(IMAGE_MAX_ZOOM, Math.max(IMAGE_MIN_ZOOM, zoom))
}

/**
 * The next rung up or down.
 *
 * `current` is not required to be on the ladder — the preview opens at whatever
 * fraction made the image fit — so this steps to the first level *past* where we
 * are rather than to a neighbouring index. Pressing `+` on a 37% fit therefore
 * lands on 50%, not on some 37%-relative value nobody could predict.
 */
export function nextImageZoom(current: number, direction: ImageZoomDirection): number {
  const levels: readonly number[] =
    direction === 1 ? IMAGE_ZOOM_LEVELS : [...IMAGE_ZOOM_LEVELS].reverse()
  const next = levels.find(level => direction * (level - current) > ZOOM_EPSILON)
  return next ?? clampImageZoom(current)
}

/**
 * The zoom that shows the whole image inside the viewport.
 *
 * Capped at 1:1 rather than filling the window: an 80px icon blown up to fill a
 * 27" display is not "fit", it is a blurry mistake, and the person who wanted it
 * bigger has a zoom control.
 */
export function fitImageZoom(
  natural: { width: number; height: number },
  available: { width: number; height: number },
): number {
  if (natural.width <= 0 || natural.height <= 0) return IMAGE_ACTUAL_ZOOM
  if (available.width <= 0 || available.height <= 0) return IMAGE_ACTUAL_ZOOM
  const fit = Math.min(available.width / natural.width, available.height / natural.height)
  return clampImageZoom(Math.min(IMAGE_ACTUAL_ZOOM, fit))
}

export function formatImageZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
