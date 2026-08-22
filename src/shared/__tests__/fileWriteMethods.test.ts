import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FILE_WRITE_METHODS } from '../rpc'

/**
 * Read-only mode is exactly as good as `FILE_WRITE_METHODS` is complete.
 *
 * The gate in `lib/rpcClient.ts` refuses the methods named in that set and lets
 * everything else through, which is the right default — most requests are reads
 * or touch the app's own sidecar stores. But it means a *new* request that
 * writes to the user's folders is allowed by omission: nothing fails to compile,
 * nothing throws, and the first sign of trouble is a file changing while
 * somebody believed it could not.
 *
 * So every request in the schema must be classified, here, as one or the other.
 * Adding an RPC without touching this file fails the suite — and the fix is to
 * decide which list it belongs in, which is the decision that was being skipped.
 *
 * The names are read out of the source text because `AppRPCRequests` is a type:
 * there is no runtime object to enumerate.
 */

const SOURCE = readFileSync(resolve(import.meta.dirname, '../rpc.ts'), 'utf8')

/** The body of `export type AppRPCRequests = { … }`, and nothing after it. */
const SCHEMA = SOURCE.slice(
  SOURCE.indexOf('export type AppRPCRequests'),
  SOURCE.indexOf('export const FILE_WRITE_METHODS'),
)

/** Top-level keys only — two spaces of indent, then `name: {`. */
const DECLARED = [...SCHEMA.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*): \{/gm)].map(match => match[1]!)

/**
 * Requests that cannot change a byte in a folder the user opened.
 *
 * Reads, native shells (`revealInFinder`, `openExternal`), and the writes that
 * land in this app's own data directory — metadata, bookmarks, labels, the
 * property schema, settings. Those last ones *are* writes; they are listed here
 * because read-only protects the user's files, not the app's memory of them.
 * Blocking them would stop you pinning or tagging while reading, which is
 * precisely what reading is for.
 */
const NON_FILE_METHODS = new Set([
  // reads
  'readFile', 'listDir', 'pathExists', 'fileInfo', 'listMarkdownFiles', 'peekFile',
  'completePath', 'pathColumns', 'searchUnder', 'findIncomingLinks', 'listPlaces',
  'getMeta', 'getMetaMany', 'getFolderDecor', 'listTags', 'listMentions', 'notesWithRef',
  'listLabels', 'getDashboard',
  'recentFolders', 'listRecents', 'listTodos', 'listBookmarks', 'quickOpen', 'filterTree',
  'listTreeDirs', 'getPropertySchema', 'getSettings', 'listRoots', 'takePendingOpens',
  // opening and revealing — the OS acts, the file does not change
  'openPath', 'revealInFinder', 'openExternal', 'pickFolder', 'pickFile', 'toggleWindowZoom',
  // sidecar stores, in this app's own data directory
  'addRoot', 'removeRoot', 'setRootCollapsed', 'setRootPinned', 'updateMeta', 'setFolderDecor',
  'upsertLabel', 'deleteLabel', 'recordEvent', 'addBookmark', 'removeBookmark', 'moveBookmark',
  'renameBookmark', 'savePropertyConfig', 'deletePropertyConfig', 'renamePropertyConfig',
  'savePropertyOrder', 'saveSettings',
])

describe('the write list read-only enforces against', () => {
  it('finds the schema (a rename would otherwise make this suite vacuous)', () => {
    expect(DECLARED.length).toBeGreaterThan(50)
  })

  it.each(DECLARED)('%s is classified as writing files or not', method => {
    const classified = FILE_WRITE_METHODS.has(method as never) || NON_FILE_METHODS.has(method)
    expect(
      classified,
      `${method} is a new RPC. Decide: does it change a file in a folder the user opened? ` +
        `If so add it to FILE_WRITE_METHODS in shared/rpc.ts, otherwise to NON_FILE_METHODS here.`,
    ).toBe(true)
  })

  it('classifies nothing twice', () => {
    for (const method of FILE_WRITE_METHODS) {
      expect(NON_FILE_METHODS.has(method), `${method} is in both lists`).toBe(false)
    }
  })

  it('names only methods that exist', () => {
    for (const method of FILE_WRITE_METHODS) expect(DECLARED).toContain(method)
  })
})
