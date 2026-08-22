#!/usr/bin/env node
/**
 * Turns shadcn-svelte's theme data into orbit's own palette.
 *
 *   bun scripts/gen-theme-presets.mjs   # rewrites src/lib/themePresets.ts
 *
 * The input is `theme-presets/shadcn-themes.json`, lifted verbatim from the
 * theme customizer on shadcn-svelte.com: seven base colours, seventeen accent
 * themes, and the radius steps. It is vendored rather than fetched because the
 * upstream data lives in a content-hashed JS chunk, which is not a URL anything
 * should depend on at build time.
 *
 * The output is *not* those variables. This app is written against its own
 * tokens — `--bg`, `--text-muted`, `--brand` — and shadcn's semantic names are
 * aliased onto them in `app.css`, so pasting shadcn's `--background` in would
 * repaint the shadcn components and leave the rest of the app grey.
 *
 * So the lightness ladder stays ours and only the *hue and chroma* are taken
 * from upstream: for each of our tokens, the upstream colour nearest it in
 * lightness donates its chroma and hue. Neutral is chromaless, which makes the
 * generated neutral values byte-identical to the ones already in `app.css` —
 * the property that lets this ship without changing how the app looks by
 * default, and the first thing to check if the mapping is ever edited.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = resolve(HERE, 'theme-presets/shadcn-themes.json')
const TARGET = resolve(HERE, '../src/lib/themePresets.ts')

/**
 * Our lightness ladder, copied from `app.css`.
 *
 * Every value here must stay equal to the neutral literal in the stylesheet, or
 * the default theme drifts from the one that paints before settings load.
 */
const LADDER = {
  light: {
    '--bg': 1,
    '--bg-raised': 1,
    '--bg-sunken': 0.97,
    '--bg-hover': 0.951,
    '--bg-active': 0.922,
    '--border': 0.922,
    '--border-strong': 0.87,
    '--text': 0.145,
    '--text-muted': 0.556,
    '--text-faint': 0.665,
    '--brand': 0.205,
    '--brand-on': 0.985,
    '--brand-soft': 0.94,
    '--tooltip': 0.269,
    '--tooltip-on': 0.985,
  },
  dark: {
    '--bg': 0.145,
    '--bg-raised': 0.205,
    '--bg-sunken': 0.185,
    '--bg-hover': 0.269,
    '--bg-active': 0.32,
    '--border': 0.285,
    '--border-strong': 0.38,
    '--text': 0.985,
    '--text-muted': 0.708,
    '--text-faint': 0.556,
    '--brand': 0.922,
    '--brand-on': 0.205,
    '--brand-soft': 0.3,
    '--tooltip': 0.32,
    '--tooltip-on': 0.985,
  },
}

/**
 * Upstream keys that are a hue rather than a grey.
 *
 * `destructive` and the chart ramp carry real colour, so letting them donate
 * chroma to a nearby step would tint the chrome red at whatever lightness they
 * happen to sit at. `sidebar-primary` is the trap: grey in every light palette,
 * and upstream's blue chart-1 in every dark one — so it is invisible until a
 * token lands near 0.488 in dark mode, where `--border-strong` sits, and the
 * borders come out blue in an otherwise neutral theme.
 */
const NOT_A_GREY = /^(destructive|sidebar-primary|chart-\d)$/

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/

function parseOklch(value) {
  const match = OKLCH.exec(value.trim())
  if (!match) return null // translucent (`oklch(1 0 0 / 10%)`) or a keyword
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) }
}

/** The greys of one theme in one mode, as colour samples to interpolate from. */
function samples(cssVars) {
  const found = []
  for (const [key, value] of Object.entries(cssVars)) {
    if (NOT_A_GREY.test(key)) continue
    const colour = parseOklch(value)
    if (colour) found.push(colour)
  }
  return found
}

/** The chroma and hue of whichever sample sits closest in lightness. */
function tintAt(found, lightness) {
  let best = found[0]
  for (const colour of found) {
    if (Math.abs(colour.l - lightness) < Math.abs(best.l - lightness)) best = colour
  }
  return best
}

function oklch(l, c, h) {
  // Trailing zeroes dropped so neutral reads `oklch(0.97 0 0)` — the same string
  // the stylesheet already has, which is what makes the no-op provable.
  const round = n => String(Number(n.toFixed(4)))
  return `oklch(${round(l)} ${round(c)} ${round(h)})`
}

/* -- oklch to sRGB ------------------------------------------------------- *
 * Needed for exactly one token: `--check-tick` is a data URI, and a data URI
 * cannot read a custom property from inside, so the tick's colour has to be
 * baked in as a literal per theme.
 */
function oklchToHex(l, c, h) {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  const rgb = [
    +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]

  return `#${rgb
    .map(channel => {
      const srgb = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
      const byte = Math.round(Math.min(1, Math.max(0, srgb)) * 255)
      return byte.toString(16).padStart(2, '0')
    })
    .join('')}`
}

function checkTick(hex) {
  const stroke = `%23${hex.slice(1)}`
  return (
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' ` +
    `fill='none' stroke='${stroke}' stroke-width='2' stroke-linecap='round' ` +
    `stroke-linejoin='round'%3E%3Cpath d='m4 8.2 2.8 2.8 5.2-5.2'/%3E%3C/svg%3E")`
  )
}

function baseTokens(theme, mode) {
  const found = samples(theme.cssVars[mode])
  const tokens = {}
  for (const [name, lightness] of Object.entries(LADDER[mode])) {
    const { c, h } = tintAt(found, lightness)
    tokens[name] = oklch(lightness, c, h)
  }
  const faint = tintAt(found, LADDER[mode]['--text-faint'])
  tokens['--check-tick'] = checkTick(
    oklchToHex(LADDER[mode]['--text-faint'], faint.c, faint.h),
  )
  return tokens
}

/**
 * An accent replaces the brand triplet, not the whole palette.
 *
 * Upstream's `primary` is deliberately *not* used, and that is the one place
 * this generator disagrees with its source. Shadcn's `primary` is a button
 * background: dark in light mode, dark again in dark mode, with a light
 * `primary-foreground` on top. This app also writes `color: var(--brand)` — the
 * folder glyphs, the matched characters in Quick Open, the caret, the dirty dot
 * — so `--brand` has to be a *contrast step against the background*, which is
 * what it already is for neutral: 0.205 on white, 0.922 on near-black. Taking
 * `primary` straight would put dark blue text on a near-black sidebar, and in
 * light mode Lime and Yellow sit at 0.84 — a brand colour invisible on white.
 *
 * So the hue comes from upstream's chart ramp, which is the accent's own scale
 * from light to dark, and the step nearest our target lightness wins. The two
 * ends of that ramp are exactly the two contrast steps we need.
 */
const BRAND_TARGET = { light: 0.45, dark: 0.83 }

function accentTokens(theme, mode) {
  const ramp = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']
    .map(key => parseOklch(theme.cssVars[mode][key] ?? ''))
    .filter(Boolean)
  const brand = tintAt(ramp, BRAND_TARGET[mode])

  // The label on a brand-coloured button: our own extreme, tinted just enough
  // to belong to the accent rather than read as a second colour.
  const on = mode === 'light' ? { l: 0.985, cap: 0.02 } : { l: 0.205, cap: 0.03 }
  // "The brand, quietly" — behind a selected row, where full strength would be
  // louder than the text on it. Upstream has no such step, so it is derived.
  const soft = mode === 'light' ? { l: 0.94, cap: 0.05 } : { l: 0.3, cap: 0.06 }

  return {
    '--brand': oklch(brand.l, brand.c, brand.h),
    '--brand-on': oklch(on.l, Math.min(on.cap, brand.c), brand.h),
    '--brand-soft': oklch(soft.l, Math.min(soft.cap, brand.c * 0.25), brand.h),
  }
}

const data = JSON.parse(readFileSync(SOURCE, 'utf8'))

const bases = data.baseColors.map(theme => ({
  name: theme.name,
  title: theme.title,
  swatch: theme.swatch,
  light: baseTokens(theme, 'light'),
  dark: baseTokens(theme, 'dark'),
}))

/*
 * No `swatch` on an accent, deliberately.
 *
 * A base colour needs one because its `--brand` is near-black in light and
 * near-white in dark — a dot drawn from it would say nothing about which grey
 * you are choosing. An accent *is* its brand colour, so settings draws the dot
 * from whichever theme is on screen, and the swatch is then the colour you will
 * actually get rather than the light-mode one.
 */
const accents = data.accents.map(theme => ({
  name: theme.name,
  title: theme.title,
  light: accentTokens(theme, 'light'),
  dark: accentTokens(theme, 'dark'),
}))

const literal = value => JSON.stringify(value, null, 2).replace(/\n/g, '\n')

const file = `/*
 * Generated by \`scripts/gen-theme-presets.mjs\` — do not edit by hand.
 *
 * Source: the theme customizer on shadcn-svelte.com, vendored at
 * \`scripts/theme-presets/shadcn-themes.json\`. Run the generator to re-sync.
 *
 * A base colour is a whole palette; an accent replaces only the brand triplet
 * on top of it. That is upstream's own split — you pick a base colour, then a
 * theme within it — and it is why picking "Blue" does not turn the sidebar blue.
 */

/** One theme's contribution: CSS custom property name to value. */
export type ThemeTokens = Record<string, string>

export interface ThemePreset {
  name: string
  title: string
  /**
   * The dot shown beside the name in settings — base colours only, whose own
   * \`--brand\` is a contrast step rather than a hue and would say nothing.
   */
  swatch?: string
  light: ThemeTokens
  dark: ThemeTokens
}

export const BASE_COLORS: ThemePreset[] = ${literal(bases)}

export const ACCENTS: ThemePreset[] = ${literal(accents)}

/**
 * Corner rounding, upstream's five steps.
 *
 * \`default\` is 0.5rem, which is what \`app.css\` already declares — so the
 * default choice writes the value the stylesheet was going to use anyway.
 */
export const RADII: Array<{ name: string; title: string; value: string }> = ${literal(
  data.radii ?? [
    { name: 'none', title: 'None', value: '0rem' },
    { name: 'small', title: 'Small', value: '0.45rem' },
    { name: 'default', title: 'Default', value: '0.5rem' },
    { name: 'medium', title: 'Medium', value: '0.625rem' },
    { name: 'large', title: 'Large', value: '0.875rem' },
  ],
)}
`

writeFileSync(TARGET, file)
console.log(`wrote ${TARGET}: ${bases.length} base colours, ${accents.length} accents`)
