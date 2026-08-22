import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_SETTINGS } from '$shared/types'
import { ACCENTS, BASE_COLORS, RADII } from '../themePresets'
import {
  SKIN_ELEMENT_ID,
  accentPreset,
  applyThemeSkin,
  baseColorPreset,
  radiusValue,
  themeSkinCss,
} from '../themeSkin'

const CSS = readFileSync(resolve(import.meta.dirname, '../../app.css'), 'utf8')

const settingsWith = (patch: Partial<typeof DEFAULT_SETTINGS>) => ({ ...DEFAULT_SETTINGS, ...patch })

describe('theme presets', () => {
  it('gives every base colour the same tokens in both themes', () => {
    for (const preset of BASE_COLORS) {
      expect(Object.keys(preset.dark).sort(), preset.name).toEqual(Object.keys(preset.light).sort())
    }
  })

  /**
   * The property that lets this ship without changing how the app looks.
   *
   * `app.css` paints before settings are read off disk, so the default preset
   * has to be the stylesheet's own palette — not merely close to it. A drift
   * here is a flash of the wrong colour on every launch, which is exactly the
   * kind of bug that gets blamed on the window server.
   */
  it('reproduces app.css exactly for the default theme', () => {
    const neutral = baseColorPreset('neutral')
    const forcedDark = CSS.slice(CSS.indexOf("[data-theme='dark'] {"))

    for (const [name, value] of Object.entries(neutral.light)) {
      expect(CSS, `${name}, light`).toContain(`  ${name}: ${value};`)
    }
    for (const [name, value] of Object.entries(neutral.dark)) {
      expect(forcedDark, `${name}, dark`).toContain(`  ${name}: ${value};`)
    }
    expect(CSS).toContain(`--radius: ${radiusValue('default')};`)
  })

  /**
   * An accent is a hue on a base colour, not a palette of its own — the moment
   * it starts declaring `--bg`, picking "Blue" turns the sidebar blue.
   */
  it('limits an accent to the brand tokens', () => {
    for (const preset of ACCENTS) {
      expect(Object.keys(preset.light).sort(), preset.name).toEqual([
        '--brand',
        '--brand-on',
        '--brand-soft',
      ])
      expect(Object.keys(preset.dark).sort(), preset.name).toEqual(Object.keys(preset.light).sort())
    }
  })

  /**
   * `--brand` is written as a *colour* in a dozen places — the caret, the folder
   * glyphs, the matched characters in Quick Open — so an accent that is dark in
   * dark mode is invisible text, not a subtle button.
   */
  it('keeps every accent a contrast step against its background', () => {
    const lightness = (value: string) => Number(/oklch\(([\d.]+)/.exec(value)![1])
    for (const preset of ACCENTS) {
      expect(lightness(preset.light['--brand']!), `${preset.name}, light`).toBeLessThan(0.6)
      expect(lightness(preset.dark['--brand']!), `${preset.name}, dark`).toBeGreaterThan(0.7)
    }
  })
})

describe('lookups', () => {
  it('falls back to the default preset for a name this build does not ship', () => {
    expect(baseColorPreset('chartreuse').name).toBe('neutral')
    expect(accentPreset('chartreuse')).toBeNull()
    expect(radiusValue('enormous')).toBe(RADII.find(r => r.name === 'default')!.value)
  })

  it('reads none as no accent at all', () => {
    expect(accentPreset('none')).toBeNull()
  })
})

describe('themeSkinCss', () => {
  it('declares both themes behind the selectors app.css uses', () => {
    const css = themeSkinCss(DEFAULT_SETTINGS)
    expect(css).toContain(':root:root {')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(":root:root[data-theme='dark'] {")
  })

  /**
   * The two dark blocks have equal specificity, so the explicit choice only
   * beats the system's if it comes last. Reverse them and picking Dark on a
   * machine set to Light silently does nothing.
   */
  it('puts the forced theme after the system one', () => {
    const css = themeSkinCss(DEFAULT_SETTINGS)
    expect(css.indexOf("[data-theme='dark']")).toBeGreaterThan(
      css.indexOf('prefers-color-scheme'),
    )
  })

  it('lets the accent overwrite the base colour it sits on', () => {
    const withAccent = themeSkinCss(settingsWith({ themeAccent: 'blue' }))
    const blue = accentPreset('blue')!

    expect(withAccent).toContain(`--brand: ${blue.light['--brand']};`)
    // ...and nothing else: the greys are still the base colour's.
    expect(withAccent).toContain(`--bg-sunken: ${baseColorPreset('neutral').light['--bg-sunken']};`)
  })

  it('carries the base colour through to both themes', () => {
    const css = themeSkinCss(settingsWith({ themeBaseColor: 'stone' }))
    const stone = baseColorPreset('stone')

    expect(css).toContain(`--bg-sunken: ${stone.light['--bg-sunken']};`)
    expect(css).toContain(`--bg-sunken: ${stone.dark['--bg-sunken']};`)
  })

  it('writes the radius once, since it is the same in both themes', () => {
    const css = themeSkinCss(settingsWith({ themeRadius: 'large' }))
    expect(css.match(/--radius:/g)).toHaveLength(1)
    expect(css).toContain(`--radius: ${radiusValue('large')};`)
  })
})

describe('applyThemeSkin', () => {
  beforeEach(() => {
    document.getElementById(SKIN_ELEMENT_ID)?.remove()
  })

  it('keeps one stylesheet however often it is called', () => {
    applyThemeSkin(DEFAULT_SETTINGS)
    applyThemeSkin(settingsWith({ themeAccent: 'rose' }))

    const found = document.head.querySelectorAll(`#${SKIN_ELEMENT_ID}`)
    expect(found).toHaveLength(1)
    expect(found[0]!.textContent).toBe(themeSkinCss(settingsWith({ themeAccent: 'rose' })))
  })

  /** The effect this runs in reruns on every settings write, including a drag. */
  it('leaves the stylesheet alone when nothing about the theme changed', () => {
    applyThemeSkin(DEFAULT_SETTINGS)
    const element = document.getElementById(SKIN_ELEMENT_ID)!
    const before = element.textContent

    applyThemeSkin(settingsWith({ sidebarWidth: 999 }))
    expect(element.textContent).toBe(before)
  })
})
