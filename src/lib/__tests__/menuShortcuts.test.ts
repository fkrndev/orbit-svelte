import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The native menu and the browser build's key handler are two lists of the same
 * bindings, and nothing connects them.
 *
 * On the desktop the menu owns every accelerator; in a browser tab there is no
 * menu, so `+page.svelte` binds the same chords itself. Adding a command to one
 * and not the other is invisible — the shortcut simply does nothing in the build
 * you were not testing in, which is exactly the build someone else is using.
 *
 * So the two files are read as text and compared. Text rather than imports
 * because `menu.ts` pulls in `electrobun/bun`, which cannot load under vitest,
 * and because what has to match is the literal accelerator either way.
 */

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8')

const MENU = read('../../bun/menu.ts')
const PAGE = read('../../routes/+page.svelte')

/** `{ label: 'Save', action: 'save', accelerator: 'CmdOrCtrl+s' }` */
const ENTRY = /action:\s*'([a-z-]+)'(?:,\s*accelerator:\s*'([^']+)')?/g

/**
 * Accelerators the browser build deliberately does not take.
 *
 * `⌘R` is the browser's own reload, and intercepting it would mean the one key
 * everybody presses when a page is wedged stops working. The desktop build has
 * no such owner, so it keeps the menu item — and `reload-view` still saves every
 * dirty buffer first either way.
 *
 * `⇧⌘V` is the browser's own paste-without-formatting, which the editor already
 * honours — ProseMirror reads the shift key itself. The menu item exists because
 * WKWebView performs no paste for a key no menu declares; binding it here as
 * well would replace a working paste with a slower one.
 */
const NOT_IN_BROWSER = new Set(['reload-view', 'paste-plain'])

interface MenuEntry {
  action: string
  accelerator: string
}

const entries: MenuEntry[] = [...MENU.matchAll(ENTRY)]
  .filter(match => match[2] !== undefined)
  .map(match => ({ action: match[1]!, accelerator: match[2]! }))

/** `CmdOrCtrl+Shift+r` -> `{ key: 'r', shift: true }`, the shape the page decides on. */
function parse(accelerator: string): { key: string; shift: boolean } {
  const parts = accelerator.split('+')
  return { key: parts[parts.length - 1]!.toLowerCase(), shift: parts.includes('Shift') }
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('menu accelerators and the browser key handler', () => {
  it('finds the menu (a rename would otherwise make this suite vacuous)', () => {
    expect(entries.length).toBeGreaterThan(15)
  })

  it.each(entries.filter(entry => !NOT_IN_BROWSER.has(entry.action)))(
    '$action is bound in the browser build too',
    ({ action, accelerator }) => {
      const { key, shift } = parse(accelerator)
      const literal = escapeForRegex(key)

      const bound = shift
        ? // The shifted variants are a run of explicit `if` lines.
          new RegExp(`shift && normalized === '${literal}'\\) return '${action}'`).test(PAGE)
        : // The unshifted ones are a plain lookup table, whose keys are quoted
          // only when they are not bare identifiers (`n:` but `'[':`).
          new RegExp(`'?${literal}'?: '${action}'`).test(PAGE)

      expect(bound, `${accelerator} (${action}) is in the menu but not in browserShortcut`).toBe(
        true,
      )
    },
  )

  it.each([...NOT_IN_BROWSER])('%s is left to the browser on purpose', action => {
    expect(PAGE).not.toContain(`: '${action}'`)
  })
})
