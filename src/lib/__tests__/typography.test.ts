import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '$shared/types'
import {
  CODE_FONTS,
  PROSE_FONTS,
  TYPE_SCALES,
  TYPOGRAPHY_DEFAULTS,
  applyTypography,
  clampScale,
  formatScale,
  type TypeScaleKey,
} from '../typography'

const SCALE_KEYS = Object.keys(TYPE_SCALES) as TypeScaleKey[]

describe('clampScale', () => {
  it('keeps every scale inside its own bounds', () => {
    for (const key of SCALE_KEYS) {
      expect(clampScale(key, -999)).toBe(TYPE_SCALES[key].min)
      expect(clampScale(key, 9_999)).toBe(TYPE_SCALES[key].max)
    }
  })

  it('falls back to the default when the value is missing or not a number', () => {
    // What a settings file written before these fields existed produces.
    expect(clampScale('fontSize', undefined as unknown as number)).toBe(DEFAULT_SETTINGS.fontSize)
    expect(clampScale('lineHeight', NaN)).toBe(DEFAULT_SETTINGS.lineHeight)
  })

  it('leaves every default reachable', () => {
    for (const key of SCALE_KEYS) {
      expect(clampScale(key, DEFAULT_SETTINGS[key])).toBe(DEFAULT_SETTINGS[key])
    }
  })

  it('snaps to the slider step, so a stored value is one the slider can return to', () => {
    expect(clampScale('fontSize', 17.4)).toBe(17)
    expect(clampScale('lineHeight', 1.77)).toBe(1.75)
  })
})

describe('formatScale', () => {
  it('appends the unit only where there is one', () => {
    expect(formatScale('fontSize', 17)).toBe('17 px')
    expect(formatScale('paragraphSpacing', 0.6)).toBe('0.6 em')
    expect(formatScale('lineHeight', 1.75)).toBe('1.75')
  })
})

describe('applyTypography', () => {
  it('writes every scale to its CSS variable, with its unit', () => {
    applyTypography({ ...DEFAULT_SETTINGS, fontSize: 20, lineHeight: 1.5, paragraphSpacing: 1 })
    const style = document.documentElement.style
    expect(style.getPropertyValue('--prose-size')).toBe('20px')
    expect(style.getPropertyValue('--prose-leading')).toBe('1.5')
    expect(style.getPropertyValue('--prose-gap')).toBe('1em')
  })

  it('resolves a font key to its stack', () => {
    applyTypography({ ...DEFAULT_SETTINGS, proseFont: 'serif', codeFont: 'menlo' })
    const style = document.documentElement.style
    expect(style.getPropertyValue('--font-prose')).toBe(PROSE_FONTS[2]!.stack)
    expect(style.getPropertyValue('--font-mono')).toBe(CODE_FONTS[1]!.stack)
  })

  it('falls back to the first stack when the stored key is unknown', () => {
    // A settings file naming a font that a later build removed.
    applyTypography({ ...DEFAULT_SETTINGS, proseFont: 'comic-sans-9000' })
    expect(document.documentElement.style.getPropertyValue('--font-prose')).toBe(
      PROSE_FONTS[0]!.stack,
    )
  })

  it('clamps on the way out, so a hand-edited settings file cannot break the page', () => {
    applyTypography({ ...DEFAULT_SETTINGS, fontSize: 400 })
    expect(document.documentElement.style.getPropertyValue('--prose-size')).toBe(
      `${TYPE_SCALES.fontSize.max}px`,
    )
  })
})

describe('TYPOGRAPHY_DEFAULTS', () => {
  it('matches DEFAULT_SETTINGS, so "Restore defaults" really restores them', () => {
    for (const [key, value] of Object.entries(TYPOGRAPHY_DEFAULTS)) {
      expect(value).toBe(DEFAULT_SETTINGS[key as keyof typeof TYPOGRAPHY_DEFAULTS])
    }
  })
})

describe('font choices', () => {
  it('offers the default key in the list, or the picker would show a blank value', () => {
    expect(PROSE_FONTS.some(font => font.value === DEFAULT_SETTINGS.proseFont)).toBe(true)
    expect(CODE_FONTS.some(font => font.value === DEFAULT_SETTINGS.codeFont)).toBe(true)
  })
})
