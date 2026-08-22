/**
 * The single source of truth for the main-process <-> webview boundary.
 *
 * Both sides import this type. The Bun side implements `bun.requests`; the
 * webview calls them. Pushes from Bun (file watcher, menu commands) travel the
 * other way as `webview.messages`.
 *
 * Keeping this file free of any `electrobun` import is deliberate: the webview
 * must never link against Electrobun internals, so swapping the desktop runtime
 * later means rewriting `src/bun/` and `src/lib/rpcClient.ts` only.
 */
import type {
  AppSettings,
  BookmarkKind,
  BookmarkView,
  Dashboard,
  DirEntry,
  FileInfo,
  FileChangeEvent,
  FileDoc,
  FileMeta,
  FolderDecor,
  HistoryEventType,
  IncomingLinkScan,
  LabelDef,
  PathColumns,
  PathCompletion,
  QuickOpenHit,
  RefHit,
  RecentFolder,
  RecentItem,
  RecentSort,
  TodoScan,
  Root,
  RootId,
  TreeFilterResult,
} from './types'
import type { PropertyConfig, PropertySchema } from './propertySchema'
import type { InlineRefKind } from './inlineRefs'

/**
 * Declared as a `type`, not an `interface`, on purpose: Electrobun's RPC schema
 * constraint requires an index signature, and only type aliases get one
 * implicitly. An interface here fails to satisfy `RPCSchema`.
 */
export type AppRPCRequests = {
  // ---- files -------------------------------------------------------------
  readFile: { params: { path: string }; response: FileDoc }
  writeFile: {
    params: { path: string; content: string; expectedMtimeMs?: number }
    response: { stat: FileDoc['stat']; conflict: boolean }
  }
  createFile: { params: { dir: string; name: string; content?: string }; response: FileDoc }
  /**
   * Renames within the same folder. Takes the *name* the user typed rather than
   * a destination path, so the rules that turn one into the other (extension
   * handling, rejecting separators) live in one place instead of being split
   * between the UI and the handler. Returns the resulting path, unchanged if
   * the name resolved to what the file was already called.
   */
  renameFile: { params: { path: string; name: string }; response: { path: string } }
  /**
   * The same contract for a folder, and deliberately a separate request: a
   * folder rename moves every path underneath it, so the stores keyed by path —
   * metadata, bookmarks, folder decoration, roots — all have to be walked, and
   * that is not something `renameFile` should ever do by accident.
   */
  renameFolder: { params: { path: string; name: string }; response: { path: string } }
  deleteFile: { params: { path: string }; response: { trashed: boolean } }
  listDir: { params: { path: string }; response: DirEntry[] }
  revealInFinder: { params: { path: string }; response: void }
  pathExists: { params: { path: string }; response: boolean }
  /** What the inspector shows about the file itself, including when it was created. */
  fileInfo: { params: { path: string }; response: FileInfo }
  /**
   * Writes a pasted or dropped image next to the note and returns the path to
   * link it by. Base64 because the RPC is JSON either way.
   */
  saveAsset: {
    params: { notePath: string; name: string; base64: string }
    response: { path: string; relative: string }
  }
  /** Markdown files under every root, for the link picker. */
  listMarkdownFiles: { params: { limit?: number }; response: Array<{ path: string; name: string }> }

  /** Double-clicking the title bar. A no-op in the browser, which has no window to zoom. */
  toggleWindowZoom: { params: undefined; response: { zoomed: boolean } }

  /**
   * Swap in the update that was already downloaded and relaunch. Quits the app,
   * so nothing after the call runs. A no-op in the browser, which has no bundle
   * to replace.
   */
  applyUpdate: { params: undefined; response: void }

  // ---- roots -------------------------------------------------------------
  listRoots: { params: undefined; response: Root[] }
  addRoot: { params: { path: string }; response: Root }
  removeRoot: { params: { id: string }; response: void }
  setRootCollapsed: { params: { id: string; collapsed: boolean }; response: void }
  setRootPinned: { params: { id: string; pinned: boolean }; response: Root[] }
  /** Native folder picker. Returns null when the user cancels — or always, in the browser. */
  pickFolder: { params: undefined; response: Root | null }
  /** Native file picker. Returns null when the user cancels — or always, in the browser. */
  pickFile: { params: undefined; response: FileDoc | null }
  /**
   * Open a path the UI chose itself. This is how the browser build opens files:
   * it has no system dialog, so it browses with `listDir`/`listPlaces` and then
   * calls this.
   *
   * `addRoot` defaults to true, which registers the containing folder in the
   * sidebar on the way. Opening by typed path passes `false`: someone reading
   * one note out of a project they will not come back to should not acquire a
   * folder in the sidebar for it, so that choice is made above this call — see
   * `openByPath` in `actions.ts`.
   */
  openPath: { params: { path: string; addRoot?: boolean }; response: FileDoc }
  /**
   * What a half-typed path points at, and what could come next. One call per
   * keystroke of the palette's path mode.
   */
  completePath: { params: { input: string }; response: PathCompletion }
  /**
   * The same path as the chain of folders leading to it — one column per level,
   * for the browser page. One call rather than one per column, because the
   * chain is derived from the path and asking piecemeal would recompute what
   * the path already says.
   */
  pathColumns: { params: { input: string }; response: PathColumns }
  /**
   * Fuzzy search *below* a folder, for when the note's name is remembered and
   * its subfolder is not. Capped hard and reports when it hit the cap — see
   * `searchUnder.ts`.
   */
  searchUnder: {
    params: { dir: string; query: string; limit?: number }
    response: { hits: QuickOpenHit[]; truncated: boolean }
  }
  /**
   * Which of the open folders link to this file. An explicit, on-demand search
   * rather than a maintained backlink index — `incomingLinks.ts` explains why.
   */
  findIncomingLinks: {
    params: { path: string; limit?: number }
    response: IncomingLinkScan
  }
  /**
   * Hand a URL to the operating system. Refused unless it is http, https, or
   * mailto — see `isOpenableUrl`. `opened: false, refused: false` means there
   * was no native shell, and the browser build should fall back to `window.open`.
   */
  openExternal: {
    params: { url: string }
    response: { opened: boolean; refused: boolean }
  }
  /** The first lines of a file, for the palette's preview column. */
  peekFile: { params: { path: string }; response: { excerpt: string } }
  /**
   * Paths the app was launched with, drained once at boot. Empty in the
   * browser build, which is never launched with a file.
   */
  takePendingOpens: { params: undefined; response: string[] }
  /** Starting points for the in-app path picker. */
  listPlaces: {
    params: undefined
    response: { home: string; places: Array<{ name: string; path: string }> }
  }

  // ---- metadata ----------------------------------------------------------
  getMeta: { params: { path: string }; response: FileMeta }
  getMetaMany: { params: { paths: string[] }; response: Record<string, FileMeta | undefined> }
  updateMeta: {
    params: {
      path: string
      patch: Partial<Pick<FileMeta, 'labels' | 'tags' | 'note' | 'pinned' | 'icon' | 'color'>>
    }
    response: FileMeta
  }
  /**
   * Batched for the same reason as `getMetaMany`: one folder of 200 rows must
   * not become 200 round trips.
   */
  getFolderDecor: { params: { paths: string[] }; response: Record<string, FolderDecor> }
  /** An empty `decor` clears the entry rather than storing a blank record. */
  setFolderDecor: { params: { path: string; decor: FolderDecor }; response: void }
  /**
   * Every tag in the vault with the number of notes carrying it — from the
   * `tags:` property *and* from `#tag` written in the prose, counted as one
   * thing. See `services/tagIndex.ts`.
   */
  listTags: { params: undefined; response: Array<{ tag: string; count: number }> }
  /** The same, for `@mention` — which only ever comes from the prose. */
  listMentions: { params: undefined; response: Array<{ mention: string; count: number }> }
  /**
   * The notes carrying one tag or mention, most recently used first.
   *
   * Its own call rather than a `quickOpen('#tag')` because the panel wants the
   * list without a search box in front of it, and wants it to say nothing when
   * the tag is gone rather than falling back to fuzzy name matches.
   */
  notesWithRef: {
    params: { kind: InlineRefKind; label: string; limit?: number }
    response: RefHit[]
  }
  listLabels: { params: undefined; response: LabelDef[] }
  upsertLabel: { params: { label: LabelDef }; response: LabelDef[] }
  deleteLabel: { params: { name: string }; response: LabelDef[] }

  // ---- history -----------------------------------------------------------
  // The activity log has no view of its own; it is what ranks Recents and the
  // dashboard — see `src/bun/services/history.ts`.
  recordEvent: {
    params: { path: string; type: HistoryEventType; dwellMs?: number; from?: string }
    response: void
  }

  // ---- dashboard ---------------------------------------------------------
  getDashboard: { params: { limit?: number }; response: Dashboard }

  /**
   * The folders your notes live in, ranked like Recents — what the path
   * palette offers before anything is typed.
   */
  recentFolders: { params: { limit?: number }; response: RecentFolder[] }

  /** One row per file rather than per event, for the Recents panel. */
  /**
   * `withExcerpt` costs one file read per row, so the panel only asks for it
   * when the chosen preview style actually draws the text.
   */
  listRecents: {
    params: { sort?: RecentSort; limit?: number; withExcerpt?: boolean }
    response: RecentItem[]
  }

  /**
   * Every unchecked task across the roots, for Home.
   *
   * The one question in this app that cannot be answered from the open file,
   * so it is the one thing Home has that no panel already does. Costs a walk
   * of the markdown under each root, cached the way search is.
   */
  listTodos: { params: { rootId?: RootId; limit?: number }; response: TodoScan }

  // ---- bookmarks ---------------------------------------------------------
  listBookmarks: { params: undefined; response: BookmarkView[] }
  addBookmark: {
    params: { kind: BookmarkKind; path?: string; title?: string; groupId?: string | null }
    response: BookmarkView[]
  }
  /** Removing a group re-homes its children to the top level; it never deletes them. */
  removeBookmark: { params: { id: string }; response: BookmarkView[] }
  moveBookmark: { params: { id: string; groupId: string | null; order: number }; response: BookmarkView[] }
  renameBookmark: { params: { id: string; title: string }; response: BookmarkView[] }

  // ---- search ------------------------------------------------------------
  quickOpen: { params: { query: string; limit?: number }; response: QuickOpenHit[] }
  /**
   * Name filter for the sidebar tree, run here rather than in the webview.
   *
   * The tree is lazy — a folder never opened has never been listed — so a
   * client-side filter would silently miss files it has not fetched, and
   * "no matches" is indistinguishable from "not there".
   */
  filterTree: { params: { query: string; limit?: number }; response: TreeFilterResult }
  /**
   * Every folder under a root, for Expand All. One walk here instead of one
   * `listDir` per node from the webview.
   */
  listTreeDirs: {
    params: { rootPath: string; max?: number }
    response: { dirs: string[]; truncated: boolean }
  }

  // ---- properties --------------------------------------------------------
  // What the user decided about a property — its type, its options and their
  // colours, how its dates read. The *values* stay in each file's frontmatter;
  // only the decisions live here, keyed by property name so configuring
  // `status` once configures it in every note. Every write returns the whole
  // schema, which is small and saves the webview a reconciliation it would
  // otherwise have to get exactly right.
  getPropertySchema: { params: undefined; response: PropertySchema }
  savePropertyConfig: {
    params: { key: string; patch: Partial<PropertyConfig> }
    response: PropertySchema
  }
  deletePropertyConfig: { params: { key: string }; response: PropertySchema }
  renamePropertyConfig: { params: { from: string; to: string }; response: PropertySchema }
  savePropertyOrder: { params: { keys: string[] }; response: PropertySchema }

  // ---- settings ----------------------------------------------------------
  getSettings: { params: undefined; response: AppSettings }
  saveSettings: { params: { patch: Partial<AppSettings> }; response: AppSettings }
}

/**
 * Every request that changes something in a folder the user opened.
 *
 * This is the list read-only mode enforces against — see `lib/rpcClient.ts`,
 * which refuses these outright rather than trusting each caller to have checked
 * first. The promise "nothing you do can change the file" is only as good as
 * its narrowest gate, and a gate per call site is a gate someone will forget.
 *
 * The distinction is *the user's files*, not "writes". `updateMeta`,
 * `addBookmark`, `saveSettings` and friends all write, but they write to this
 * app's own sidecar stores in its data directory. Blocking those would make
 * read-only a lockout — you could not pin, tag, or even change the theme while
 * reading — for no gain, because none of them can touch a byte of markdown.
 *
 * `__tests__/fileWriteMethods.test.ts` fails if a request is added to the
 * schema above without being classified here, because a write that nobody
 * classified is one read-only silently lets through.
 */
export const FILE_WRITE_METHODS = new Set<keyof AppRPCRequests>([
  'writeFile',
  'createFile',
  'renameFile',
  'renameFolder',
  'deleteFile',
  // Writes an image next to the note. It arrives by paste or drop rather than
  // by typing, which is exactly the kind of edit someone reading does not
  // expect to have made.
  'saveAsset',
])

/** Commands the native menu fires at the webview. */
export type MenuCommand =
  | 'new-file'
  | 'open-file'
  | 'open-by-path'
  | 'open-folder'
  | 'save'
  | 'rename-file'
  | 'delete-file'
  | 'toggle-pin'
  | 'toggle-bookmark'
  | 'reveal-in-tree'
  | 'sidebar-search'
  | 'quick-open'
  | 'go-back'
  | 'go-forward'
  | 'toggle-raw-mode'
  | 'toggle-read-only'
  | 'toggle-sidebar'
  // One pane, three views: each of these names the view to show, and closes
  // the pane when that view is already the one on screen.
  | 'show-info'
  | 'show-outline'
  | 'show-todos'
  | 'link-file'
  | 'go-dashboard'
  | 'find-in-file'
  | 'reload-view'

export type AppRPCMessages = {
  fileChanged: FileChangeEvent
  menuCommand: { command: MenuCommand }
  /** An update finished downloading and is staged. Only the desktop shell sends this. */
  updateReady: { version: string }
}

export type AppRPC = {
  bun: {
    requests: AppRPCRequests
    messages: Record<never, unknown>
  }
  webview: {
    requests: Record<never, unknown>
    messages: AppRPCMessages
  }
}
