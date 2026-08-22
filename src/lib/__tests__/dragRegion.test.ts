import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * WKWebView has no `app-region`, so Electrobun reimplements it in a preload
 * script that matches two literal class names with `closest()`. A stylesheet
 * rule is invisible to it — which is how the title bar shipped undraggable once
 * already.
 *
 * Nothing fails loudly when that contract breaks: the bar simply stops moving.
 * So assert it here, where an Electrobun upgrade that renames the hooks turns
 * into a red test instead of a silently dead window.
 */
const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8')

const PRELOAD = read('../../../node_modules/electrobun/dist/api/bun/preload/dragRegions.ts')
/*
 * The names live in `BarButton.svelte`, which exports them as `DRAG`/`NO_DRAG`
 * for every control in the bar to spread. Reading the file rather than the
 * constants keeps this a check on the *literal* strings Electrobun matches.
 */
const BAR_BUTTON = read('../components/BarButton.svelte')

describe('title bar drag region', () => {
  it.each([
    ['electrobun-webkit-app-region-drag'],
    ['electrobun-webkit-app-region-no-drag'],
  ])('%s is still the class Electrobun looks for', name => {
    expect(PRELOAD).toContain(`.${name}`)
    expect(BAR_BUTTON).toContain(name)
  })

  it('still moves the window on mousedown', () => {
    expect(PRELOAD).toContain('startWindowMove')
  })
})
