import { DEFAULT_SETTINGS, type AppSettings as Settings } from '$shared/types'

/**
 * Type and colour overrides, written onto the stylesheet's own variables.
 *
 * The same bargain as `layout.ts` and `typography.ts`: settings reach the page as
 * custom properties on the root element, not as props. `--font-ui` is already what
 * every surface resolves through, and Tailwind's weight utilities read
 * `--font-weight-*`, so one write per property covers the app instead of a setting
 * per component. Reading typography is `typography.ts`'s half of the same job.
 *
 * Empty string / 0 means "leave the stylesheet alone" — the property is removed
 * rather than set, so the theme's own value comes back.
 */

/**
 * Google fonts have to be fetched; none of them ship with the OS. The list is
 * limited to families that carry every weight in `WEIGHTS`, because one missing
 * weight fails the whole stylesheet request.
 */
export const GOOGLE_SANS_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Nunito',
  'Nunito Sans',
  'Rubik',
  'Manrope',
  'DM Sans',
  'Work Sans',
  'Figtree',
  'Outfit',
  'Plus Jakarta Sans',
  'Space Grotesk',
  'Source Sans 3',
  'Lexend',
  'Karla',
  'Public Sans',
  'Mulish',
]

export const GOOGLE_MONO_FONTS = [
  'JetBrains Mono',
  'Fira Code',
  'IBM Plex Mono',
  'Source Code Pro',
  'Roboto Mono',
  'Inconsolata',
  'Geist Mono',
]

export const SYSTEM_SANS_FONTS = ['SF Pro Text', 'Segoe UI', 'Helvetica Neue', 'Georgia']

const WEIGHTS = '300;400;500;600;700'
const loaded = new Set<string>()

export function isGoogleFont(name: string): boolean {
  return GOOGLE_SANS_FONTS.includes(name) || GOOGLE_MONO_FONTS.includes(name)
}

/** Adds the stylesheet for `name` once. No-op for system fonts and repeat calls. */
export function ensureGoogleFont(name: string | undefined | null): void {
  const font = (name ?? '').trim()
  if (!font || !isGoogleFont(font) || loaded.has(font)) return
  loaded.add(font)

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@${WEIGHTS}&display=swap`
  document.head.appendChild(link)
}

/**
 * Whatever the browser can parse — oklch, hsl, a keyword — as `#rrggbb`.
 *
 * `<input type="color">` only speaks hex, and the theme's colours are oklch. A 2d
 * context normalises any CSS colour on assignment, which beats carrying a colour
 * space conversion for the sake of one swatch.
 */
function toHex(color: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#000000'
  ctx.fillStyle = color.trim() || '#000000'
  ctx.fillRect(0, 0, 1, 1)
  // Through a pixel rather than off `fillStyle`: the canvas keeps oklch as written,
  // and the sampled pixel is plain RGB whatever colour space went in.
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map(n => (n ?? 0).toString(16).padStart(2, '0')).join('')}`
}

export const TEXT_COLOR_VARS = {
  textColor: '--text',
  mutedTextColor: '--text-muted',
  faintTextColor: '--text-faint',
} as const

export type TextColorKey = keyof typeof TEXT_COLOR_VARS

/** The colour a slot renders with right now, as hex — what a colour input needs. */
export function currentTextColor(key: TextColorKey): string {
  const parts = getComputedStyle(document.documentElement).getPropertyValue(TEXT_COLOR_VARS[key])
  return toHex(parts)
}

const clampWeight = (v: number) =>
  Number.isFinite(v) && v >= 100 && v <= 900 ? Math.round(v / 100) * 100 : 0

/** Writes every appearance override. Called on boot and after each change. */
export function applyAppearance(input: Partial<Settings>): void {
  // Spread over the defaults: a settings row written before these keys existed has
  // none of them, and `undefined` in a CSS variable drops the declaration silently.
  const settings = { ...DEFAULT_SETTINGS, ...input }
  const root = document.documentElement.style
  const set = (name: string, value: string) =>
    value ? root.setProperty(name, value) : root.removeProperty(name)

  const stack = (name: string, fallback: string) =>
    name.trim() ? `"${name.trim().replace(/"/g, '')}", var(${fallback})` : ''

  // Only `--font-ui` here: `--font-mono` and `--font-prose` belong to
  // `typography.ts`, which owns the reading stacks and writes them unconditionally.
  ensureGoogleFont(settings.uiFontFamily)
  set('--font-ui', stack(settings.uiFontFamily, '--font-ui-base'))

  const size = Number(settings.uiFontSize)
  root.fontSize = size >= 11 && size <= 22 ? `${size}px` : ''

  // Tailwind's `font-medium` / `font-semibold` sit between the two chosen weights, so
  // they move with them — otherwise body, label and heading collapse onto two levels.
  const normal = clampWeight(settings.uiFontWeight)
  const bold = clampWeight(settings.uiFontWeightBold)
  set('--font-weight-normal', normal ? String(normal) : '')
  set('--font-weight-medium', normal ? String(Math.min(900, normal + 100)) : '')
  set('--font-weight-semibold', bold ? String(Math.max(100, bold - 100)) : '')
  set('--font-weight-bold', bold ? String(bold) : '')

  for (const [key, cssVar] of Object.entries(TEXT_COLOR_VARS)) {
    set(cssVar, settings[key as TextColorKey] ?? '')
  }
}
