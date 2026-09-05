import { api, isDesktop } from './rpcClient'
import {
  activeTab,
  forgetNavPath,
  getState,
  resetNavHistory,
  isDirty,
  notify,
  retargetFolder,
  retargetTab,
  setState,
  updateTab,
  type Tab,
} from './store.svelte'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type FileDoc,
  type InspectorTab,
} from '$shared/types'
import { EMPTY_PROPERTY_SCHEMA } from '$shared/propertySchema'
import type { PaneKey } from './layout'
import {
  hydrateTree,
  notifyDirChanged,
  persistTree,
  refreshBookmarks,
  revealInTree,
  setSidebarPanel,
} from './sidebar'
import { isUnder } from './tree'
import { browsedDir } from './quickOpenPath'
import { dirname } from '$shared/rename'
import { linkAction } from '$shared/links'
import { containingRootPath, folderOf, normalizePathInput } from '$shared/pathInput'
import { removeProperty as dropProperty, writeProperty } from '$shared/frontmatter'

/**
 * Every user-facing operation lives here rather than inside components, so the
 * same action can be triggered by a click, a native menu command, or a
 * keyboard shortcut without duplicating logic.
 */

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/**
 * Reading mode, asked from the UI's side of the fence.
 *
 * The *guarantee* is not here — it is one gate in `rpcClient.ts`, which refuses
 * every `FILE_WRITE_METHODS` call regardless of what any caller believes. What
 * the checks below buy is manners: an action that cannot complete should not
 * start, so the app declines up front instead of opening a rename dialog that
 * will fail on submit, or letting a keystroke into a buffer that can never
 * reach disk.
 */
export function isReadOnly(): boolean {
  return getState().settings.readOnly
}

/** Says no once, in the same words everywhere, and reports it as a refusal. */
function refuse(what: string): false {
  notify('info', `Read-only mode is on — ${what} was not changed.`)
  return false
}

/**
 * Turns reading mode on or off.
 *
 * Everything pending goes to disk *before* the lock closes. The alternative is
 * a mode that strands whatever you had just typed: the buffer stays dirty, no
 * write is allowed, and the edit sits there looking saved until the app is
 * closed. Protection that costs you the last paragraph you wrote is not
 * protection.
 */
export async function toggleReadOnly() {
  const next = !isReadOnly()
  if (next) await saveAllTabs()
  await setSetting('readOnly', next)
  notify('info', next ? 'Read-only — files are protected' : 'Editing enabled')
}

function tabFromDoc(doc: FileDoc): Tab {
  return {
    path: doc.path,
    name: basename(doc.path),
    content: doc.content,
    savedContent: doc.content,
    mtimeMs: doc.stat.mtimeMs,
    meta: null,
    conflict: false,
    missing: false,
  }
}

/**
 * How long startup is allowed to say nothing.
 *
 * The boot placeholder in `app.html` is on screen from the first frame and is
 * only taken away once `ready` flips, so anything that keeps `startup()` from
 * finishing leaves the window on the loading skeleton — with no error, no
 * console line, and no control that gets you out of it. A request that is never
 * *answered* does exactly that: it neither resolves nor rejects, and in the
 * desktop shell that is a real state, seen after a webview reload.
 *
 * Matched to the RPC's own `maxRequestTime` on both sides, so this is the wall
 * clock for the case where that budget is not enforced rather than a second,
 * shorter opinion about how long a read may take. Startup that is merely slow
 * still lands: the work is not cancelled, and a late `setState` finishes the
 * job it started.
 */
export const STARTUP_TIMEOUT_MS = 15_000

/**
 * Startup is tried more than once because the first attempt can be lost rather
 * than refused.
 *
 * The webview reaches Bun over a loopback socket that is still connecting while
 * this module is already asking for settings: a packet sent then is queued until
 * the socket opens, and one that lands before the Bun side has attached its
 * handler is dropped without a reply. Neither is an error anyone can catch —
 * they are silence, which is why this file has a stopwatch at all. Launching at
 * login is where it actually bites: every other login item is competing for the
 * same disk and the same first second.
 *
 * A second attempt goes out over a socket that is by then open, so it lands.
 * Nothing is cancelled in between — a late first answer simply finishes the job
 * it started, and the retry overwrites it with the identical state.
 */
export const STARTUP_ATTEMPTS = 3
export const STARTUP_RETRY_DELAY_MS = 1_000

export async function bootstrap() {
  const failures: string[] = []

  for (let attempt = 1; attempt <= STARTUP_ATTEMPTS; attempt += 1) {
    try {
      await Promise.race([
        startup(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`no answer in ${STARTUP_TIMEOUT_MS / 1000}s`)),
            STARTUP_TIMEOUT_MS,
          ),
        ),
      ])
      return
    } catch (err) {
      // `Error: ` and a trailing stop read as noise inside the sentence below,
      // where the reason is quoted rather than thrown.
      failures.push(String(err).replace(/^Error:\s*/, '').replace(/\.$/, ''))
      console.error(`[startup] attempt ${attempt}/${STARTUP_ATTEMPTS} failed:`, err)
      if (attempt < STARTUP_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, STARTUP_RETRY_DELAY_MS))
      }
    }
  }

  /*
   * Out of attempts. The shell comes up on defaults — no roots, no tabs, none of
   * your settings — so the notice has to say that this is a failed *read* and
   * not a lost library, and it has to stay on screen: a toast that fades leaves
   * someone typing into an app that will save those defaults back over the real
   * settings file.
   */
  setState({ ready: true })
  resetNavHistory()
  notify(
    'error',
    `Could not load your data — gave up after ${STARTUP_ATTEMPTS} tries (${failures.at(-1)}). ` +
      'Your notes and settings are safe on disk; this window could not reach the app ' +
      'backend. Try again, or quit and reopen Orbit Lite.',
    { label: 'Try again', run: () => void bootstrap() },
  )
}

async function startup() {
  const [settings, roots, labels, tags, propertySchema] = await Promise.all([
    api.getSettings(),
    api.listRoots(),
    api.listLabels(),
    api.listTags(),
    // Caught rather than awaited alongside the rest: the property schema
    // decides how frontmatter is *drawn*, so losing it costs plainer chips
    // and inferred types. Letting it into the `Promise.all` would mean one
    // unreadable presentation file takes your roots and your open tabs down
    // with it.
    api.getPropertySchema().catch(() => EMPTY_PROPERTY_SCHEMA),
  ])
  // Merged over the defaults on the way in as well as on the way out of the
  // settings service. A field added since the settings file was written
  // arrives `undefined`, and an `undefined` in a Select renders as a blank
  // box rather than as an error — the one failure mode no test would catch.
  setState({
    settings: { ...DEFAULT_SETTINGS, ...settings },
    roots,
    labels,
    tags,
    propertySchema,
  })
  hydrateTree(settings.expandedPaths, roots.map(root => root.path))
  void refreshBookmarks()

  // Restore the previous session's tabs, skipping anything that has since
  // been deleted or moved.
  const restored: Tab[] = []
  for (const path of settings.lastOpenPaths) {
    try {
      restored.push(tabFromDoc(await api.readFile({ path })))
    } catch {
      // Silently drop — a missing file from a past session is not an error
      // the user needs to see at startup.
    }
  }

  const active = settings.activePath && restored.some(t => t.path === settings.activePath)
    ? settings.activePath
    : restored[0]?.path ?? null

  // `ready` flips here rather than with the settings above: the boot
  // placeholder in `app.html` is only taken away once this lands, and lifting
  // it any earlier showed the dashboard for a frame before the restored tabs
  // pushed it aside.
  setState({
    tabs: restored,
    activePath: active,
    surface: active ? 'editor' : 'dashboard',
    ready: true,
  })
  resetNavHistory()

  if (active) void hydrateMeta(active)

  // Files named on the command line, drained after the session is restored so
  // the file you asked for ends up in front, not buried under yesterday's tabs.
  void openPendingFiles()
}

async function hydrateMeta(path: string) {
  try {
    const meta = await api.getMeta({ path })
    updateTab(path, { meta })
  } catch {
    // Metadata is additive; the file is still perfectly editable without it.
  }
}

export async function openPath(path: string, options: { record?: boolean } = {}) {
  const existing = getState().tabs.find(tab => tab.path === path)
  if (existing) {
    setState({ activePath: path, surface: 'editor' })
    void persistSession()
    if (options.record !== false) void api.recordEvent({ path, type: 'open' })
    return
  }

  try {
    const doc = await api.readFile({ path })
    setState(prev => ({
      tabs: [...prev.tabs, tabFromDoc(doc)],
      activePath: path,
      surface: 'editor',
    }))
    void hydrateMeta(path)
    void persistSession()
    if (options.record !== false) void api.recordEvent({ path, type: 'open' })
  } catch (err) {
    notify('error', `Could not open ${basename(path)}: ${String(err)}`)
  }
}

/**
 * Repairs the one inconsistent state the store can be in: `activePath` naming a
 * file that has no tab.
 *
 * Every writer sets the two together, so this should be unreachable — and it is
 * exactly the kind of "should" worth a net, because of how it fails. The title
 * bar reads the path and the tab strip reads the tabs, so the window ends up
 * naming a file over an empty surface that says nothing is open, with no control
 * anywhere that fixes it: the file is already active, so clicking it again is a
 * no-op. That is a dead end, and the only way out is a restart.
 *
 * So the path is taken at its word and opened. If it cannot be read, the app
 * lets go of it rather than keeping a name it cannot honour.
 */
export async function reopenActivePath(path: string) {
  // `record: false` — this is a repair, not a visit, and it should not push the
  // file up the frecency ranking every time it happens.
  await openPath(path, { record: false })
  if (getState().tabs.some(tab => tab.path === path)) return
  setState(prev =>
    prev.activePath === path ? { activePath: null, surface: 'dashboard' } : {},
  )
}

export function closeTab(path: string) {
  const tab = getState().tabs.find(t => t.path === path)
  if (tab && isDirty(tab)) void saveTab(path)
  dropTab(path)
}

/**
 * The two bulk closes, both routed through `closeTab` one tab at a time rather
 * than resetting the strip in a single `setState`.
 *
 * That is the whole point: closing five tabs has to keep the promise closing one
 * makes — an unsaved buffer is written on the way out — and a bulk close is
 * precisely when nobody is watching for the tabs that were dirty. The loops read
 * from a snapshot taken before the first close, so the store shrinking underneath
 * them is fine.
 */
export function closeOtherTabs(path: string) {
  for (const tab of getState().tabs) {
    if (tab.path !== path) closeTab(tab.path)
  }
}

export function closeAllTabs() {
  for (const tab of getState().tabs) closeTab(tab.path)
}

/**
 * Closes a tab *without* saving it.
 *
 * Kept separate from `closeTab` because the difference matters exactly once:
 * after deleting the file, flushing unsaved edits would write the document
 * straight back to disk and undo the delete.
 */
function dropTab(path: string) {
  const state = getState()
  const remaining = state.tabs.filter(t => t.path !== path)
  const nextActive =
    state.activePath === path ? remaining[remaining.length - 1]?.path ?? null : state.activePath

  setState({
    tabs: remaining,
    activePath: nextActive,
    surface: nextActive ? 'editor' : 'dashboard',
  })
  void persistSession()
}

/**
 * The editors' way into the buffer. Silent when read-only rather than a notice:
 * both editors are already non-editable, so anything arriving here is a stray
 * transaction — a paste handler, a decoration — and not something the user did
 * that deserves an explanation.
 */
export function setTabContent(path: string, content: string) {
  if (isReadOnly()) return
  updateTab(path, { content })
}

/**
 * Properties are frontmatter, so setting one is an edit to the open document
 * rather than a write of its own.
 *
 * This is what keeps the panel and the editor from fighting. The rich editor
 * never owns the YAML block — it re-reads it from the tab on every serialize
 * and re-attaches it verbatim — so changing it here is invisible to the editor
 * and still lands on disk through the same autosave, the same conflict check,
 * and the same dirty indicator as typing would.
 */
export function setProperty(path: string, key: string, value: string | string[]) {
  // Frontmatter is the file, so this is an edit like any other. Said out loud
  // here, unlike `setTabContent`: the panel's fields stay usable-looking enough
  // that a silent no-op would read as a bug.
  if (isReadOnly()) return void refuse(key)
  const tab = getState().tabs.find(t => t.path === path)
  if (!tab) return
  const next = writeProperty(tab.content, key, value)
  if (next === tab.content) return
  updateTab(path, { content: next })
  markEditing(path)
}

export function removeProperty(path: string, key: string) {
  if (isReadOnly()) return void refuse(key)
  const tab = getState().tabs.find(t => t.path === path)
  if (!tab) return
  const next = dropProperty(tab.content, key)
  if (next === tab.content) return
  updateTab(path, { content: next })
  markEditing(path)
}

/**
 * Tracks when the current edit session started so history records a single
 * `edit` event with a real dwell time, instead of one event per keystroke.
 */
const editSessionStart = new Map<string, number>()

export function markEditing(path: string) {
  if (!editSessionStart.has(path)) editSessionStart.set(path, Date.now())
}

export async function saveTab(path: string): Promise<boolean> {
  const tab = getState().tabs.find(t => t.path === path)
  if (!tab || !isDirty(tab)) return true

  /*
   * Should be unreachable — `toggleReadOnly` flushes before the lock closes and
   * nothing can dirty a buffer afterwards — but this is the function every
   * other path calls when it wants an edit on disk, so it says no in its own
   * words rather than letting the RPC gate throw and be reported as "Save
   * failed", which reads like something went wrong instead of like a rule.
   */
  if (isReadOnly()) return refuse(tab.name)

  try {
    const result = await api.writeFile({
      path,
      content: tab.content,
      expectedMtimeMs: tab.mtimeMs,
    })

    if (result.conflict) {
      updateTab(path, { conflict: true })
      notify('error', `${tab.name} changed on disk — resolve before saving`)
      return false
    }

    updateTab(path, {
      savedContent: tab.content,
      mtimeMs: result.stat.mtimeMs,
      conflict: false,
    })

    const startedAt = editSessionStart.get(path)
    editSessionStart.delete(path)
    void api.recordEvent({
      path,
      type: 'edit',
      dwellMs: startedAt ? Date.now() - startedAt : undefined,
    })
    return true
  } catch (err) {
    notify('error', `Save failed: ${String(err)}`)
    return false
  }
}

export async function saveActive() {
  const tab = activeTab()
  if (tab) await saveTab(tab.path)
}

/**
 * Flushes every dirty buffer, for the moments the app is about to stop being
 * the thing holding them — a reload, most of all. Sequential rather than
 * concurrent: each save reads the tab out of the store and writes the store
 * back, and a conflict on one file should not race the record of another.
 */
export async function saveAllTabs() {
  for (const tab of getState().tabs) {
    if (isDirty(tab)) await saveTab(tab.path)
  }
}

/** Discards local edits and takes whatever is on disk. */
export async function reloadTab(path: string) {
  try {
    const doc = await api.readFile({ path })
    updateTab(path, {
      content: doc.content,
      savedContent: doc.content,
      mtimeMs: doc.stat.mtimeMs,
      conflict: false,
      missing: false,
    })
  } catch (err) {
    notify('error', `Reload failed: ${String(err)}`)
  }
}

/** Keeps local edits and overwrites what is on disk. */
export async function forceSave(path: string) {
  const tab = getState().tabs.find(t => t.path === path)
  if (!tab) return
  // The conflict banner's "keep mine" button. It overwrites deliberately, which
  // is exactly the thing reading mode exists to make impossible.
  if (isReadOnly()) return void refuse(tab.name)
  try {
    const result = await api.writeFile({ path, content: tab.content })
    updateTab(path, {
      savedContent: tab.content,
      mtimeMs: result.stat.mtimeMs,
      conflict: false,
    })
    notify('info', `${tab.name} overwritten`)
  } catch (err) {
    notify('error', `Save failed: ${String(err)}`)
  }
}

function showDoc(doc: FileDoc) {
  setState(prev =>
    prev.tabs.some(t => t.path === doc.path)
      ? { activePath: doc.path, surface: 'editor' }
      : { tabs: [...prev.tabs, tabFromDoc(doc)], activePath: doc.path, surface: 'editor' },
  )
  void hydrateMeta(doc.path)
  void api.recordEvent({ path: doc.path, type: 'open' })
  void refreshRoots()
  void persistSession()
}

/**
 * A web page cannot summon a system dialog, so the browser build browses with
 * the app's own picker instead. Both paths end in the same place.
 */
export async function openFileDialog() {
  if (!isDesktop) {
    setState({ picker: { mode: 'file' } })
    return
  }
  try {
    const doc = await api.pickFile()
    if (doc) showDoc(doc)
  } catch (err) {
    notify('error', `Open failed: ${String(err)}`)
  }
}

export async function openFolderDialog() {
  if (!isDesktop) {
    setState({ picker: { mode: 'folder' } })
    return
  }
  try {
    const root = await api.pickFolder()
    if (!root) return
    await refreshRoots()
    notify('info', `Added ${root.name}`)
  } catch (err) {
    notify('error', `Could not add folder: ${String(err)}`)
  }
}

/** Called by the in-app picker once the user has chosen something. */
export async function confirmPickedPath(mode: 'file' | 'folder', path: string) {
  setState({ picker: null })
  try {
    if (mode === 'folder') {
      const root = await api.addRoot({ path })
      await refreshRoots()
      notify('info', `Added ${root.name}`)
      return
    }
    showDoc(await api.openPath({ path }))
  } catch (err) {
    notify('error', `Could not open ${path.slice(path.lastIndexOf('/') + 1)}: ${String(err)}`)
  }
}

export function closePicker() {
  setState({ picker: null })
}

/**
 * Opening a note by naming where it is.
 *
 * The app's fastest route into a file in a project it has never been shown —
 * paste a path, press Enter, read. That is the whole feature, and it is why the
 * folder is *not* registered on the way in: someone reading one note out of a
 * repo they will not come back to should not acquire a sidebar entry for it.
 * What happens to the folder is decided afterwards, and separately.
 */
/**
 * Opens a file and asks whoever draws it to scroll to one line.
 *
 * The jump is parked before the open rather than performed after it: opening is
 * asynchronous and the editor mounts later still, so there is no moment here at
 * which anything could be scrolled. See `revealPending.ts`.
 */
export async function openPathAtLine(path: string, line: number) {
  setState({ pendingReveal: { path, line } })
  await openPath(path)
}

/**
 * Following a link in a note.
 *
 * A link to another note opens as a tab here rather than as a web page, which
 * is the whole point: the editor's own "open" button hands its href to
 * `window.open`, and `./plan.md` is not a URL. Everything else goes where it
 * belongs — a local file to the Finder, an allowed URL to the browser.
 *
 * The existence check is deliberate. A relative link that resolves to nothing
 * is the common case after a file is moved outside the app, and it needs to say
 * so; opening an empty tab named after a file that is not there would look like
 * a bug in the editor rather than a stale link in the document.
 */
export async function followLink(fromPath: string, url: string) {
  const action = linkAction(fromPath, url)

  if (action.kind === 'blocked') {
    notify('error', action.reason)
    return
  }

  if (action.kind === 'external') {
    const { opened, refused } = await api.openExternal({ url: action.url })
    if (refused) notify('error', 'Orbit will not open that link.')
    // No native shell: this is the browser build, which can open its own links.
    else if (!opened) window.open(action.url, '_blank', 'noopener,noreferrer')
    return
  }

  if (!(await api.pathExists({ path: action.path }))) {
    notify('error', `${basename(action.path)} is not there any more`)
    return
  }

  if (action.kind === 'note') await openPath(action.path)
  else await api.revealInFinder({ path: action.path })
}

export async function openByPath(path: string) {
  try {
    const doc = await api.openPath({ path, addRoot: false })
    showDoc(doc)
    await offerFolder(doc.path)
  } catch (err) {
    notify('error', `Could not open ${basename(path)}: ${String(err)}`)
  }
}

/**
 * Files the app was launched with — `orbit ~/notes/plan.md`.
 *
 * Routed through `openByPath` rather than opened directly, so a file arriving
 * from outside is treated exactly like one typed into the palette: same folder
 * question, same image permission, same preference honoured.
 */
async function openPendingFiles() {
  try {
    for (const path of await api.takePendingOpens()) await openByPath(path)
  } catch {
    // The browser build has no command line; an empty answer is the normal one.
  }
}

/**
 * Whether this file's folder should join the sidebar — asked only when there is
 * something to ask about.
 *
 * A folder already covered by a root needs no question and gets none, however
 * the preference is set: the answer would change nothing, and a dialog that
 * changes nothing is the fastest way to teach someone to dismiss dialogs.
 */
async function offerFolder(filePath: string) {
  const state = getState()
  if (containingRootPath(state.roots.map(root => root.path), filePath)) return

  const folder = folderOf(filePath)
  switch (state.settings.addFolderOnPathOpen) {
    case 'never':
      return
    case 'always':
      await addFolderToSidebar(folder)
      return
    default:
      setState({ addFolderPrompt: { filePath, folder } })
  }
}

/**
 * Go to the path browser, optionally at a particular path.
 *
 * The query lives in the store rather than in the component, which is what
 * makes leaving and coming back land you where you were — and what lets any
 * other control (⇧⌘P, the title bar, a path pasted into ⌘P) send the browser
 * somewhere without owning any of its state.
 */
export function browseTo(query?: string) {
  setState(prev => ({
    surface: 'browse',
    browse: query === undefined ? prev.browse : { query, index: 0 },
  }))
}

/**
 * Open whatever a path names: a note lands in a tab, a folder lands in the
 * sidebar.
 *
 * For the entry points that cannot know which they were handed — a drag from
 * Finder, a file named on the command line. The kind is resolved by the side
 * that can actually look, and `completePath` is asked rather than `pathExists`
 * because it also does the normalising: `file://` URLs, `~`, percent-escapes
 * and quotes all arrive here as-typed.
 */
export async function openAnyPath(input: string) {
  try {
    const completion = await api.completePath({ input })
    if (completion.kind === 'directory') return openFolderInSidebar(completion.resolved)
    return openByPath(completion.resolved)
  } catch {
    // No completion available — hand it over anyway and let the open report
    // what is wrong with it, rather than failing silently here.
    return openByPath(normalizePathInput(input, ''))
  }
}

/**
 * Opening a *folder* rather than a note — the other half of what a path can
 * name.
 *
 * The palette treats a folder as somewhere to walk through, which is right
 * while you are hunting one file and wrong when the folder itself is the
 * destination. This is that second case: the folder joins the sidebar and the
 * sidebar comes forward to show it, so "open" means the same thing it does
 * everywhere else in the app.
 *
 * Leaving the browser is part of that promise rather than an extra. The browse
 * surface hides the file tree on purpose, so a folder added from there landed
 * in a sidebar the page itself was covering: the toast said "Added" and the
 * screen showed the same columns as before. Opening a folder now ends on the
 * surface that can actually show it.
 */
export async function openFolderInSidebar(folder: string) {
  if (!(await addFolderToSidebar(folder))) return
  // A folder added into a hidden sidebar is a folder nobody can see.
  if (!getState().settings.sidebarOpen) togglePanelSetting('sidebarOpen')
  await setSidebarPanel('files')
  if (getState().surface === 'browse') setState({ surface: 'editor' })
}

/** `false` when the folder could not be added — the caller has nothing to show. */
export async function addFolderToSidebar(folder: string): Promise<boolean> {
  try {
    const root = await api.addRoot({ path: folder })
    await refreshRoots()
    notify('info', `Added ${root.name}`)
    return true
  } catch (err) {
    notify('error', `Could not add folder: ${String(err)}`)
    return false
  }
}

/**
 * The pending question's answer. `remember` turns this one answer into the
 * preference, which is the same value the Settings page writes — so the dialog
 * teaches where the setting lives instead of hiding a fourth state somewhere.
 */
export async function resolveAddFolderPrompt(add: boolean, remember: boolean) {
  const prompt = getState().addFolderPrompt
  setState({ addFolderPrompt: null })
  if (remember) void setSetting('addFolderOnPathOpen', add ? 'always' : 'never')
  if (add && prompt) await addFolderToSidebar(prompt.folder)
}

export async function refreshRoots() {
  try {
    setState({ roots: await api.listRoots() })
  } catch {
    // Leave the previous list in place; a stale sidebar beats an empty one.
  }
}

export async function createFileIn(dir: string, name = 'untitled.md') {
  /*
   * Blocked too, which is a choice worth naming: a new file harms nothing that
   * already exists, so this is not required by the promise. But the file it
   * would create is one you could not then type a word into, and handing
   * someone an empty document they cannot write in is a worse answer than
   * saying no.
   */
  if (isReadOnly()) {
    notify('info', 'Read-only mode is on — no file was created.')
    return null
  }
  try {
    const doc = await api.createFile({ dir, name })
    setState(prev => ({
      tabs: [...prev.tabs, tabFromDoc(doc)],
      activePath: doc.path,
      surface: 'editor',
    }))
    void hydrateMeta(doc.path)
    void persistSession()
    return doc.path
  } catch (err) {
    notify('error', `Could not create file: ${String(err)}`)
    return null
  }
}

/**
 * A new folder, named before it exists rather than after.
 *
 * The other way round — make `untitled folder`, then open the rename dialog on
 * it, the way Finder does — was the shorter change and the wrong one: nothing
 * in this app deletes a folder, so every cancelled dialog would leave an empty
 * folder in the tree that you have to go to Finder to get rid of.
 */
export function startNewFolder(dir: string) {
  if (isReadOnly()) return void notify('info', 'Read-only mode is on — no folder was created.')
  setState({ newFolder: { dir } })
}

export function cancelNewFolder() {
  setState({ newFolder: null })
}

/** Returns the folder's path, or `null` when the name was refused. */
export async function createFolderIn(dir: string, name: string): Promise<string | null> {
  try {
    const { path } = await api.createFolder({ dir, name })
    setState({ newFolder: null })
    notifyDirChanged(dir)
    // Expands the folders above it, so a folder made in a collapsed branch is
    // one you can see rather than one you have to go looking for. A no-op when
    // the parent is not under a root, which is the browse page's case.
    revealInTree(path)
    return path
  } catch (err) {
    // The handler's messages are written for the user — "already exists in that
    // folder" is the whole answer — so show the message, not the error object.
    notify('error', `Could not create folder: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/**
 * Where a new file lands when nobody named a folder: beside the file you are
 * reading, and failing that in the first root. Shared by the ⌘N menu command
 * and the tab strip's plus so both put the file in the same place.
 *
 * The browser is the exception, and for the same reason the rest of it exists:
 * while you are on that page the folder you are looking at *is* the place you
 * mean. ⌘N there used to create the note somewhere else entirely — beside a tab
 * left open from an hour ago — which is a file quietly written to a folder
 * nobody was looking at.
 */
export async function createFileBesideActive() {
  const dir = newFileFolder()
  if (dir) await createFileIn(dir)
}

function newFileFolder(): string | null {
  const state = getState()
  const browsed = state.surface === 'browse' ? browsedDir(state.settings.browsePath) : null
  if (browsed) return browsed
  const tab = activeTab()
  return tab ? dirname(tab.path) : state.roots[0]?.path ?? null
}

export function startRename(path: string, kind: 'file' | 'folder' = 'file') {
  // Refused before the dialog rather than on submit. A form that takes a name,
  // then throws it away, teaches you nothing except not to trust the form.
  if (isReadOnly()) return void refuse(basename(path))
  setState({ rename: { path, kind } })
}

export function cancelRename() {
  setState({ rename: null })
}

/**
 * Renames the file behind a tab.
 *
 * Unsaved edits are flushed first. The editor writes by path, so an edit
 * flushed *after* the move would recreate the file under its old name and leave
 * the user with two copies.
 */
export async function renameFile(path: string, name: string): Promise<boolean> {
  const tab = getState().tabs.find(t => t.path === path)
  if (tab && isDirty(tab) && !(await saveTab(path))) return false

  try {
    const result = await api.renameFile({ path, name })
    setState({ rename: null })
    // The backend reports the path it landed on; an unchanged one means the
    // name resolved to what the file was already called.
    if (result.path !== path) {
      applyRename(path, result.path)
      // Not folded into `applyRename`: that only runs when the file is open,
      // and the sidebar has to redraw whether it is or not.
      notifyDirChanged(dirname(path))
    }
    return true
  } catch (err) {
    // These messages are written for the user — "already exists in that folder"
    // is the whole point — so show the message rather than the stringified error.
    notify('error', `Rename failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/**
 * Drops a file into a folder from the tree: move by default, copy on ⌥.
 *
 * The dirty-tab flush is the same precaution the rename takes — the editor
 * writes by path, so an edit flushed *after* the move recreates the file under
 * its old name and leaves the user with two copies. A copy leaves the original
 * where it is, so it needs no flush; the duplicate is simply of the last save.
 */
export async function dropIntoFolder(path: string, dir: string, copy: boolean): Promise<boolean> {
  if (isReadOnly()) return refuse(basename(path))

  const tab = getState().tabs.find(t => t.path === path)
  if (!copy && tab && isDirty(tab) && !(await saveTab(path))) return false

  try {
    const result = await api.moveEntry({ path, dir, copy })
    if (result.path === path) return true
    if (!copy) applyRename(path, result.path)
    // Both ends redraw: the file left one folder and arrived in another, and a
    // copy's source folder is unchanged but costs one wasted read to refresh.
    notifyDirChanged(dirname(path))
    notifyDirChanged(dir)
    return true
  } catch (err) {
    const what = copy ? 'Copy' : 'Move'
    notify('error', `${what} failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/**
 * The single entry point for "a folder moved", whoever noticed it — the rename
 * below, or the watcher seeing it happen in Finder.
 *
 * The persist call is the part that is easy to miss and expensive to omit. The
 * open-folder set is written to `settings.json`, and moving it only in memory
 * leaves the file holding paths that no longer exist: the app looks correct
 * until the next launch, then reopens the tree in the wrong shape with nothing
 * to explain why.
 */
export function applyFolderMove(from: string, to: string) {
  retargetFolder(from, to)
  persistTree()
  // Both ends, so this still works if a folder ever moves between parents.
  notifyDirChanged(from)
  notifyDirChanged(to)
}

/**
 * Renames a folder, and with it everything the app knows by a path inside it.
 *
 * The dirty-tab flush is the same precaution as the file case, applied to the
 * whole subtree: a save that lands *after* the move writes to the old path,
 * which quietly recreates the folder that was just renamed away.
 *
 * Bailing out on the first failed save is deliberate. A partial flush means some
 * notes are on disk and some are not, and renaming the folder at that point
 * would scatter the difference across two locations.
 */
export async function renameFolder(path: string, name: string): Promise<boolean> {
  for (const tab of getState().tabs) {
    if (!isUnder(tab.path, path)) continue
    if (isDirty(tab) && !(await saveTab(tab.path))) return false
  }

  try {
    const result = await api.renameFolder({ path, name })
    setState({ rename: null })
    if (result.path === path) return true
    applyFolderMove(path, result.path)
    // A renamed root changes its own name and path in the roots table.
    void refreshRoots()
    void persistSession()
    return true
  } catch (err) {
    notify('error', `Rename failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

export function startDelete(path: string) {
  if (isReadOnly()) return void refuse(basename(path))
  setState({ confirmDelete: { path } })
}

export function cancelDelete() {
  setState({ confirmDelete: null })
}

/**
 * Moves a file to the OS trash.
 *
 * Recoverable by design — the backend never unlinks — which is why one
 * confirmation is enough and there is no undo stack behind this.
 */
export async function deleteFile(path: string): Promise<boolean> {
  try {
    await api.deleteFile({ path })
    setState({ confirmDelete: null })
    // Dropped, not closed: closing would save the pending edits back to disk.
    dropTab(path)
    forgetNavPath(path)
    void refreshRoots()
    notify('info', `Moved ${basename(path)} to Trash`)
    return true
  } catch (err) {
    notify('error', `Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/**
 * Points an open tab at a file's new path. Shared by the in-app rename and by
 * renames observed on disk, which would otherwise leave a tab saving to a path
 * that no longer exists.
 */
export function applyRename(from: string, to: string) {
  if (!getState().tabs.some(tab => tab.path === from)) return
  retargetTab(from, to)
  void hydrateMeta(to)
  void persistSession()
}

export async function updateMeta(
  path: string,
  patch: {
    labels?: string[]
    tags?: string[]
    note?: string
    pinned?: boolean
    icon?: string
    color?: string
  },
) {
  try {
    const meta = await api.updateMeta({ path, patch })
    updateTab(path, { meta })
    // The sidebar draws from its own per-folder metadata read, so a change made
    // from the toolbar or the menu has to reach it too.
    window.dispatchEvent(new CustomEvent('app:meta-changed', { detail: path }))
    return meta
  } catch (err) {
    notify('error', `Could not save metadata: ${String(err)}`)
    return null
  }
}

/** Persists the open-tab set so a restart lands the user back where they were. */
export function persistSession() {
  const state = getState()
  return api
    .saveSettings({
      patch: {
        lastOpenPaths: state.tabs.map(tab => tab.path),
        activePath: state.activePath,
      },
    })
    .catch(() => undefined)
}

export function setSurface(surface: ReturnType<typeof getState>['surface']) {
  setState({ surface })
}

/**
 * The one way a preference is written: optimistically to the store, then to
 * disk in the background.
 *
 * Every setter in the app had its own copy of these three lines, which is fine
 * until they disagree — one awaits the write, one swallows the failure, one
 * does not. The settings page adds a dozen more, so the shape is fixed here
 * once instead.
 *
 * The write is deliberately not awaited and its failure is deliberately
 * swallowed: a control that waits for disk before it moves feels broken, and
 * the worst case is losing a preference, never a document.
 */
export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  setState(prev => ({ settings: { ...prev.settings, [key]: value } }))
  return api.saveSettings({ patch: { [key]: value } }).catch(() => undefined)
}

/**
 * Records where the user left a pane's edge.
 *
 * Called once, on release — the drag itself moves a CSS variable, so this is
 * the only store write a resize costs.
 */
export function savePaneWidth(pane: PaneKey, width: number) {
  return setSetting(pane, width)
}

/** Flips one of the booleans that decide which pieces of chrome are on screen. */
export function togglePanelSetting(key: 'sidebarOpen' | 'inspectorOpen' | 'tabBarOpen') {
  void setSetting(key, !getState().settings[key])
}

/**
 * Brings one of the inspector's views up, or puts the pane away if it is
 * already the one on screen.
 *
 * Two settings move together here — which tab, and whether the pane is open —
 * so they are written as one patch rather than through two `setSetting` calls.
 * Asking for the visible tab a second time closes the pane, which is what makes
 * a menu item named after a view still behave like a toggle.
 */
export function showInspectorTab(tab: InspectorTab) {
  const { inspectorOpen, inspectorTab } = getState().settings
  const patch: Partial<AppSettings> =
    inspectorOpen && inspectorTab === tab
      ? { inspectorOpen: false }
      : { inspectorOpen: true, inspectorTab: tab }
  setState(prev => ({ settings: { ...prev.settings, ...patch } }))
  return api.saveSettings({ patch }).catch(() => undefined)
}
