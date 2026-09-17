import { startRename } from '@/actions'
import { getState } from '@/store.svelte'
import { setSidebarHighlight } from '@/sidebar'
import { copyPath } from './rowMenus'

/**
 * The keyboard for every sidebar panel, held on the column rather than on each
 * row.
 *
 * From the filter box the arrows do not move focus: they move a highlight down
 * the results while the caret stays where you are typing, and ↵ opens the row
 * it is on. That is the model ⌘P already uses, and the one people expect from a
 * search box — moving focus instead leaves the query behind and the list
 * looking unchanged, because a focus ring on a row that is already tinted says
 * nothing.
 *
 * Inside the list — reached by Tab or a click — ↑/↓ still move focus row to
 * row, ⇧↵ renames, and ⌃↵ copies the path. Plain ↵ there is missing on purpose:
 * every row's label *is* a button, so the browser already activates it.
 *
 * One listener, because the rows are drawn by a dozen components across four
 * panels and the ones below a folder do not exist until it is opened. The DOM
 * is also the only thing that knows what order they are in, which is why the
 * highlight is stored as a path and resolved back through it here.
 */

const ROW_BUTTONS = '[data-row-path] > button:not(:disabled)'

/** Every row currently on screen, in the order they are drawn. */
function rowsIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(ROW_BUTTONS)]
}

function pathOf(button: HTMLElement): string {
  return button.parentElement?.dataset.rowPath ?? ''
}

export function onRowKey(event: KeyboardEvent) {
  const container = event.currentTarget as HTMLElement
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-row-path]')

  if (!row) {
    if (!(event.target instanceof HTMLInputElement)) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return

    const buttons = rowsIn(container)
    if (buttons.length === 0) return
    event.preventDefault()

    const here = buttons.findIndex(button => pathOf(button) === getState().sidebar.highlight)

    if (event.key === 'Enter') {
      // Nothing picked yet means the top result, which is what ↵ in a search
      // box has always meant.
      buttons[here === -1 ? 0 : here]?.click()
      return
    }

    // From nothing, ↓ takes the first row and ↑ the last. Both ends stop rather
    // than wrap: a list that loops has no edge to feel, and these lists are long.
    const next =
      here === -1
        ? (event.key === 'ArrowDown' ? buttons[0] : buttons.at(-1))
        : buttons[Math.min(Math.max(here + (event.key === 'ArrowDown' ? 1 : -1), 0), buttons.length - 1)]
    if (!next) return
    setSidebarHighlight(pathOf(next))
    next.scrollIntoView({ block: 'nearest' })
    return
  }

  const path = row.dataset.rowPath
  if (!path) return

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    // The row's own label button, which is its only direct button child — the
    // action cluster's buttons sit one div deeper. Disabled ones are the root
    // rows during a filter, and focus would silently refuse them.
    const buttons = rowsIn(container)
    // Located from the row rather than from `event.target`, so an arrow pressed
    // with the row's ⋮ button focused still moves by one row.
    const here = buttons.indexOf(row.querySelector(':scope > button')!)
    const next = buttons[here + (event.key === 'ArrowDown' ? 1 : -1)]
    event.preventDefault()
    if (next) next.focus()
    // Above the first row is the filter box, so ↑ hands the caret back rather
    // than stopping dead with no way out but the mouse.
    else if (event.key === 'ArrowUp') container.querySelector('input')?.focus()
    return
  }

  if (event.key !== 'Enter') return
  if (event.shiftKey) {
    // Suppresses the button's own activation, which would otherwise open the
    // file *and* put a rename dialog over it.
    event.preventDefault()
    startRename(path, row.dataset.rowKind === 'folder' ? 'folder' : 'file')
  } else if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    void copyPath(path)
  }
}
