import { DEFAULT_SETTINGS, type AppSettings } from '$shared/types'

/**
 * Reading typography, and the arithmetic behind changing it.
 *
 * The same bargain as `layout.ts`: the values live in settings, but they reach
 * the page as CSS custom properties on the root element rather than as props
 * threaded into the editor. Two reasons — the editor is BlockNote, whose inner
 * DOM we do not own, and a stylesheet variable applies to the raw editor, the
 * outline, and the print styles at the same time without any of them knowing
 * the setting exists.
 *
 * Every default here must match the literal in `editor/editor.css`, which is
 * what renders before settings arrive from disk.
 */

export type TypeScaleKey = 'fontSize' | 'lineHeight' | 'paragraphSpacing'

interface TypeScaleSpec {
  cssVar: string
  min: number
  max: number
  step: number
  /** Appended when writing the variable, and shown beside the slider. */
  unit: string
  /** Decimal places for the readout. Sizes are whole numbers; ratios are not. */
  decimals: number
}

export const TYPE_SCALES: Record<TypeScaleKey, TypeScaleSpec> = {
  // 14 is the floor at which Avenir's x-height still holds up on a laptop
  // screen; past 22 the measure has to grow with it or lines get too short.
  fontSize: { cssVar: '--prose-size', min: 14, max: 22, step: 1, unit: 'px', decimals: 0 },
  lineHeight: { cssVar: '--prose-leading', min: 1.3, max: 2.1, step: 0.05, unit: '', decimals: 2 },
  paragraphSpacing: { cssVar: '--prose-gap', min: 0, max: 1.6, step: 0.1, unit: 'em', decimals: 1 },
}

/**
 * Font choices are a fixed list, not free text.
 *
 * Enumerating the installed fonts needs a new RPC and a picker, and every stack
 * offered here has been looked at in the editor. A dropdown of four things that
 * work beats a field where most inputs render as Times.
 */
export interface FontChoice {
  value: string
  label: string
  stack: string
}

export const PROSE_FONTS: FontChoice[] = [
  { value: 'avenir', label: 'Avenir Next', stack: "'Avenir Next', Avenir, var(--font-ui)" },
  { value: 'system', label: 'System', stack: 'var(--font-ui)' },
  {
    value: 'serif',
    label: 'Serif',
    stack: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
  },
  { value: 'mono', label: 'Monospace', stack: 'var(--font-mono)' },
]

export const CODE_FONTS: FontChoice[] = [
  {
    value: 'system',
    label: 'System mono',
    stack: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace",
  },
  { value: 'menlo', label: 'Menlo', stack: "Menlo, ui-monospace, monospace" },
  { value: 'courier', label: 'Courier', stack: "'Courier New', Courier, monospace" },
]

/**
 * Same guard as `clampPane`: a settings file written by an older build has no
 * entry for a field added since, and `undefined` in a CSS variable silently
 * drops the declaration — leaving prose at whatever the stylesheet said, which
 * looks like the setting did nothing rather than like data was missing.
 */
export function clampScale(key: TypeScaleKey, value: number): number {
  const spec = TYPE_SCALES[key]
  const raw = Number.isFinite(value) ? value : DEFAULT_SETTINGS[key]
  const stepped = Math.round(raw / spec.step) * spec.step
  return Number(Math.min(spec.max, Math.max(spec.min, stepped)).toFixed(spec.decimals))
}

/** The readout beside a slider: `17 px`, `1.75`, `0.6 em`. */
export function formatScale(key: TypeScaleKey, value: number): string {
  const spec = TYPE_SCALES[key]
  const number = clampScale(key, value).toFixed(spec.decimals)
  return spec.unit ? `${number} ${spec.unit}` : number
}

function stackFor(fonts: FontChoice[], value: string, fallback: string): string {
  return fonts.find(font => font.value === value)?.stack ?? fallback
}

export function applyTypography(settings: AppSettings) {
  const root = document.documentElement
  for (const key of Object.keys(TYPE_SCALES) as TypeScaleKey[]) {
    const spec = TYPE_SCALES[key]
    root.style.setProperty(spec.cssVar, `${clampScale(key, settings[key])}${spec.unit}`)
  }
  // Written even when the choice is the default, because the alternative is
  // *removing* the property — and a removal has to be right about which
  // stylesheet rule takes over, while an override never does.
  root.style.setProperty(
    '--font-prose',
    stackFor(PROSE_FONTS, settings.proseFont, PROSE_FONTS[0]!.stack),
  )
  root.style.setProperty(
    '--font-mono',
    stackFor(CODE_FONTS, settings.codeFont, CODE_FONTS[0]!.stack),
  )
}

/** The typography half of `DEFAULT_SETTINGS`, for "Restore defaults". */
export const TYPOGRAPHY_DEFAULTS = {
  fontSize: DEFAULT_SETTINGS.fontSize,
  lineHeight: DEFAULT_SETTINGS.lineHeight,
  paragraphSpacing: DEFAULT_SETTINGS.paragraphSpacing,
  proseFont: DEFAULT_SETTINGS.proseFont,
  codeFont: DEFAULT_SETTINGS.codeFont,
  editorWidth: DEFAULT_SETTINGS.editorWidth,
} as const satisfies Partial<AppSettings>
