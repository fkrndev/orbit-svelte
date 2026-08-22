import { describe, expect, it } from 'vitest'
import {
  IMAGE_MAX_ZOOM,
  IMAGE_MIN_ZOOM,
  clampImageZoom,
  fitImageZoom,
  formatImageZoom,
  nextImageZoom,
} from '../imageZoom'

describe('clampImageZoom', () => {
  it.each([
    [0.01, IMAGE_MIN_ZOOM],
    [100, IMAGE_MAX_ZOOM],
    [2, 2],
  ])('%s → %s', (zoom, expected) => {
    expect(clampImageZoom(zoom)).toBe(expected)
  })

  it('refuses a value that is not a usable scale', () => {
    // A division by a zero dimension is the realistic source of these, and a
    // NaN width would render the image at no size at all.
    expect(clampImageZoom(Number.NaN)).toBe(1)
    expect(clampImageZoom(0)).toBe(1)
    expect(clampImageZoom(-1)).toBe(1)
  })
})

describe('nextImageZoom', () => {
  it('steps to the next level in each direction', () => {
    expect(nextImageZoom(1, 1)).toBe(1.5)
    expect(nextImageZoom(1, -1)).toBe(0.75)
  })

  it('steps to the first level past an off-ladder fit', () => {
    // The preview opens at whatever fraction fits, which is almost never a rung.
    expect(nextImageZoom(0.37, 1)).toBe(0.5)
    expect(nextImageZoom(0.37, -1)).toBe(0.25)
  })

  it('stays put at either end rather than wrapping', () => {
    expect(nextImageZoom(IMAGE_MAX_ZOOM, 1)).toBe(IMAGE_MAX_ZOOM)
    expect(nextImageZoom(IMAGE_MIN_ZOOM, -1)).toBe(IMAGE_MIN_ZOOM)
  })

  it('comes back onto the ladder from beyond either end', () => {
    expect(nextImageZoom(12, -1)).toBe(IMAGE_MAX_ZOOM)
    expect(nextImageZoom(0.05, 1)).toBe(IMAGE_MIN_ZOOM)
  })
})

describe('fitImageZoom', () => {
  it('fits by whichever side runs out first', () => {
    expect(fitImageZoom({ width: 2000, height: 500 }, { width: 1000, height: 1000 })).toBe(0.5)
    expect(fitImageZoom({ width: 500, height: 2000 }, { width: 1000, height: 1000 })).toBe(0.5)
  })

  it('never upscales a small image to fill the window', () => {
    expect(fitImageZoom({ width: 80, height: 80 }, { width: 1400, height: 900 })).toBe(1)
  })

  it('falls back to 1:1 when a dimension is not known yet', () => {
    // The viewport is measured before the image has loaded, and a zero there
    // would otherwise produce a zoom of zero — an invisible image.
    expect(fitImageZoom({ width: 0, height: 0 }, { width: 1400, height: 900 })).toBe(1)
    expect(fitImageZoom({ width: 800, height: 600 }, { width: 0, height: 0 })).toBe(1)
  })

  it('does not fit below the bottom of the ladder', () => {
    expect(fitImageZoom({ width: 100_000, height: 100 }, { width: 800, height: 600 })).toBe(
      IMAGE_MIN_ZOOM,
    )
  })
})

describe('formatImageZoom', () => {
  it.each([
    [1, '100%'],
    [0.375, '38%'],
    [8, '800%'],
  ])('%s → %s', (zoom, expected) => {
    expect(formatImageZoom(zoom)).toBe(expected)
  })
})
