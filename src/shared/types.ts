/**
 * Domain types shared by the Bun main process and the webview.
 *
 * This file must stay dependency-free — it is imported from both sides of the
 * RPC boundary, and anything imported here gets pulled into both bundles.
 */

export type FileId = string
export type RootId = string

/** A folder the user has opened at least once. Not a "vault" — just a bookmark. */
export interface Root {
  id: RootId
  path: string
  name: string
  addedAt: number
  lastOpenedAt: number
  /** Collapsed in the sidebar. Purely a UI preference, stored so it survives restarts. */
  collapsed?: boolean
  /**
   * Held at the top of the sidebar regardless of when it was last opened.
   *
   * Roots are otherwise ordered by `lastOpenedAt`, which quietly sinks the
   * folder you visit rarely *because* you visit it rarely.
   */
  pinned?: boolean
}

/** Enough of an fs.Stat to detect "did this file change under us". */
export interface FileStat {
  size: number
  mtimeMs: number
}

/** Cheap content identity, used to re-link metadata after an out-of-app move. */
export interface Fingerprint extends FileStat {
  /** First 8 hex chars of sha1 over the first 4KB. */
  head: string
}

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
  /** Only present for files. */
  stat?: FileStat
}

export interface FileDoc {
  path: string
  content: string
  stat: FileStat
}

/**
 * One suggestion in the path palette. A `DirEntry` plus the two things only a
 * completion knows: which characters the typed segment matched, and — for a
 * folder — whether there is any markdown in it at all.
 */
export interface PathEntry extends DirEntry {
  /** Character indices in `name` that matched, for highlighting. */
  matched: number[]
  /** Markdown files directly inside. Folders only; not recursive. */
  noteCount?: number
}

/**
 * What a half-typed path resolves to right now: where it points, what is there,
 * and what could come next. One shape for all three because the palette redraws
 * from a single answer per keystroke.
 */
export interface PathCompletion {
  /** The typed text as an absolute path — `~`, escapes and `file://` resolved. */
  resolved: string
  /** The folder `entries` were read from. */
  dir: string
  /** Distinguishes an empty folder from one that is not there. */
  dirExists: boolean
  kind: 'file' | 'directory' | 'missing'
  /** Whether `resolved` is a markdown file that can be opened as it stands. */
  openable: boolean
  entries: PathEntry[]
  /**
   * Files in `dir` this list does not show because they are not markdown. A
   * folder full of `.txt` would otherwise look empty, which is a lie the list
   * tells by omission.
   */
  hiddenCount: number
}

/** One level of the folder chain, as a browsable column. */
export interface PathColumn {
  dir: string
  entries: PathEntry[]
  /** Non-markdown files not listed. Only counted for the folder being read. */
  hiddenCount: number
  /**
   * Markdown files directly inside `dir` — the same number the rows carry for
   * their own folders, but for the column's heading. One `readdir` per column,
   * which is per *level* rather than per row, so every column can afford it.
   */
  noteCount: number
  /** The row the path runs through — the next column's folder, or the file it ends at. */
  selected: string | null
}

/**
 * A path as the whole chain of folders leading to it, one column per level.
 *
 * The list shape (`PathCompletion`) answers "where am I"; this one also answers
 * "what was beside every turn I took to get here", which is what makes going
 * back one row cheaper than retyping a path.
 */
export interface PathColumns {
  resolved: string
  dir: string
  dirExists: boolean
  kind: 'file' | 'directory' | 'missing'
  openable: boolean
  columns: PathColumn[]
}

/**
 * A folder you have opened notes from — the palette's starting line.
 *
 * Derived from the activity log rather than stored, so it needs no bookkeeping
 * of its own and decays the same way Recents does.
 */
export interface RecentFolder {
  path: string
  name: string
  /** Files opened in it, approximate for the same reason `openCount` is. */
  noteCount: number
  lastOpenedAt: number
}

/** What the inspector reports about the file on disk, as opposed to our record of it. */
export interface FileInfo extends FileStat {
  /** `null` where the filesystem does not record one. */
  birthtimeMs: number | null
}

/** Sidecar metadata. Never written into the markdown file itself. */
export interface FileMeta {
  id: FileId
  path: string
  rootId: RootId | null
  labels: string[]
  tags: string[]
  note: string
  pinned: boolean
  createdAt: number
  updatedAt: number
  fingerprint: Fingerprint | null
  /**
   * Sidebar decoration — a key from the curated icon set, and a colour drawn
   * from the label palette. Both are chrome: they mean nothing outside this app,
   * which is exactly why they live in the sidecar rather than in frontmatter.
   */
  icon?: string
  color?: string
}

/**
 * The same decoration, for a folder.
 *
 * Folders deliberately do **not** get a `FileMeta`. `fingerprint()` reads the
 * first 4KB of a file and returns `null` for a directory, so the path-repair
 * machinery would be dead weight; and `allMeta()` — which the dashboard filters
 * with nothing but `existsSync` — would start listing directories as files.
 */
export interface FolderDecor {
  icon?: string
  color?: string
}

export interface LabelDef {
  name: string
  color: string
  order: number
}

export type HistoryEventType = 'open' | 'edit' | 'create' | 'rename'

export interface HistoryEvent {
  fileId: FileId
  type: HistoryEventType
  at: number
  /** Only on `edit`: how long the edit session lasted. */
  dwellMs?: number
  /** Only on `rename`. */
  from?: string
}

export interface DashboardItem {
  meta: FileMeta
  score: number
  lastOpenedAt: number
  lastEditedAt: number | null
  openCount: number
  editCount: number
}

export interface Dashboard {
  pinned: DashboardItem[]
  frequent: DashboardItem[]
  recentlyEdited: DashboardItem[]
  /**
   * Files tracked per root. The tag and label counts that used to sit beside
   * this were dropped: both were read from the sidecar, which no panel has
   * written to since properties learned to be multi-selects, so both were
   * structurally zero. Tags now come from `listTags`, which reads frontmatter.
   */
  rootCounts: Array<{ rootId: RootId; name: string; count: number }>
}

/**
 * One unchecked task, in a file that is not necessarily open.
 *
 * The Todos tab reads the buffer of the file you are looking at; this is the
 * same list asked across every file at once, which is the only form of the
 * question Home can answer — "what is left" is not a per-file question.
 */
export interface TodoHit {
  path: string
  name: string
  rootId: RootId | null
  /** 0-based line in the whole file, so opening it can land on the task. */
  line: number
  text: string
  /** The heading it sits under, flattened to text; `null` before the first one. */
  section: string | null
}

/** How much of one file's checklist is done, for a progress bar. */
export interface TodoTally {
  total: number
  open: number
}

export interface TodoScan {
  items: TodoHit[]
  /** Open tasks found, including any past `items`' cap. */
  total: number
  truncated: boolean
  /** Keyed by path, for every scanned file that has a checklist at all. */
  byFile: Record<string, TodoTally>
}

/**
 * One row in the Recents panel: a file, not an event.
 *
 * `HistoryEvent` is event-shaped, so a file opened ten times is ten rows —
 * right for a timeline, wrong for a list of files you work in.
 */
export interface RecentItem {
  path: string
  name: string
  rootId: RootId | null
  lastOpenedAt: number
  lastEditedAt: number | null
  /**
   * Approximate on purpose. Opens of the same file within 30 seconds collapse
   * into one (tab switching would otherwise flood the log), and the event log
   * is a ring buffer, so counts for old files shrink as it wraps.
   */
  openCount: number
  editCount: number
  score: number
  pinned: boolean
  labels: string[]
  icon?: string
  color?: string
  /**
   * Plain-text opening of the file. Only present when the caller asked for it —
   * it costs a read per row, and the compact preview style never shows it.
   */
  excerpt?: string
}

export type RecentSort = 'recent' | 'opens' | 'frecency'

/** How much of each file a Recents row shows. Named after Bear's menu. */
export type RecentsPreview = 'small' | 'medium' | 'large'

export type BookmarkKind = 'file' | 'folder' | 'group'

/**
 * A curated shortcut. Distinct from `FileMeta.pinned`, and the difference is
 * the whole reason both exist: a pin is a boolean on a file, ordered for you;
 * a bookmark is an entry in a list you arrange yourself, and it can point at a
 * folder.
 */
export interface BookmarkEntry {
  id: string
  kind: BookmarkKind
  /** Absent on groups, which are labels rather than places. */
  path?: string
  /** Overrides the name shown. Defaults to the basename of `path`. */
  title?: string
  /** The group this sits in, or `null` for the top level. One level only. */
  groupId: string | null
  order: number
}

/** A bookmark joined with whether its target is still on disk. */
export interface BookmarkView extends BookmarkEntry {
  exists: boolean
}

/** What the sidebar filter found. */
export interface TreeFilterResult {
  /** Echoed back so a late response for an abandoned query can be dropped. */
  query: string
  /** Matching files, best first. */
  files: string[]
  /** Folders that must be open for those files to be visible. */
  dirs: string[]
  truncated: boolean
}

export interface QuickOpenHit {
  path: string
  name: string
  rootId: RootId | null
  score: number
  /** Indices in `name` that matched, for highlighting. */
  matched: number[]
}

/**
 * One note carrying a `#tag` or an `@mention`.
 *
 * Deliberately not a `QuickOpenHit`: there is no query to have matched, so the
 * score and the matched-character list would both be lies the row then has to
 * remember not to draw.
 */
export interface RefHit {
  path: string
  name: string
  rootId: RootId | null
  /** Where it first appears, so opening the note can land on it. */
  line: number
  /** How many times the note uses it — the panel shows the busy notes first. */
  count: number
}

/** One file that links to the file you asked about. */
export interface IncomingLink {
  path: string
  name: string
  /** The containing folder, shown because two notes may share a name. */
  folder: string
  /** Line of the first link in this file, counting frontmatter. */
  line: number
  /** That line, trimmed — enough to see how the link is used. */
  excerpt: string
  /** Links in this file pointing at the target. Usually one. */
  count: number
}

/**
 * The answer to "which files link here".
 *
 * `scanned` is part of the answer rather than debug output: this searches the
 * folders that happen to be open, so an empty result means "none of the N files
 * I could see", never "none exist". Reporting the number is what keeps the
 * result honest — see README, "What Orbit deliberately is not".
 */
export interface IncomingLinkScan {
  hits: IncomingLink[]
  scanned: number
  /** A cap was hit, so even the searched set was not finished. */
  truncated: boolean
}

/** Emitted by the main process when something changes on disk. */
export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted' | 'renamed'
  path: string
  /** Only on `renamed`. */
  from?: string
  /**
   * Set on the one event that is about a folder rather than a file.
   *
   * The watcher only follows markdown, so a renamed folder is inferred from its
   * notes moving; this flag is how that inference reaches the sidebar without
   * every consumer having to repeat it.
   */
  isDirectory?: boolean
}

export type SidebarPanel = 'files' | 'recents' | 'bookmarks' | 'tags'

/**
 * `ask` puts the choice in a dialog each time, `always` adds the folder without
 * asking, `never` opens the file and leaves the sidebar alone.
 */
export type AddFolderOnPathOpen = 'ask' | 'always' | 'never'

/** The three views that share the pane to the right of the editor. */
export type InspectorTab = 'info' | 'outline' | 'todos'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  editorMode: 'rich' | 'raw'
  sidebarWidth: number
  inspectorWidth: number
  /** The editor's own measure — how wide the text column is allowed to run. */
  editorWidth: number
  /**
   * How wide each column of the path browser is drawn.
   *
   * One width for all of them rather than one per column. A column there is a
   * level of the same chain, so a per-column width would have to be keyed by
   * position — and position means a different folder every time you navigate,
   * which is a width that follows nothing.
   */
  browseColumnWidth: number
  sidebarOpen: boolean
  /** The single pane on the right of the editor. See `inspectorTab`. */
  inspectorOpen: boolean
  /**
   * Which view the inspector is showing.
   *
   * Info, the outline, and the todo list are all derived from the one open file
   * and all want the same shape — a tall, narrow column beside the text — so
   * they take turns in one pane rather than each claiming a strip of width. Two
   * of them side by side left the editor a slot, and the third had nowhere to
   * go at all. Which one you left it on is a preference, not a per-file fact,
   * so it survives a restart like the pane's own width.
   */
  inspectorTab: InspectorTab
  /** Fold finished tasks out of the todo list. */
  todosHideDone: boolean
  /**
   * Which folder Home's task list covers — a `RootId`, or `all`.
   *
   * A preference rather than session state: the person who keeps one root for
   * work and one for everything else means it every morning, not just today.
   */
  homeTodoScope: RootId | 'all'
  /**
   * Show the tab strip above the editor. Hiding it is for people who navigate
   * by search and the sidebar rather than by tabs — the files stay open either
   * way, so the strip can come back with everything still in it.
   */
  tabBarOpen: boolean
  /**
   * Show the rich editor's formatting toolbar — the row of H1/bold/link icons.
   *
   * Off by default, which is the opposite of the tab strip above it. A toolbar
   * is a thing you reach for a few times a page; the room it costs is charged
   * on every line of every note, and the same commands are on the keyboard, in
   * the slash menu, and in the bubble menu that appears where you are actually
   * looking. Someone who wants it permanently on screen turns it on once.
   */
  editorToolbarOpen: boolean
  /**
   * Show the formatting bubble over a selection.
   *
   * On by default, because unlike the toolbar it costs nothing until you select
   * something, and it appears at the text rather than at the top of the window.
   * It is a setting rather than a fact because it also floats over the line
   * under the selection, which people who format by keyboard find in the way.
   */
  editorBubbleMenuOpen: boolean
  /**
   * Reading mode: the app will not write to any file you opened.
   *
   * A mode rather than a per-file lock, and the difference is the promise it
   * can make. A per-file flag protects the file you remembered to flag; a mode
   * protects everything for as long as it is on, which is the thing you
   * actually want when you are reading rather than writing.
   *
   * It survives a restart on purpose. Turning it off is one keystroke, and
   * quietly dropping a *protection* on relaunch is the wrong way for a setting
   * about safety to fail.
   *
   * Enforced at `lib/rpcClient.ts` against `FILE_WRITE_METHODS`, not by the
   * controls that happen to be disabled — see `shared/rpc.ts`.
   */
  readOnly: boolean
  lastOpenPaths: string[]
  activePath: string | null
  /**
   * What opening a file by path should do about the folder it came from, when
   * that folder is not in the sidebar yet.
   *
   * Only ever consulted for a folder the app does not already know: opening a
   * note from a folder that is already a root has nothing to decide, and asking
   * anyway would be a dialog whose only honest button is "yes, it already is".
   */
  addFolderOnPathOpen: AddFolderOnPathOpen
  /**
   * Where the path browser was last looking. Restored on the next run so the
   * surface opens on the folder you were working out of, not on your home
   * directory — the same courtesy `lastOpenPaths` does for tabs.
   */
  browsePath: string
  /** Which sidebar panel the rail is showing. */
  sidebarPanel: SidebarPanel
  /** Open folders in the file tree, capped — see `tree.ts`. */
  expandedPaths: string[]
  /** Show the pinned-files section above the tree. */
  sidebarShowPinned: boolean
  recentsSort: RecentSort
  /** Group Recents by day. Only meaningful for the `recent` sort. */
  recentsGrouped: boolean
  /** Row height and how many lines of the file each Recents row previews. */
  recentsPreview: RecentsPreview
  /**
   * Reading typography — see `lib/typography.ts`, which owns the ranges,
   * the font stacks these keys name, and the CSS variables they become.
   *
   * Stored as a key rather than a font stack so the stack can be fixed later
   * without migrating everyone's settings file.
   */
  proseFont: string
  codeFont: string
  /** Prose size in px. */
  fontSize: number
  /** Prose leading, as a unitless ratio. */
  lineHeight: number
  /** Gap between paragraphs, in em of the prose size. */
  paragraphSpacing: number
  /**
   * The look — see `lib/themePresets.ts` for the choices and
   * `lib/themeSkin.ts` for what they become.
   *
   * Three keys rather than one because they answer different questions and
   * compose: the base colour is the grey the whole app is built from, the
   * accent is the one hue on top of it, and the radius is neither. Stored as
   * names rather than colours, on the same reasoning as `proseFont` — a preset
   * can be corrected later without rewriting everyone's settings file.
   *
   * Typed as `string` because the value comes off disk, where a build that no
   * longer ships a preset would otherwise be holding an impossible union.
   * `themeSkin.ts` falls back rather than trusting it.
   */
  themeBaseColor: string
  /** `none` means the base colour's own grey brand — no hue. */
  themeAccent: string
  themeRadius: string
  /** Colours picked in the editor toolbar, newest first — see `editor/recentColors.ts`. */
  recentColors: RecentEditorColor[]
}

/**
 * One entry in the toolbar's recently-used colours.
 *
 * The kind travels with the colour because the two palettes are the same ten
 * names: "yellow" as a highlight and "yellow" as text are different picks, and
 * a list that stored only the name could not replay either one.
 */
export interface RecentEditorColor {
  kind: 'text' | 'background'
  /** A BlockNote colour name — `gray`, `red`, … Never `default`. */
  color: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  editorMode: 'rich',
  sidebarWidth: 260,
  inspectorWidth: 288,
  editorWidth: 704,
  browseColumnWidth: 224,
  sidebarOpen: true,
  inspectorOpen: true,
  inspectorTab: 'info',
  todosHideDone: false,
  homeTodoScope: 'all',
  tabBarOpen: true,
  editorToolbarOpen: false,
  editorBubbleMenuOpen: true,
  readOnly: false,
  lastOpenPaths: [],
  activePath: null,
  addFolderOnPathOpen: 'ask',
  browsePath: '',
  sidebarPanel: 'files',
  expandedPaths: [],
  sidebarShowPinned: true,
  recentsSort: 'recent',
  recentsGrouped: true,
  recentsPreview: 'small',
  // These five must stay in step with the literals in `editor/editor.css`,
  // which is what paints before settings are read off disk.
  proseFont: 'avenir',
  codeFont: 'system',
  fontSize: 17,
  lineHeight: 1.75,
  paragraphSpacing: 0.6,
  // These three must stay in step with the literals in `app.css`, which is what
  // paints before settings are read off disk. `neutral` + `none` + `default` is
  // exactly the palette declared there.
  themeBaseColor: 'neutral',
  themeAccent: 'none',
  themeRadius: 'default',
  recentColors: [],
}
