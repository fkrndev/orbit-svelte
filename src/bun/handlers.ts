import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { AppRPCRequests } from '../shared/rpc'
import type { FileChangeEvent, Root } from '../shared/types'
import {
  birthTime,
  isSameEntry,
  listDir,
  readDoc,
  renamePath,
  toStat,
  uniquePath,
  walkMarkdown,
  writeDoc,
} from './services/files'
import {
  addRoot,
  listRoots,
  removeRoot,
  rootIdForPath,
  setRootCollapsed,
  setRootPinned,
  trackRootMove,
} from './services/roots'
import {
  addBookmark,
  getFolderDecor,
  listBookmarks,
  moveBookmark,
  removeBookmark,
  renameBookmark,
  setFolderDecor,
  trackFileMove,
  trackFolderMove,
} from './services/sidebar'
import {
  deleteLabel,
  ensureMeta,
  getMetaMany,
  listLabels,
  movePath,
  movePathsUnder,
  updateMeta,
  upsertLabel,
} from './services/meta'
import { isMarkdownName, planFolderRename, planRename } from '../shared/rename'
import { ASSET_DIR } from '../shared/assets'
import {
  fileExcerpt,
  getDashboard,
  listRecentFolders,
  listRecents,
  recordEvent,
} from './services/history'
import { listTodos } from './services/todosIndex'
import { hitsForRef, refCounts, tagCounts } from './services/tagIndex'
import { searchUnder } from './services/searchUnder'
import { findIncomingLinks } from './services/incomingLinks'
import { isOpenableUrl } from '../shared/links'
import { takeOpens } from './services/pendingOpens'
import { filterTree, invalidateSearchCache, listTreeDirs, quickOpen } from './services/search'
import { watchRoot } from './services/watcher'
import { getSettings, saveSettings } from './services/settings'
import {
  deletePropertyConfig,
  getPropertySchema,
  renamePropertyConfig,
  savePropertyConfig,
  savePropertyOrder,
} from './services/propertySchema'
import { completePath, pathColumns } from './services/pathComplete'
import { grantFolderFor } from './services/openedFolders'
import { HOME_DIR } from './paths'

/**
 * The request handlers, shared by both front doors: Electrobun's RPC in the
 * desktop app, and the HTTP dev server that backs the browser build.
 *
 * Everything that needs a native API — trash, Finder, the system file dialog —
 * is injected, because the dev server has no native bridge to call.
 */
export interface NativeBridge {
  /** System file/folder dialog. `null` when unavailable; the UI then falls back to its own picker. */
  pickPath(options: {
    canChooseFiles: boolean
    canChooseDirectory: boolean
    allowedFileTypes?: string
  }): Promise<string | null>
  moveToTrash(path: string): void
  showItemInFolder(path: string): void
  /**
   * Hand a URL to the operating system. `false` when there is no native shell
   * to hand it to, which is the browser build's cue to use `window.open`.
   */
  openExternal(url: string): boolean
  /** Zoom the window if it is restored, restore it if it is zoomed. */
  toggleWindowZoom(): { zoomed: boolean }
}

export type RequestHandlers = {
  [K in keyof AppRPCRequests]: (
    params: AppRPCRequests[K]['params'],
  ) => AppRPCRequests[K]['response'] | Promise<AppRPCRequests[K]['response']>
}

export function createRequestHandlers(options: {
  native: NativeBridge
  emitFileChange: (event: FileChangeEvent) => void
}): RequestHandlers {
  const { native, emitFileChange } = options

  /** Registering a root and starting its watcher always happen together. */
  function trackRoot(path: string): Root {
    const root = addRoot(path)
    watchRoot(root.path, emitFileChange)
    invalidateSearchCache()
    return root
  }

  return {
    // ---- files -----------------------------------------------------------
    readFile: ({ path }) => readDoc(path),

    writeFile: async ({ path, content, expectedMtimeMs }) => {
      const result = await writeDoc(path, content, expectedMtimeMs)
      if (!result.conflict) invalidateSearchCache(path)
      return result
    },

    createFile: async ({ dir, name, content }) => {
      // `isMarkdownName` rather than a bare `.md` test: a name the user gave as
      // `notes.markdown` is already a note, and bolting a second extension onto
      // it would create `notes.markdown.md`.
      const path = uniquePath(dir, isMarkdownName(name) ? name : `${name}.md`)
      await writeDoc(path, content ?? '')
      invalidateSearchCache(path)
      ensureMeta(path)
      recordEvent(path, 'create')
      return readDoc(path)
    },

    renameFile: ({ path, name }) => {
      if (!existsSync(path)) throw new Error(`No such file: ${path}`)

      const plan = planRename(path, name)
      if (plan.kind === 'invalid') throw new Error(plan.reason)
      if (plan.kind === 'unchanged') return { path }

      // `rename(2)` replaces an existing destination without a word. Refuse
      // instead: an unlucky rename onto a sibling would destroy it outright,
      // and unlike a delete there is nothing in the trash to recover.
      if (existsSync(plan.nextPath) && !isSameEntry(path, plan.nextPath)) {
        throw new Error(`"${basename(plan.nextPath)}" already exists in that folder`)
      }

      const final = renamePath(path, plan.nextPath)
      // A bookmark is a path, so it has to follow the file for the same reason
      // the metadata does — and for the same reason it is done here rather than
      // left to the watcher's fingerprint pairing.
      trackFileMove(path, final)
      // The watcher *can* reconstruct a rename from fingerprints, but only on a
      // watched root and only if both halves land within its pairing window. An
      // in-app rename knows both paths for certain, so move the metadata here
      // rather than hoping the pairing succeeds — losing a file's tags and note
      // to a timing race is not an acceptable failure mode.
      movePath(path, final)
      invalidateSearchCache(path)
      recordEvent(final, 'rename', { from: path })
      // Emitted before the filesystem events for the same rename can arrive, so
      // clients retarget the file rather than seeing the old path go missing.
      emitFileChange({ type: 'renamed', path: final, from: path })
      return { path: final }
    },

    renameFolder: ({ path, name }) => {
      if (!existsSync(path)) throw new Error(`No such folder: ${path}`)
      if (!statSync(path).isDirectory()) throw new Error(`Not a folder: ${path}`)

      const plan = planFolderRename(path, name)
      if (plan.kind === 'invalid') throw new Error(plan.reason)
      if (plan.kind === 'unchanged') return { path }

      // Worse than the file case: `rename(2)` on a directory silently *replaces*
      // an empty destination and fails with ENOTEMPTY on a full one, so the only
      // two outcomes are a deletion the user did not ask for and a raw errno.
      if (existsSync(plan.nextPath) && !isSameEntry(path, plan.nextPath)) {
        throw new Error(`"${basename(plan.nextPath)}" already exists in that folder`)
      }

      const final = renamePath(path, plan.nextPath)

      // Roots first, and the order is load-bearing: `movePathsUnder` recomputes
      // each file's `rootId` from the roots table, so a stale root path would
      // hand every file in the folder a `rootId` of null.
      trackRootMove(path, final)
      const moved = movePathsUnder(path, final)
      // Bookmarks and folder decoration, for the folder and everything in it.
      trackFolderMove(path, final)
      // Cleared wholesale rather than per root: the renamed folder may *be* a
      // root, in which case the per-path invalidation has no root prefix left to
      // match. A folder rename is rare enough that one extra walk costs nothing.
      invalidateSearchCache()

      // One event for the whole folder, not one per file inside it. Clients
      // retarget by prefix — see `applyFolderMove` — so a folder of 300 notes
      // does not become 300 broadcasts and 300 directory re-reads.
      //
      // No history event either: `recordEvent` calls `ensureMeta`, which would
      // mint a metadata record for a *directory* and leave it showing up
      // wherever the app lists files by metadata.
      emitFileChange({ type: 'renamed', path: final, from: path, isDirectory: true })
      console.log(`[rename] ${path} -> ${final} (${moved.length} tracked files)`)
      return { path: final }
    },

    deleteFile: ({ path }) => {
      if (!existsSync(path)) throw new Error(`No such file: ${path}`)
      // Only ever a move to the OS trash — see services/trash.ts. This throws
      // rather than unlinking if it cannot find one, so a failed delete stays
      // recoverable.
      native.moveToTrash(path)
      invalidateSearchCache(path)
      // The metadata record is deliberately kept. The file is in the trash, not
      // gone, and restoring it should bring its tags and note back with it —
      // the fingerprint repair in meta.ts is what re-links them.
      emitFileChange({ type: 'deleted', path })
      return { trashed: true }
    },

    listDir: ({ path }) => listDir(path),
    revealInFinder: ({ path }) => native.showItemInFolder(path),
    /*
     * Checked here as well as in the UI. The UI decides which button to draw;
     * this decides what the machine is allowed to launch, and the two are not
     * the same job — anything that can reach the RPC would otherwise be one
     * call away from every URL handler installed on the system.
     */
    openExternal: ({ url }) => {
      if (!isOpenableUrl(url)) {
        console.warn(`[api] refused to open ${url.slice(0, 40)}`)
        return { opened: false, refused: true }
      }
      return { opened: native.openExternal(url), refused: false }
    },

    fileInfo: ({ path }) => ({ ...toStat(path), birthtimeMs: birthTime(path) }),

    /**
     * Assets land in `assets/` beside the note, never in the app's data
     * directory — see `shared/assets.ts` for why. `uniquePath` means pasting
     * twice never overwrites the first image.
     */
    saveAsset: ({ notePath, name, base64 }) => {
      const dir = join(dirname(notePath), ASSET_DIR)
      mkdirSync(dir, { recursive: true })
      const path = uniquePath(dir, name)
      writeFileSync(path, Buffer.from(base64, 'base64'))
      return { path, relative: `${ASSET_DIR}/${basename(path)}` }
    },

    listMarkdownFiles: ({ limit }) => {
      const out: Array<{ path: string; name: string }> = []
      for (const root of listRoots()) {
        for (const path of walkMarkdown(root.path)) {
          out.push({ path, name: basename(path) })
          if (out.length >= (limit ?? 2000)) return out
        }
      }
      return out
    },

    toggleWindowZoom: () => native.toggleWindowZoom(),
    pathExists: ({ path }) => existsSync(path),

    // ---- roots -----------------------------------------------------------
    listRoots: () => listRoots(),
    addRoot: ({ path }) => trackRoot(path),
    removeRoot: ({ id }) => {
      removeRoot(id)
      invalidateSearchCache()
    },
    setRootCollapsed: ({ id, collapsed }) => setRootCollapsed(id, collapsed),
    setRootPinned: ({ id, pinned }) => setRootPinned(id, pinned),

    pickFolder: async () => {
      const picked = await native.pickPath({ canChooseFiles: false, canChooseDirectory: true })
      return picked ? trackRoot(picked) : null
    },

    pickFile: async () => {
      const picked = await native.pickPath({
        canChooseFiles: true,
        canChooseDirectory: false,
        allowedFileTypes: 'md,markdown,mdx',
      })
      if (!picked) return null
      ensureRootFor(picked, trackRoot)
      return readDoc(picked)
    },

    /** Opening a file the UI picked itself (browser mode has no system dialog). */
    openPath: ({ path, addRoot: register = true }) => {
      if (!existsSync(path)) throw new Error(`No such file: ${path}`)
      if (register) ensureRootFor(path, trackRoot)
      // Not an else: a file inside a root needs no grant, and one outside needs
      // it whether or not the caller went on to register the folder.
      else if (!rootIdForPath(path)) grantFolderFor(path)
      return readDoc(path)
    },

    completePath: ({ input }) => completePath(input, HOME_DIR),
    pathColumns: ({ input }) => pathColumns(input, HOME_DIR),
    searchUnder: ({ dir, query, limit }) => searchUnder(dir, query, limit),
    findIncomingLinks: ({ path, limit }) => findIncomingLinks(path, limit),
    peekFile: ({ path }) => ({ excerpt: fileExcerpt(path) }),
    takePendingOpens: () => takeOpens(),

    /** Starting points for the in-app path picker. */
    listPlaces: () => {
      const candidates = [
        { name: 'Home', path: HOME_DIR },
        { name: 'Documents', path: join(HOME_DIR, 'Documents') },
        { name: 'Desktop', path: join(HOME_DIR, 'Desktop') },
        { name: 'Downloads', path: join(HOME_DIR, 'Downloads') },
      ]
      return {
        home: HOME_DIR,
        places: candidates.filter(place => existsSync(place.path)),
      }
    },

    // ---- metadata --------------------------------------------------------
    getMeta: ({ path }) => ensureMeta(path),
    getMetaMany: ({ paths }) => getMetaMany(paths),
    updateMeta: ({ path, patch }) => updateMeta(path, patch),
    // The document, not the sidecar: the sidecar list has had no writer since
    // the labels/tags panel was removed, so it answers every question with zero.
    // `tagCounts` reads the `tags:` property and the `#tag`s in the prose as one
    // thing — see `services/tagIndex.ts`.
    listTags: () => tagCounts(),
    listMentions: () => refCounts('mention').map(({ label, count }) => ({ mention: label, count })),
    notesWithRef: ({ kind, label, limit }) => hitsForRef(kind, label, limit),
    listLabels: () => listLabels(),
    upsertLabel: ({ label }) => upsertLabel(label),
    deleteLabel: ({ name }) => deleteLabel(name),
    getFolderDecor: ({ paths }) => getFolderDecor(paths),
    setFolderDecor: ({ path, decor }) => setFolderDecor(path, decor),

    // ---- bookmarks -------------------------------------------------------
    listBookmarks: () => listBookmarks(),
    addBookmark: params => addBookmark(params),
    removeBookmark: ({ id }) => removeBookmark(id),
    moveBookmark: ({ id, groupId, order }) => moveBookmark(id, groupId, order),
    renameBookmark: ({ id, title }) => renameBookmark(id, title),

    // ---- history ---------------------------------------------------------
    recordEvent: ({ path, type, dwellMs, from }) => recordEvent(path, type, { dwellMs, from }),

    // ---- dashboard -------------------------------------------------------
    getDashboard: params => getDashboard(params?.limit),
    listRecents: params => listRecents(params?.sort, params?.limit, params?.withExcerpt),
    listTodos: params => listTodos(params ?? {}),
    recentFolders: params => listRecentFolders(params?.limit),

    // ---- search ----------------------------------------------------------
    quickOpen: ({ query, limit }) => quickOpen(query, limit),
    filterTree: ({ query, limit }) => filterTree(query, limit),
    listTreeDirs: ({ rootPath, max }) => listTreeDirs(rootPath, max),

    // ---- settings --------------------------------------------------------
    getPropertySchema: () => getPropertySchema(),
    savePropertyConfig: ({ key, patch }) => savePropertyConfig(key, patch),
    deletePropertyConfig: ({ key }) => deletePropertyConfig(key),
    renamePropertyConfig: ({ from, to }) => renamePropertyConfig(from, to),
    savePropertyOrder: ({ keys }) => savePropertyOrder(keys),

    getSettings: () => getSettings(),
    saveSettings: ({ patch }) => saveSettings(patch),
  }
}

/**
 * Opening a loose file quietly registers its folder, so the next quick-open can
 * already reach its siblings.
 */
function ensureRootFor(filePath: string, trackRoot: (path: string) => Root) {
  if (rootIdForPath(filePath)) return
  trackRoot(statSync(filePath).isDirectory() ? filePath : dirname(filePath))
}
