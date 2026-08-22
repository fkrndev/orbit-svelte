import { watch, type FSWatcher } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { FileChangeEvent } from '../../shared/types'
import { isMarkdown, fingerprint } from './files'
import { metaByPath, movePath, allMeta } from './meta'
import { invalidateSearchCache } from './search'
import { invalidateTodosCache } from './todosIndex'
import { invalidateTagCache } from './tagIndex'
import { trackFileMove, trackFolderMove } from './sidebar'

/**
 * One recursive watcher per root.
 *
 * `fs.watch` on macOS reports renames as two indistinguishable "rename" events
 * (one for the old path, one for the new). We reconstruct the pairing by
 * fingerprint: a vanished path plus a freshly appeared path with identical
 * content is a move, and the sidecar metadata follows it.
 */

type Emit = (event: FileChangeEvent) => void

const watchers = new Map<string, FSWatcher>()

/** A path that disappeared and might be the source half of a rename. */
interface PendingRemoval {
  path: string
  head: string
  size: number
  at: number
}

let pendingRemovals: PendingRemoval[] = []
const RENAME_PAIR_WINDOW_MS = 1500

function prunePending(now: number) {
  pendingRemovals = pendingRemovals.filter(p => now - p.at < RENAME_PAIR_WINDOW_MS)
}

export function watchRoot(rootPath: string, emit: Emit) {
  if (watchers.has(rootPath)) return
  if (!existsSync(rootPath)) return

  try {
    const watcher = watch(rootPath, { recursive: true }, (_type, filename) => {
      if (!filename) return
      const path = join(rootPath, filename.toString())
      if (!isMarkdown(path)) return
      handleChange(path, emit)
    })
    watchers.set(rootPath, watcher)
  } catch (err) {
    // A watch failure degrades freshness, not correctness — the app still works,
    // it just won't notice external edits for this root.
    console.error(`[watcher] could not watch ${rootPath}:`, err)
  }
}

export function unwatchRoot(rootPath: string) {
  const watcher = watchers.get(rootPath)
  if (!watcher) return
  watcher.close()
  watchers.delete(rootPath)
}

export function unwatchAll() {
  for (const watcher of watchers.values()) watcher.close()
  watchers.clear()
}

function handleChange(path: string, emit: Emit) {
  invalidateSearchCache(path)
  // Home draws a list of tasks read out of these files; a stale one is worse
  // than none, because it looks like an answer.
  invalidateTodosCache(path)
  invalidateTagCache(path)
  const now = Date.now()
  prunePending(now)

  if (!existsSync(path)) {
    const meta = metaByPath(path)
    if (meta?.fingerprint) {
      pendingRemovals.push({
        path,
        head: meta.fingerprint.head,
        size: meta.fingerprint.size,
        at: now,
      })
    }
    emit({ type: 'deleted', path })
    return
  }

  const known = metaByPath(path)
  if (known) {
    emit({ type: 'modified', path })
    return
  }

  // Unknown path that now exists — either a brand new file or the landing half
  // of a rename. Check the recently vanished paths for a content match.
  const print = fingerprint(path)
  const pairIndex = print
    ? pendingRemovals.findIndex(p => p.head === print.head && p.size === print.size)
    : -1

  if (pairIndex !== -1) {
    const [pair] = pendingRemovals.splice(pairIndex, 1)
    movePath(pair!.path, path)
    trackFileMove(pair!.path, path)
    emit({ type: 'renamed', path, from: pair!.path })
    followFolderRename(pair!.path, path, emit)
    return
  }

  emit({ type: 'created', path })
}

/**
 * Infers a folder rename from the files inside it.
 *
 * The watcher filters to markdown, so it never sees the folder event itself —
 * what it sees is every note inside moving from one directory to another. That
 * is also what an ordinary file move looks like, and mistaking one for the
 * other would rewrite the decoration of two folders that are both still there.
 *
 * Three conditions have to hold together before we treat it as a rename: the
 * old directory is gone, the new one is present, and both sit in the same
 * parent. Moving a note between two existing folders fails the first test;
 * moving a folder into a different parent is not detected at all, and losing
 * one folder colour is the right price for never destroying two.
 */
function followFolderRename(from: string, to: string, emit: Emit) {
  const fromDir = dirname(from)
  const toDir = dirname(to)
  if (fromDir === toDir) return
  if (dirname(fromDir) !== dirname(toDir)) return
  if (existsSync(fromDir) || !existsSync(toDir)) return

  trackFolderMove(fromDir, toDir)
  // A folder holding several notes produces one of these per note, so this
  // fires more than once for a single rename. Every consumer of it is
  // idempotent — the second pass finds nothing left under the old path.
  emit({ type: 'renamed', path: toDir, from: fromDir, isDirectory: true })
}

/**
 * Startup reconciliation: metadata whose file vanished while the app was closed
 * gets no watcher event, so log it once rather than let it fail silently later.
 */
export function reportMissingFiles() {
  const missing = allMeta().filter(meta => !existsSync(meta.path))
  if (missing.length > 0) {
    console.log(`[watcher] ${missing.length} tracked file(s) missing; metadata kept for relinking`)
  }
}
