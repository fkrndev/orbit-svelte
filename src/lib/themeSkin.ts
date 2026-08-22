import type { AppSettings } from '$shared/types'
import { ACCENTS, BASE_COLORS, RADII, type ThemePreset, type ThemeTokens } from './themePresets'

/**
 * The chosen theme, as a stylesheet.
 *
 * Not `root.style.setProperty` like `layout.ts` and `typography.ts` do, and the
 * difference is forced rather than stylistic. Those write one value that means
 * the same thing in both themes; a palette is *two* sets of values with a
 * media query deciding between them, and an inline style has nowhere to put a
 * media query. Writing only the resolved set would mean recomputing on every
 * OS sunset — and getting it wrong for the split second before the listener
 * fires.
 *
 * So the same three selectors `app.css` uses are emitted verbatim, and the
 * light/dark switch keeps working exactly as it did.
 */

export const SKIN_ELEMENT_ID = 'orbit-theme-skin'

/**
 * Every selector carries `:root` twice.
 *
 * Specificity, not superstition: this stylesheet has to beat `app.css`, and
 * relying on document order would make the palette depend on whether Vite
 * injected its styles before or after the app mounted — true in a build, not
 * reliably true under HMR. Doubling the pseudo-class costs nothing and settles
 * it. The forced-dark block still has to come after the media block, which it
 * does, because those two tie.
 */
const LIGHT = ':root:root'
const DARK_SYSTEM = ":root:root:not([data-theme='light'])"
const DARK_FORCED = ":root:root[data-theme='dark']"

export function baseColorPreset(name: string): ThemePreset {
  return BASE_COLORS.find(preset => preset.name === name) ?? BASE_COLORS[0]!
}

/** `null` for `none`, and for a name this build no longer ships. */
export function accentPreset(name: string): ThemePreset | null {
  return ACCENTS.find(preset => preset.name === name) ?? null
}

export function radiusValue(name: string): string {
  const found = RADII.find(radius => radius.name === name) ?? RADII.find(r => r.name === 'default')
  return found!.value
}

function declarations(tokens: ThemeTokens, indent = '  '): string {
  return Object.entries(tokens)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n')
}

function block(selector: string, tokens: ThemeTokens): string {
  return `${selector} {\n${declarations(tokens)}\n}`
}

/**
 * The accent lands *after* the base colour in the same block, which is the
 * whole mechanism: a base colour declares `--brand` as its own grey, and an
 * accent overwrites just that one plus the two tokens that pair with it.
 */
function tokensFor(
  mode: 'light' | 'dark',
  base: ThemePreset,
  accent: ThemePreset | null,
): ThemeTokens {
  return { ...base[mode], ...(accent?.[mode] ?? {}) }
}

export function themeSkinCss(settings: AppSettings): string {
  const base = baseColorPreset(settings.themeBaseColor)
  const accent = accentPreset(settings.themeAccent)
  const dark = tokensFor('dark', base, accent)

  return [
    // Radius is one value for both themes, so it rides along with light rather
    // than being declared twice and drifting.
    block(LIGHT, { '--radius': radiusValue(settings.themeRadius), ...tokensFor('light', base, accent) }),
    `@media (prefers-color-scheme: dark) {\n${block(DARK_SYSTEM, dark)
      .split('\n')
      .map(line => `  ${line}`)
      .join('\n')}\n}`,
    block(DARK_FORCED, dark),
  ].join('\n\n')
}

/**
 * Puts the chosen theme on the page.
 *
 * Idempotent, and deliberately so: this is called from an effect that reruns on
 * any settings write, and replacing the text of a live stylesheet forces a
 * recalculation of every rule in it. Comparing first makes changing the sidebar
 * width free again.
 */
export function applyThemeSkin(settings: AppSettings) {
  const css = themeSkinCss(settings)
  let element = document.getElementById(SKIN_ELEMENT_ID)

  if (!element) {
    element = document.createElement('style')
    element.id = SKIN_ELEMENT_ID
    document.head.append(element)
  }

  if (element.textContent !== css) element.textContent = css
}
