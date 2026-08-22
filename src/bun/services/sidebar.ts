import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { BookmarkEntry, BookmarkKind, BookmarkView, FolderDecor } from '../../shared/types'
import { JsonStore, registerStore } from './jsonStore'
import { STORE_FILES } from '../paths'
import {
  addEntry,
  applyDecor,
  moveEntry,
  normalizeOrders,
  removeEntry,
  renameEntry,
  retargetDecor,
  retargetExact,
  retargetPrefix,
  sortEntries,
} from './sidebarData'

/**
 * Everything the sidebar remembers that does not already belong to someone
 * else: the bookmark list, and icon/colour for folders.
 *
 * Folder decoration is here rather than in `files.json` on purpose — see the
 * note on `FolderDecor` in `shared/types.ts`. File decoration *is* in
 * `files.json`, because a file already has a record and gets fingerprint-based
 * path repair for free.
 */
interface SidebarFile {
  version: 1
  folders: Record<string, FolderDecor>
  bookmarks: BookmarkEntry[]
}

const store = registerStore(
  new JsonStore<SidebarFile>(STORE_FILES.sidebar, () => ({
    version: 1,
    folders: {},
    bookmarks: [],
  })),
)

function newBookmarkId(): string {
  return `b_${randomUUID().replace(/-/g, '').slice(0, 22)}`
}

// ---- bookmarks -------------------------------------------------------------

/**
 * A bookmark whose file is gone stays in the list, marked.
 *
 * Dropping it would be tidier and wrong: an unmounted volume or a branch that
 * has not been checked out yet would silently erase shortcuts the user built
 * by hand, at the moment they are least able to notice.
 */
function view(entries: BookmarkEntry[]): BookmarkView[] {
  return sortEntries(entries).map(entry => ({
    ...entry,
    exists: entry.kind === 'group' || (entry.path ? existsSync(entry.path) : false),
  }))
}

export function listBookmarks(): BookmarkView[] {
  return view(store.get().bookmarks)
}

export function addBookmark(input: {
  kind: BookmarkKind
  path?: string
  title?: string
  groupId?: string | null
}): BookmarkView[] {
  store.update(draft => {
    draft.bookmarks = addEntry(draft.bookmarks, { ...input, id: newBookmarkId() })
  })
  return listBookmarks()
}

export function removeBookmark(id: string): BookmarkView[] {
  store.update(draft => {
    draft.bookmarks = removeEntry(draft.bookmarks, id)
  })
  return listBookmarks()
}

export function moveBookmark(id: string, groupId: string | null, order: number): BookmarkView[] {
  store.update(draft => {
    draft.bookmarks = moveEntry(draft.bookmarks, id, groupId, order)
  })
  return listBookmarks()
}

export function renameBookmark(id: string, title: string): BookmarkView[] {
  store.update(draft => {
    draft.bookmarks = renameEntry(draft.bookmarks, id, title)
  })
  return listBookmarks()
}

/** True when this exact path is already bookmarked — drives the toggle. */
export function bookmarkIdForPath(path: string): string | null {
  return store.get().bookmarks.find(entry => entry.path === path)?.id ?? null
}

// ---- folder decoration -----------------------------------------------------

export function getFolderDecor(paths: string[]): Record<string, FolderDecor> {
  const folders = store.get().folders
  const out: Record<string, FolderDecor> = {}
  for (const path of paths) {
    const decor = folders[path]
    if (decor) out[path] = decor
  }
  return out
}

export function setFolderDecor(path: string, decor: FolderDecor) {
  store.update(draft => {
    draft.folders = applyDecor(draft.folders, path, decor)
  })
}

// ---- path tracking ---------------------------------------------------------

/** A single bookmarked file followed its rename. */
export function trackFileMove(from: string, to: string) {
  store.update(draft => {
    draft.bookmarks = retargetExact(draft.bookmarks, from, to)
  })
}

/** A folder moved: its decoration, and everything bookmarked beneath it. */
export function trackFolderMove(from: string, to: string) {
  store.update(draft => {
    draft.folders = retargetDecor(draft.folders, from, to)
    draft.bookmarks = retargetPrefix(draft.bookmarks, from, to)
  })
}

/** Repairs order gaps left by a hand-edited or older store file. */
export function verifyBookmarks() {
  store.update(draft => {
    draft.bookmarks = normalizeOrders(draft.bookmarks)
  })
}
