import { startRename } from '@/actions'
import { copyPath } from './rowMenus'

/**
 * The keyboard for every sidebar panel, held on the column rather than on each
 * row.
 *
 * ↑/↓ move between rows, ⇧↵ renames, ⌃↵ copies the path. Plain ↵ on a row is
 * missing on purpose: every row's label *is* a button, so the browser already
 * activates it — opening a file, expanding a folder — and a handler here would
 * only be a second way to do the same thing, out of step the first time a row's
 * click changes.
 *
 * From the filter box the same two keys carry on into the list: ↓ steps onto
 * the first result, ↵ opens it. Without that the search is a dead end you have
 * to leave by mouse, which is the whole reason this sits one level above the
 * rows — one listener, because the rows are drawn by a dozen components across
 * four panels and the ones below a folder do not exist until it is opened.
 */

const ROW_BUTTONS = '[data-row-path] > button:not(:disabled)'

export function onRowKey(event: KeyboardEvent) {
  const container = event.currentTarget as HTMLElement
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-row-path]')

  if (!row) {
    if (!(event.target instanceof HTMLInputElement)) return
    if (event.key !== 'ArrowDown' && event.key !== 'Enter') return
    const first = container.querySelector<HTMLElement>(ROW_BUTTONS)
    if (!first) return
    event.preventDefault()
    if (event.key === 'Enter') first.click()
    else first.focus()
    return
  }

  const path = row.dataset.rowPath
  if (!path) return

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    // The row's own label button, which is its only direct button child — the
    // action cluster's buttons sit one div deeper. Disabled ones are the root
    // rows during a filter, and focus would silently refuse them.
    const buttons = [...container.querySelectorAll<HTMLElement>(ROW_BUTTONS)]
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
