import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A duplicate declaration inside `@theme` is silent and destructive.
 *
 * `--color-accent` was declared twice — once as shadcn's hover surface and
 * again, twelve lines later, as the brand colour. The later one won, so
 * `bg-accent` resolved to near-black and every shadcn component that uses it
 * for hover grew a black bar: menu items, select options, outline buttons, the
 * dialog close. Nothing warned; it just looked wrong.
 *
 * So assert it structurally rather than trusting the next person to notice.
 */
const CSS = readFileSync(resolve(import.meta.dirname, '../../app.css'), 'utf8')

function themeBlock(): string {
  const start = CSS.indexOf('@theme inline')
  expect(start).toBeGreaterThan(-1)
  return CSS.slice(start, CSS.indexOf('\n}', start))
}

describe('design tokens', () => {
  it('declares each @theme token exactly once', () => {
    const seen = new Map<string, number>()
    for (const [, name] of themeBlock().matchAll(/^\s*(--[\w-]+):/gm)) {
      seen.set(name!, (seen.get(name!) ?? 0) + 1)
    }
    const duplicated = [...seen].filter(([, count]) => count > 1).map(([name]) => name)
    expect(duplicated).toEqual([])
  })

  it('keeps shadcn\'s hover surface out of the brand colour', () => {
    // The rule AGENTS.md states, in a form that fails a build.
    expect(themeBlock()).toContain('--color-accent: var(--accent)')
    expect(themeBlock()).not.toContain('--color-accent: var(--brand)')
  })

  it('defines every token in both themes', () => {
    const names = (block: string) => new Set([...block.matchAll(/^\s*(--[\w-]+):/gm)].map(m => m[1]))
    const media = CSS.slice(CSS.indexOf("prefers-color-scheme: dark"))
    const forced = CSS.slice(CSS.indexOf("[data-theme='dark']"))
    const missing = [...names(media.slice(0, media.indexOf('\n  }')))].filter(
      name => !names(forced.slice(0, forced.indexOf('\n}'))).has(name),
    )
    // A token defined only under the media query ignores an explicit theme
    // choice, so the toggle would stop working for exactly that colour.
    expect(missing).toEqual([])
  })
})
