import { dropIntoFolder } from '@/actions'

/**
 * Dragging a file onto a folder in the tree.
 *
 * A private MIME type rather than `text/plain` alone, because the tree has to
 * tell its own rows apart from a file dragged in from Finder or a selection
 * dragged out of the editor — neither of which it should treat as a move. The
 * plain-text copy rides along so the same drag still means something outside.
 */
const PATH_TYPE = 'application/x-orbit-path'

export function startPathDrag(event: DragEvent, path: string) {
  const data = event.dataTransfer
  if (!data) return
  data.setData(PATH_TYPE, path)
  data.setData('text/plain', path)
  // `copyMove` is what makes the pointer show the modifier's effect while the
  // drag is in flight, so ⌥ is visible before the drop rather than after it.
  data.effectAllowed = 'copyMove'
}

/**
 * Marks the row as a valid target and reports which of move/copy would happen.
 *
 * The dragged path is deliberately *not* read here: browsers withhold the data
 * until the drop, so `types` is the only thing a dragover handler can see.
 */
export function overFolder(event: DragEvent): boolean {
  const data = event.dataTransfer
  if (!data?.types.includes(PATH_TYPE)) return false
  event.preventDefault()
  data.dropEffect = event.altKey ? 'copy' : 'move'
  return true
}

export function dropOnFolder(event: DragEvent, dir: string) {
  const path = event.dataTransfer?.getData(PATH_TYPE)
  if (!path) return
  event.preventDefault()
  void dropIntoFolder(path, dir, event.altKey)
}

/**
 * Whether the pointer left the row itself rather than crossing onto one of its
 * own children — the difference between "no longer a target" and the flicker
 * every naive `dragleave` produces.
 */
export function leftRow(event: DragEvent): boolean {
  const row = event.currentTarget as Node
  const to = event.relatedTarget as Node | null
  return !to || !row.contains(to)
}
