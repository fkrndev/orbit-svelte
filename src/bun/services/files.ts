import { createHash } from 'node:crypto'
import { openSync, readSync, closeSync, statSync, existsSync, readdirSync, renameSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import type { DirEntry, FileDoc, FileStat, Fingerprint } from '../../shared/types'
import { isMarkdownName, isOpenableName } from '../../shared/rename'

// Defined in `shared/` because the webview needs the same list to build the
// rename field's default value. Re-exported here so existing callers are
// unaffected by where it lives.
export { MARKDOWN_EXTENSIONS, CODE_EXTENSIONS } from '../../shared/rename'

/**
 * Directories that are never worth walking. Scanning `node_modules` or `.git`
 * across a handful of project roots is the difference between a snappy
 * quick-open and a spinning beachball.
 */
export const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'target', 'dist', 'build', '.next', '.nuxt', '.svelte-kit',
  'vendor', '__pycache__', '.venv', 'venv', '.cache', 'coverage', '.turbo', '.parcel-cache',
  'Pods', '.gradle', '.idea', '.DS_Store', '.bun', '.pnpm-store',
])

const FINGERPRINT_BYTES = 4096

export function isMarkdown(path: string): boolean {
  return isMarkdownName(path)
}

/**
 * Markdown *or* code — what the tree, quick-open, and the watcher will show.
 *
 * Kept apart from `isMarkdown` rather than widening it: the tag index, the todo
 * scan, and backlinks all ask `isMarkdown`, and all three would start reporting
 * nonsense from source files if the answer changed underneath them.
 */
export function isOpenable(path: string): boolean {
  return isOpenableName(path)
}

export function toStat(path: string): FileStat {
  const s = statSync(path)
  return { size: s.size, mtimeMs: Math.round(s.mtimeMs) }
}

/**
 * When the *file* was created, which is not when we started tracking it.
 *
 * Kept out of `FileStat` deliberately: that type exists to answer "did this
 * change under us", and a birth time never changes, so carrying it through
 * every read and conflict check would be dead weight.
 *
 * Not every filesystem records one. Linux famously reports the epoch, so treat
 * anything at or before it as unknown rather than claiming 1 January 1970.
 */
export function birthTime(path: string): number | null {
  const ms = Math.round(statSync(path).birthtimeMs)
  return ms > 0 ? ms : null
}

/**
 * Cheap content identity: size + mtime + a hash of the first 4KB.
 *
 * Deliberately not a full-file hash — this runs on every open, and the point is
 * only to re-link sidecar metadata after a file is moved outside the app, not
 * to prove two files are byte-identical.
 */
export function fingerprint(path: string): Fingerprint | null {
  try {
    const stat = toStat(path)
    const fd = openSync(path, 'r')
    try {
      const buf = Buffer.alloc(Math.min(FINGERPRINT_BYTES, stat.size || FINGERPRINT_BYTES))
      const read = readSync(fd, buf, 0, buf.length, 0)
      const head = createHash('sha1').update(buf.subarray(0, read)).digest('hex').slice(0, 8)
      return { ...stat, head }
    } finally {
      closeSync(fd)
    }
  } catch {
    return null
  }
}

/**
 * The first `bytes` of a file, decoded as UTF-8.
 *
 * For callers that want a taste rather than the contents — a preview line for
 * a list of eighty files should not pull eighty whole documents into memory.
 * The cut lands on a byte, so the last character may arrive broken; whoever
 * renders the text has to tolerate a replacement glyph at the end.
 */
export function readHead(path: string, bytes: number): string | null {
  try {
    const fd = openSync(path, 'r')
    try {
      const buf = Buffer.alloc(bytes)
      const read = readSync(fd, buf, 0, bytes, 0)
      return buf.subarray(0, read).toString('utf8')
    } finally {
      closeSync(fd)
    }
  } catch {
    return null
  }
}

/**
 * Big enough for any note and any source file anyone edits by hand; small
 * enough that the wrong click does not take the window with it. `bun.lock` and
 * a minified bundle both live above this line, and both are one keystroke away
 * in a tree that now shows code.
 */
const MAX_DOC_BYTES = 2 * 1024 * 1024

export async function readDoc(path: string): Promise<FileDoc> {
  const stat = toStat(path)
  if (stat.size > MAX_DOC_BYTES) {
    throw new Error(
      `too large to open (${Math.round(stat.size / 1024 / 1024)} MB) — the limit is 2 MB`,
    )
  }

  const content = await readFile(path, 'utf8')

  /*
   * A binary that happens to carry a known extension — a compiled `.log`, a
   * database dumped as `.txt`. `readFile` decodes it happily into replacement
   * characters, and saving it back would write those replacements over the real
   * bytes. The NUL is the tell; text files do not contain one.
   *
   * Only the head is checked. Reading further to be sure costs a scan of every
   * file opened, and a binary with no NUL in its first 8KB is not a case worth
   * paying for on every note.
   */
  if (content.slice(0, 8192).includes('\0')) {
    throw new Error('this looks like a binary file, not text')
  }

  return { path, content, stat }
}

/**
 * Writes only when the file on disk still looks like what the editor last read.
 * The caller decides what to do about a conflict — we never silently clobber.
 */
export async function writeDoc(
  path: string,
  content: string,
  expectedMtimeMs?: number,
): Promise<{ stat: FileStat; conflict: boolean }> {
  if (expectedMtimeMs !== undefined && existsSync(path)) {
    const current = toStat(path)
    if (current.mtimeMs > expectedMtimeMs) {
      return { stat: current, conflict: true }
    }
  }
  mkdirSync(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
  return { stat: toStat(path), conflict: false }
}

/**
 * Makes one folder, and refuses rather than shrugging when the name is taken.
 *
 * `mkdirSync` without `recursive` on purpose, twice over: it throws if the
 * parent is missing, which is the caller passing a folder that no longer
 * exists, and it throws if the name is taken — including by a *file*, which a
 * bare `existsSync` check would report as "already exists in that folder" but
 * `recursive: true` would silently accept as success.
 */
export function createDir(dir: string, name: string): string {
  const path = join(dir, name)
  if (existsSync(path)) throw new Error(`"${name}" already exists in that folder`)
  mkdirSync(path)
  return path
}

/** Appends `-2`, `-3`, ... until the name is free. */
export function uniquePath(dir: string, name: string): string {
  const ext = extname(name)
  const stem = basename(name, ext)
  let candidate = join(dir, name)
  let n = 2
  while (existsSync(candidate)) {
    candidate = join(dir, `${stem}-${n}${ext}`)
    n += 1
  }
  return candidate
}

export function listDir(path: string): DirEntry[] {
  const entries: DirEntry[] = []
  for (const dirent of readdirSync(path, { withFileTypes: true })) {
    if (dirent.name.startsWith('.')) continue
    const full = join(path, dirent.name)
    if (dirent.isDirectory()) {
      if (IGNORED_DIRS.has(dirent.name)) continue
      entries.push({ name: dirent.name, path: full, isDirectory: true })
    } else if (isOpenable(dirent.name)) {
      let stat: FileStat | undefined
      try {
        stat = toStat(full)
      } catch {
        continue
      }
      entries.push({ name: dirent.name, path: full, isDirectory: false, stat })
    }
  }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return entries
}

export interface WalkOptions {
  maxDepth?: number
  maxFiles?: number
  signal?: { cancelled: boolean }
  /**
   * Which files count. Defaults to markdown, so every existing caller — the tag
   * index, the todo scan, backlinks — keeps the narrower meaning it was written
   * against; the surfaces that should also see code pass `isOpenable`.
   */
  accept?: (name: string) => boolean
}

/**
 * Depth-first file walk with hard caps. The caps exist so a user who points
 * the app at their home directory gets a degraded result instead of a hang.
 */
export function* walkMarkdown(root: string, options: WalkOptions = {}): Generator<string> {
  const { maxDepth = 12, maxFiles = 20000, signal, accept = isMarkdown } = options
  let yielded = 0
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]

  while (stack.length > 0) {
    if (signal?.cancelled) return
    const { dir, depth } = stack.pop()!
    if (depth > maxDepth) continue

    let dirents
    try {
      dirents = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const dirent of dirents) {
      if (dirent.name.startsWith('.')) continue
      const full = join(dir, dirent.name)
      if (dirent.isDirectory()) {
        if (IGNORED_DIRS.has(dirent.name)) continue
        stack.push({ dir: full, depth: depth + 1 })
      } else if (accept(dirent.name)) {
        yield full
        yielded += 1
        if (yielded >= maxFiles) return
      }
    }
  }
}

/**
 * Every folder under `root`, breadth-agnostic, with the same exclusions the
 * tree itself applies — so Expand All opens exactly what the tree can draw.
 *
 * Capped like `walkMarkdown`, and the cap is reported rather than swallowed:
 * a truncated expansion that says nothing reads as "this is the whole folder".
 */
export function walkDirs(
  root: string,
  options: { maxDepth?: number; max?: number } = {},
): { dirs: string[]; truncated: boolean } {
  const { maxDepth = 12, max = 2000 } = options
  const dirs: string[] = []
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]

  while (stack.length > 0) {
    const { dir, depth } = stack.pop()!
    if (depth >= maxDepth) continue

    let dirents
    try {
      dirents = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) continue
      if (dirent.name.startsWith('.') || IGNORED_DIRS.has(dirent.name)) continue
      dirs.push(join(dir, dirent.name))
      if (dirs.length >= max) return { dirs, truncated: true }
      stack.push({ dir: join(dir, dirent.name), depth: depth + 1 })
    }
  }

  return { dirs, truncated: false }
}

/**
 * Two paths that name the same entry on disk, even spelled differently.
 *
 * macOS filesystems are case-insensitive by default, so `existsSync` answers yes
 * to `Notes` when only `notes` is there. A rename guard built on `existsSync`
 * alone therefore refuses the most ordinary rename of all — fixing the
 * capitalisation of something — with "already exists in that folder".
 */
export function isSameEntry(a: string, b: string): boolean {
  try {
    const left = statSync(a)
    const right = statSync(b)
    return left.ino === right.ino && left.dev === right.dev
  } catch {
    return false
  }
}

export function renamePath(path: string, nextPath: string): string {
  mkdirSync(dirname(nextPath), { recursive: true })
  renameSync(path, nextPath)
  return nextPath
}
