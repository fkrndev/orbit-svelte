import type {
  AppSettings,
  BookmarkView,
  FileMeta,
  FolderDecor,
  LabelDef,
  Root,
  TreeFilterResult,
} from '$shared/types'
import { DEFAULT_SETTINGS } from '$shared/types'
import { EMPTY_PROPERTY_SCHEMA, type PropertySchema } from '$shared/propertySchema'
import { EMPTY_NAV, dropNavPath, entryFor, navAt, retargetNav, type NavState } from './navHistory'
import { EMPTY_TREE, movePrefix, type TreeState } from './tree'
import { retargetUnder } from '$shared/rename'
import type { EditorFindMatch } from './editor/editorFind'

/**
 * One shared object with a handful of writers.
 *
 * The React build reached the same shape through `useSyncExternalStore`, which
 * compares snapshots by reference — and that carried a rule with teeth: a
 * selector that built a new array (`state => state.x.filter(…)`) never settled,
 * React retried until it threw "maximum update depth exceeded", and the window
 * went blank. Runes have no snapshot to compare, so that rule is gone: read
 * `getState()` inside `$derived` and filter freely.
 *
 * `getState()` rather than an exported binding because Svelte forbids exporting
 * a `$state` variable that is reassigned, and `setState` reassigns — which is
 * deliberate, so that a spread patch keeps untouched branches reference-equal
 * and `$derived` values over them do not invalidate.
 */

export interface Tab {
  path: string
  name: string
  /** What is currently in the editor. */
  content: string
  /** What was last written to (or read from) disk — the dirty check compares against this. */
  savedContent: string
  /** mtime of the last read/write, used to detect external edits before saving. */
  mtimeMs: number
  meta: FileMeta | null
  /** Set when the file changed on disk while we had unsaved edits. */
  conflict: boolean
  /** Set when the file disappeared from disk. */
  missing: boolean
}

/**
 * `browse` is the path browser — a place, not a dialog.
 *
 * It was a modal first, and that was the wrong shape for it: finding the note
 * you are about to read is a *destination*, the same way the dashboard is, and
 * a modal throws away where you had got to the moment you glance at anything
 * else. As a surface it keeps its folder, its query and its scroll, Back and
 * Forward reach it for free, and it can spend the whole window on the listing
 * instead of a 640px box floating over the editor.
 */
export type Surface = 'dashboard' | 'editor' | 'browse'

/**
 * The find session, shared because two things draw it: the bar over the editor
 * and the results list in the sidebar. Keeping it here rather than inside the
 * bar is what lets the sidebar show the hits without the editor handing them
 * over — see `find.ts` for the writer.
 *
 * `matches` index into `text`, which is whichever text the mounted editor
 * offers: markdown source in the raw editor, rendered prose in the rich one.
 * They travel together because a match list is meaningless against other text.
 */
export interface FindState {
  open: boolean
  replaceOpen: boolean
  query: string
  replacement: string
  caseSensitive: boolean
  regex: boolean
  activeIndex: number
  matches: EditorFindMatch[]
  text: string
  error: string | null
  /** Rises on every ⌘F so the field re-focuses even when the bar is already open. */
  requestId: number
}

export const EMPTY_FIND: FindState = {
  open: false,
  replaceOpen: false,
  query: '',
  replacement: '',
  caseSensitive: false,
  regex: false,
  activeIndex: 0,
  matches: [],
  text: '',
  error: null,
  requestId: 0,
}

/**
 * Files and folders share one dialog, but not one set of rules — the name a
 * folder may take is not the name a file may take — so the kind travels with
 * the path rather than being guessed from it at the point of use.
 */
export interface RenameTarget {
  path: string
  kind: 'file' | 'folder'
}

export interface AppState {
  ready: boolean
  surface: Surface
  roots: Root[]
  tabs: Tab[]
  activePath: string | null
  settings: AppSettings
  /** Label registry, so colours can be resolved anywhere without a round trip. */
  labels: LabelDef[]
  /**
   * What the user decided about their frontmatter properties — types, options,
   * colours, order. Held here rather than fetched per panel because the
   * properties panel redraws on every keystroke in the file it describes.
   */
  propertySchema: PropertySchema
  /** Where Back and Forward can take you — see `navHistory.ts`. */
  nav: NavState
  /** Which folders are open in the sidebar tree — see `tree.ts`. */
  tree: TreeState
  /** Find and replace in the open file — see `find.ts`. */
  find: FindState
  /**
   * The sidebar's own state.
   *
   * `filter` is `null` when the search box is empty, which is not the same as
   * a filter that matched nothing — one shows the whole tree, the other shows
   * an empty result, and conflating them is how "no matches" ends up looking
   * like "no files".
   */
  sidebar: {
    query: string
    filter: TreeFilterResult | null
    filtering: boolean
    /** Requests focus of the filter box; cleared once the input takes it. */
    focusFilter: number
  }
  /**
   * The path browser's own state, kept here rather than inside the component so
   * leaving it and coming back lands you where you were. That persistence is
   * the whole reason it is a surface — see `Surface`.
   */
  browse: { query: string; index: number }
  bookmarks: BookmarkView[]
  /** Icon/colour for folders, keyed by absolute path. Files carry theirs in `FileMeta`. */
  folderDecor: Record<string, FolderDecor>
  /** Known tags with usage counts, for autocomplete. */
  tags: Array<{ tag: string; count: number }>
  /**
   * The in-app path picker, used where no system dialog is available (the
   * browser build). `null` when closed.
   */
  picker: { mode: 'file' | 'folder' } | null
  /** What the rename dialog is open for. `null` when closed. */
  rename: RenameTarget | null
  /** The file awaiting delete confirmation. `null` when closed. */
  confirmDelete: { path: string } | null
  /**
   * A jump to a line in a file that may not be open yet.
   *
   * Set when a task is clicked on Home; taken by the editor that mounts for
   * that path. Parked in the store rather than passed as an argument because
   * the thing that performs the jump does not exist at the moment of the
   * click — see `revealPending.svelte.ts`.
   */
  pendingReveal: { path: string; line: number } | null
  /**
   * The image being viewed full-size. `null` when the preview is closed.
   *
   * Held here rather than inside the node view that opens it because the node
   * view lives inside ProseMirror's document: it is unmounted by any transaction
   * that redraws that part of the doc, and an overlay owned by it would blink out
   * mid-look. The store outlives the node, so the preview does too.
   */
  imagePreview: { src: string; alt: string } | null
  linkFile: { path: string } | null
  /** The file whose incoming links are being looked up. `null` when the search is closed. */
  incomingLinks: { path: string } | null
  /**
   * A file opened by path whose folder is not in the sidebar, waiting on the
   * user's answer about whether it should be. `null` when nothing is pending.
   *
   * The file is already open by the time this is set — the question is about
   * the sidebar, not about the note, and holding the note hostage to it would
   * make the fast path slower than the file dialog it replaces.
   */
  addFolderPrompt: { filePath: string; folder: string } | null
  /** Toast-style transient message. */
  notice: { kind: 'info' | 'error'; text: string } | null
}

const initial: AppState = {
  ready: false,
  surface: 'dashboard',
  roots: [],
  tabs: [],
  activePath: null,
  settings: { ...DEFAULT_SETTINGS },
  labels: [],
  propertySchema: EMPTY_PROPERTY_SCHEMA,
  nav: EMPTY_NAV,
  tree: EMPTY_TREE,
  find: EMPTY_FIND,
  sidebar: { query: '', filter: null, filtering: false, focusFilter: 0 },
  browse: { query: '', index: 0 },
  bookmarks: [],
  folderDecor: {},
  tags: [],
  picker: null,
  rename: null,
  confirmDelete: null,
  pendingReveal: null,
  imagePreview: null,
  linkFile: null,
  incomingLinks: null,
  addFolderPrompt: null,
  notice: null,
}

/**
 * One object, mutated in place — not reassigned.
 *
 * `$state` hands back a deep proxy, so `Object.assign` on it is a fine-grained
 * update: only the branches that actually changed invalidate. Replacing the
 * whole object on every write (`state = { ...state, ...patch }`, the shape the
 * React build needed) also worked, but it made every read depend on every
 * write — and it left a window where a spread could carry a stale branch
 * forward, which is exactly how freshly typed text got overwritten by the copy
 * still on disk.
 */
const state = $state<AppState>({ ...initial })

/**
 * Non-component subscribers.
 *
 * Runes cover everything that draws; this is for the handful of writers that do
 * not — `navigation.ts` records where you have been, and it has no DOM to
 * belong to. Kept as a plain listener set so those modules port over unchanged.
 */
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function getState(): AppState {
  return state
}

export function setState(patch: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) {
  const next = typeof patch === 'function' ? patch(state) : patch
  Object.assign(state, next)
  emit()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ---- tab helpers ----------------------------------------------------------

export function activeTab(): Tab | null {
  if (!state.activePath) return null
  return state.tabs.find(tab => tab.path === state.activePath) ?? null
}

export function updateTab(path: string, patch: Partial<Tab>) {
  setState(prev => ({
    tabs: prev.tabs.map(tab => (tab.path === path ? { ...tab, ...patch } : tab)),
  }))
}

/**
 * Moves an open tab to a new path, keeping its content and dirty state.
 *
 * `missing` is cleared deliberately: a rename observed on disk arrives as a
 * disappearance at the old path, and a tab that just followed the file is the
 * one case where that flag would be wrong.
 */
export function retargetTab(from: string, to: string) {
  setState(prev => ({
    tabs: prev.tabs.map(tab =>
      tab.path === from
        ? { ...tab, path: to, name: to.slice(to.lastIndexOf('/') + 1), missing: false }
        : tab,
    ),
    activePath: prev.activePath === from ? to : prev.activePath,
    nav: retargetNav(prev.nav, from, to),
  }))
}

/**
 * Follows a folder that moved: the open-folder set, so the tree does not snap
 * shut around the rename, and every tab underneath it.
 *
 * The tabs are done here, by prefix, rather than left to one `renamed` event per
 * file. A tab still pointing into the old folder is not a cosmetic problem — the
 * next save writes to the old path, which recreates the folder and leaves the
 * user with the note in two places.
 *
 * Idempotent, which matters because both the in-app rename and the watcher
 * report the same move: the second pass finds nothing left under `from`.
 *
 * State only. Callers go through `applyFolderMove` in `actions.ts`, which also
 * writes the moved tree back to disk.
 */
export function retargetFolder(from: string, to: string) {
  setState(prev => ({ tree: movePrefix(prev.tree, from, to) }))
  for (const tab of state.tabs) {
    const next = retargetUnder(tab.path, from, to)
    if (next) retargetTab(tab.path, next)
  }
}

/**
 * Starts the back/forward history over at wherever the app is now.
 *
 * Called once startup settles. Restoring a session takes several writes — the
 * shell paints before the files are read — and each one looks like a
 * navigation from the outside, which would otherwise leave the user one Back
 * press away from a dashboard they never visited.
 */
export function resetNavHistory() {
  setState(prev => ({ nav: navAt(entryFor(prev)) }))
}

/**
 * Erases a file from the back/forward history.
 *
 * Only deletion does this. Closing a tab deliberately does not — a file you
 * closed is still somewhere you were, and Back is the cheapest way back to it.
 */
export function forgetNavPath(path: string) {
  setState(prev => ({ nav: dropNavPath(prev.nav, path) }))
}

export function isDirty(tab: Tab): boolean {
  return tab.content !== tab.savedContent
}

export function labelColor(name: string): string {
  return state.labels.find(label => label.name === name)?.color ?? 'var(--brand)'
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null

export function notify(kind: 'info' | 'error', text: string) {
  setState({ notice: { kind, text } })
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => setState({ notice: null }), kind === 'error' ? 6000 : 2800)
}
