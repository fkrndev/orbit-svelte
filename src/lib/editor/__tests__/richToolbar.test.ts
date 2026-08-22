import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { commands } from '@/components/edra/commands/index'

/**
 * `RichToolbar` reaches into Edra's command registry **by name**, and a name
 * that is not there resolves to `undefined` and is filtered out. That is the
 * right behaviour at runtime — a missing command should not take the toolbar
 * down with it — but it means the two ways this can break are both silent:
 *
 * 1. Edra renames or removes a command, and the button simply stops appearing.
 * 2. Edra *adds* one, and it never appears, because the toolbar draws only the
 *    names it was told about rather than everything in the registry the way the
 *    stock `Toolbar` did.
 *
 * Neither throws, neither fails a type check, and both are invisible unless you
 * happen to look for the button that went missing. So the file is read as text
 * and its names are compared against the registry in both directions.
 *
 * Text rather than an import because the groups are `const`s inside a `.svelte`
 * module context, which is not importable on its own — and because what has to
 * match is the literal string either way.
 */

const SOURCE = readFileSync(resolve(import.meta.dirname, '../RichToolbar.svelte'), 'utf8')

/** The names inside `pick(...)` / `BY_NAME.get(...)` calls, quoted singly. */
const REFERENCED = new Set(
  [...SOURCE.matchAll(/(?:pick\(|BY_NAME\.get\()([^)]*)\)/g)]
    .flatMap(match => [...match[1]!.matchAll(/'([^']+)'/g)])
    .map(match => match[1]!),
)

const REGISTERED = new Set(
  Object.values(commands)
    .flat()
    .map(command => command.name),
)

describe('the folded toolbar against Edra’s registry', () => {
  it('finds the toolbar (a rename would otherwise make this suite vacuous)', () => {
    expect(REFERENCED.size).toBeGreaterThan(25)
  })

  it.each([...REFERENCED])('%s is a command Edra actually registers', name => {
    expect(REGISTERED.has(name)).toBe(true)
  })

  /**
   * The direction that catches an *addition*. Every command Edra ships has to be
   * placed somewhere — on the bar, or in one of the menus. Folding the toolbar
   * was meant to make it shorter, not shorter by leaving things out.
   *
   * A command that genuinely should not be offered belongs in an explicit
   * exclusion here, with the reason, rather than being quietly absent.
   */
  it.each([...REGISTERED])('%s is placed somewhere in the toolbar', name => {
    expect(REFERENCED.has(name)).toBe(true)
  })
})
