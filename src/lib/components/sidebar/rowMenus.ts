import type { FileMeta } from '$shared/types'
import { getState, notify } from '@/store.svelte'
import { addBookmark, removeBookmark } from '@/sidebar'

/**
 * The shared parts of the row context menus.
 *
 * The menus themselves are `FileMenu.svelte` and `FolderMenu.svelte` — every
 * panel renders the same two, so the same file offers the same actions wherever
 * it is listed. What lives here is the logic they have in common, which is not
 * markup and does not belong inside a component.
 */

/**
 * The row's action cluster, floated over the right edge instead of laid out
 * beside the label.
 *
 * In flow it costs width either way: reserved, and every name in the sidebar is
 * permanently truncated for buttons nobody can see; collapsed, and the name
 * reflows the moment the pointer arrives. Floating it costs the label nothing
 * and moves nothing — it just covers the tail of a name that was already too
 * long for the row. `bg-inherit` picks up whichever background the row is
 * wearing, hover or active, so the cover is invisible.
 *
 * The row it sits in must be `relative`.
 */
export const ROW_ACTIONS =
  'absolute inset-y-0 right-0 flex items-center gap-0.5 rounded-r bg-inherit pl-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100'

/** One button in that cluster. Fixed size — a padding that grows on hover reads as a jump. */
export const ROW_ACTION = 'shrink-0 rounded p-1'

/** What the sidebar asks the shell to open the icon picker for. */
export interface DecorRequest {
  path: string
  kind: 'file' | 'folder'
  name: string
  icon?: string
  color?: string
}

/**
 * Only the three fields the menu reads.
 *
 * Narrower than `FileMeta` so panels that never fetch a full record — Recents
 * has a `RecentItem`, Bookmarks has a path — can offer the same menu without
 * inventing the rest of a metadata object to satisfy a type.
 */
export type MenuMeta = Pick<FileMeta, 'pinned'> & Partial<Pick<FileMeta, 'icon' | 'color'>>

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    notify('info', 'Path copied')
  } catch {
    notify('error', 'Could not copy the path')
  }
}

/** Bookmark state is read from the store so the label matches reality. */
export function bookmarkIdFor(path: string): string | null {
  return getState().bookmarks.find(entry => entry.path === path)?.id ?? null
}

export function toggleBookmark(kind: 'file' | 'folder', path: string, id: string | null) {
  if (id) void removeBookmark(id)
  else void addBookmark({ kind, path })
}

/** Used by the Recents and Bookmarks panels, which have no `DirEntry` to hand. */
export function metaForPath(path: string): FileMeta | undefined {
  return getState().tabs.find(tab => tab.path === path)?.meta ?? undefined
}

/** Builds the decor request from whatever the panel already knows. */
export function decorRequest(
  path: string,
  kind: 'file' | 'folder',
  name: string,
  decor: { icon?: string; color?: string } | undefined,
): DecorRequest {
  return {
    path,
    kind,
    name,
    ...(decor?.icon ? { icon: decor.icon } : {}),
    ...(decor?.color ? { color: decor.color } : {}),
  }
}
