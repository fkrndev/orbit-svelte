import type {
  BookmarkKind,
  FolderDecor,
  RecentSort,
  RecentsPreview,
  SidebarPanel,
} from '$shared/types'
import { isStaleFilter } from '$shared/treeFilter'
import { api } from './rpcClient'
import { getState, notify, setState } from './store.svelte'
import {
  collapseAll,
  collapseUnder,
  expandMany,
  hydrateExpanded,
  pruneToRoots,
  reveal,
  serializeExpanded,
  toggle,
} from './tree'

/**
 * Sidebar actions.
 *
 * The split mirrors `navHistory.ts` / `navigation.ts`: `tree.ts` holds the pure
 * transitions, this file is the only place that wires them to the store and to
 * the backend.
 */

// ---- persistence -----------------------------------------------------------

/**
 * Writing the open-folder set is debounced.
 *
 * Expanding a path is one click and one store write; Expand All is one click
 * and several hundred. Persisting each one would turn a single gesture into a
 * burst of writes to a file that is rewritten whole every time.
 */
let persistTimer: ReturnType<typeof setTimeout> | null = null

export function persistTree() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void api
      .saveSettings({ patch: { expandedPaths: serializeExpanded(getState().tree) } })
      .catch(() => undefined)
  }, 400)
}

/**
 * Tells the tree to re-read a directory.
 *
 * The tree keeps its own `listDir` result per folder, and the only thing that
 * normally invalidates one is a `renamed`/`created`/`deleted` event arriving on
 * the push channel. That is the right mechanism for changes made outside the
 * app, and the wrong one for changes the app just made itself: the event is a
 * round trip, and a dropped or delayed frame leaves the folder drawn under a
 * name that no longer exists, with nothing further coming to correct it.
 *
 * Same reasoning as `app:meta-changed`, which the metadata writes already use.
 */
export function notifyDirChanged(path: string) {
  window.dispatchEvent(new CustomEvent('app:dir-changed', { detail: path }))
}

/** Restores the tree at boot, dropping folders no longer inside any root. */
export function hydrateTree(expandedPaths: string[] | undefined, rootPaths: string[]) {
  setState({ tree: pruneToRoots(hydrateExpanded(expandedPaths), rootPaths) })
}

// ---- tree ------------------------------------------------------------------

export function toggleFolder(path: string) {
  setState(prev => ({ tree: toggle(prev.tree, path) }))
  persistTree()
}

export function revealInTree(path: string) {
  const state = getState()
  const root = state.roots.find(candidate => path.startsWith(`${candidate.path}/`))
  if (!root) return
  // A collapsed root would hide the file no matter how many folders below it
  // are open, so the root's own flag has to come along.
  if (root.collapsed) void setRootCollapsed(root.id, false)
  setState(prev => ({ tree: reveal(prev.tree, root.path, path) }))
  persistTree()
}

/** Reveals whatever is open in the editor. Wired to the menu and the toolbar. */
export function revealActiveFile() {
  const { activePath, settings } = getState()
  if (!activePath) {
    notify('info', 'No file open to reveal')
    return
  }
  if (settings.sidebarPanel !== 'files') void setSidebarPanel('files')
  revealInTree(activePath)
}

export async function expandAll(rootPath: string) {
  try {
    const { dirs, truncated } = await api.listTreeDirs({ rootPath })
    setState(prev => ({ tree: expandMany(prev.tree, dirs) }))
    persistTree()
    // A silently truncated expansion reads as "this is the whole folder".
    if (truncated) notify('info', `Expanded the first ${dirs.length} folders`)
  } catch {
    notify('error', 'Could not expand this folder')
  }
}

export function collapseAllIn(rootPath: string) {
  setState(prev => ({ tree: collapseUnder(prev.tree, rootPath) }))
  persistTree()
}

/**
 * Closes the whole sidebar — the folders inside each root *and* the root
 * headers themselves.
 *
 * The two halves are stored apart: folders are keys in `tree.expanded`, a
 * root's own state is a flag on the root record. Clearing only the tree left
 * every root open, so with one root and nothing expanded under it the button
 * did visibly nothing.
 */
export async function collapseEverything() {
  const open = getState().roots.filter(root => !root.collapsed)
  setState(prev => ({
    tree: collapseAll(),
    roots: prev.roots.map(root => (root.collapsed ? root : { ...root, collapsed: true })),
  }))
  persistTree()
  await Promise.all(
    open.map(root =>
      api.setRootCollapsed({ id: root.id, collapsed: true }).catch(() => undefined),
    ),
  )
}

// ---- filter ----------------------------------------------------------------

const FILTER_DEBOUNCE_MS = 120
let filterTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Runs the name filter over the tree.
 *
 * Results are matched against the query they were asked for rather than the
 * order they arrive in: a slow response for `pl` must not overwrite a fast one
 * for `plan`, which is what makes fast typing feel like it skips characters.
 */
export function setTreeQuery(query: string) {
  setState(prev => ({ sidebar: { ...prev.sidebar, query } }))

  if (filterTimer) clearTimeout(filterTimer)

  if (!query.trim()) {
    setState(prev => ({ sidebar: { ...prev.sidebar, filter: null, filtering: false } }))
    return
  }

  setState(prev => ({ sidebar: { ...prev.sidebar, filtering: true } }))
  filterTimer = setTimeout(() => {
    filterTimer = null
    void api
      .filterTree({ query })
      .then(result => {
        if (isStaleFilter(getState().sidebar.query, result.query)) return
        setState(prev => ({ sidebar: { ...prev.sidebar, filter: result, filtering: false } }))
      })
      .catch(() => {
        setState(prev => ({ sidebar: { ...prev.sidebar, filter: null, filtering: false } }))
      })
  }, FILTER_DEBOUNCE_MS)
}

export function clearTreeQuery() {
  setTreeQuery('')
}

/**
 * Asks the visible panel's filter box for focus. The input clears the request
 * once it has it.
 *
 * All three panels have one, and they filter different things — every root, the
 * rows Recents is holding, the list you arranged — so the shortcut lands where
 * you already are rather than dragging you to Files, which would leave the
 * other two boxes unreachable from the keyboard.
 */
export function focusSidebarFilter() {
  setState(prev => ({ sidebar: { ...prev.sidebar, focusFilter: prev.sidebar.focusFilter + 1 } }))
}

// ---- panels ----------------------------------------------------------------

export async function setSidebarPanel(panel: SidebarPanel) {
  setState(prev => ({ settings: { ...prev.settings, sidebarPanel: panel } }))
  await api.saveSettings({ patch: { sidebarPanel: panel } }).catch(() => undefined)
}

export async function setRecentsSort(recentsSort: RecentSort) {
  setState(prev => ({ settings: { ...prev.settings, recentsSort } }))
  await api.saveSettings({ patch: { recentsSort } }).catch(() => undefined)
}

export async function setRecentsGrouped(recentsGrouped: boolean) {
  setState(prev => ({ settings: { ...prev.settings, recentsGrouped } }))
  await api.saveSettings({ patch: { recentsGrouped } }).catch(() => undefined)
}

export async function setRecentsPreview(recentsPreview: RecentsPreview) {
  setState(prev => ({ settings: { ...prev.settings, recentsPreview } }))
  await api.saveSettings({ patch: { recentsPreview } }).catch(() => undefined)
}

export async function setShowPinned(sidebarShowPinned: boolean) {
  setState(prev => ({ settings: { ...prev.settings, sidebarShowPinned } }))
  await api.saveSettings({ patch: { sidebarShowPinned } }).catch(() => undefined)
}

// ---- roots -----------------------------------------------------------------

export async function setRootCollapsed(id: string, collapsed: boolean) {
  setState(prev => ({
    roots: prev.roots.map(root => (root.id === id ? { ...root, collapsed } : root)),
  }))
  await api.setRootCollapsed({ id, collapsed }).catch(() => undefined)
}

export async function toggleRootPinned(id: string) {
  const current = getState().roots.find(root => root.id === id)
  if (!current) return
  try {
    setState({ roots: await api.setRootPinned({ id, pinned: !current.pinned }) })
  } catch {
    notify('error', 'Could not pin that folder')
  }
}

// ---- bookmarks -------------------------------------------------------------

export async function refreshBookmarks() {
  try {
    setState({ bookmarks: await api.listBookmarks() })
  } catch {
    // A stale list beats an empty one; the panel stays usable.
  }
}

export async function addBookmark(input: {
  kind: BookmarkKind
  path?: string
  title?: string
  groupId?: string | null
}) {
  try {
    setState({ bookmarks: await api.addBookmark(input) })
  } catch {
    notify('error', 'Could not add that bookmark')
  }
}

export async function removeBookmark(id: string) {
  try {
    setState({ bookmarks: await api.removeBookmark({ id }) })
  } catch {
    notify('error', 'Could not remove that bookmark')
  }
}

export async function renameBookmark(id: string, title: string) {
  try {
    setState({ bookmarks: await api.renameBookmark({ id, title }) })
  } catch {
    notify('error', 'Could not rename that bookmark')
  }
}

export async function moveBookmark(id: string, groupId: string | null, order: number) {
  try {
    setState({ bookmarks: await api.moveBookmark({ id, groupId, order }) })
  } catch {
    notify('error', 'Could not move that bookmark')
  }
}

/** Menu and toolbar entry point: bookmark the open file, or remove it again. */
export async function toggleBookmarkForPath(path: string) {
  const existing = getState().bookmarks.find(entry => entry.path === path)
  if (existing) {
    await removeBookmark(existing.id)
    notify('info', 'Bookmark removed')
    return
  }
  await addBookmark({ kind: 'file', path })
  notify('info', 'Bookmarked')
}

// ---- decoration ------------------------------------------------------------

/**
 * Folder icons and colours, fetched in one call per folder listing.
 *
 * Merged into the existing map rather than replacing it: several `DirNode`s
 * load in parallel, and the last one to answer must not erase the others.
 */
export async function loadFolderDecor(paths: string[]) {
  if (paths.length === 0) return
  try {
    const decor = await api.getFolderDecor({ paths })
    setState(prev => ({ folderDecor: { ...prev.folderDecor, ...decor } }))
  } catch {
    // Decoration is decoration; the tree works without it.
  }
}

export async function setFolderDecor(path: string, decor: FolderDecor) {
  setState(prev => {
    const next = { ...prev.folderDecor }
    if (!decor.icon && !decor.color) delete next[path]
    else next[path] = decor
    return { folderDecor: next }
  })
  await api.setFolderDecor({ path, decor }).catch(() => notify('error', 'Could not save that icon'))
}
