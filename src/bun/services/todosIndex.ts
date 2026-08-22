import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { RootId, TodoHit, TodoScan, TodoTally } from '../../shared/types'
import { plain } from '../../shared/outline'
import { todos } from '../../shared/todos'
import { walkMarkdown } from './files'
import { scoreByPath } from './history'
import { liveRoots, rootIdForPath } from './roots'

/**
 * Every unchecked task in every root, for Home.
 *
 * The inspector's Todos tab reads the buffer of the one open file. That is the
 * cheap half of the question and the useless half for planning: a task in a file
 * you have not opened is exactly the task you have forgotten.
 *
 * Parsing goes through `shared/todos.ts`, the same module the panel uses. Two
 * todo parsers in one repo is the fastest way to have Home and the inspector
 * disagree about what a task is — over fenced code blocks, most likely.
 *
 * The cache is modelled on `search.ts`: per root, short-lived, and invalidated
 * by the watcher. Deliberately not a persistent index — one that can go stale is
 * a bug factory, and re-reading a few thousand files takes milliseconds.
 */

interface FileTodos {
  path: string
  name: string
  rootId: RootId | null
  hits: TodoHit[]
  tally: TodoTally
}

const cache = new Map<string, { at: number; files: FileTodos[] }>()

const CACHE_TTL_MS = 30_000

/** Enough to fill Home many times over; the point is that a runaway vault degrades. */
const DEFAULT_LIMIT = 200

/** Cheaper than parsing, and most notes are prose. */
function mightHaveTodos(content: string): boolean {
  return content.includes('- [') || content.includes('* [') || content.includes('+ [')
}

function scanFile(path: string): FileTodos | null {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return null
  }
  if (!mightHaveTodos(content)) return null

  const items = todos(content)
  if (items.length === 0) return null

  const name = basename(path)
  const rootId = rootIdForPath(path)

  return {
    path,
    name,
    rootId,
    hits: items
      .filter(item => !item.checked)
      .map(item => ({
        path,
        name,
        rootId,
        line: item.line,
        text: item.text,
        // The heading arrives as markdown; Home draws it as a label, and
        // `**bold**` in a label is the raw source leaking into the chrome.
        section: item.section ? plain(item.section.text) : null,
      })),
    tally: { total: items.length, open: items.filter(item => !item.checked).length },
  }
}

function filesForRoot(rootPath: string): FileTodos[] {
  const cached = cache.get(rootPath)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.files

  const files: FileTodos[] = []
  for (const path of walkMarkdown(rootPath)) {
    const scanned = scanFile(path)
    if (scanned) files.push(scanned)
  }
  cache.set(rootPath, { at: Date.now(), files })
  return files
}

/** Called by the watcher, with the path that changed — or nothing, to drop it all. */
export function invalidateTodosCache(path?: string) {
  if (!path) {
    cache.clear()
    return
  }
  for (const rootPath of cache.keys()) {
    if (path.startsWith(`${rootPath}/`)) cache.delete(rootPath)
  }
}

export function listTodos(params: { rootId?: RootId; limit?: number }): TodoScan {
  const limit = params.limit ?? DEFAULT_LIMIT
  const roots = liveRoots().filter(root => !params.rootId || root.id === params.rootId)

  const files: FileTodos[] = []
  for (const root of roots) files.push(...filesForRoot(root.path))

  // Ranked by the file, not by the task: the tasks inside one document belong
  // together and in the order they were written. Which document comes first is
  // the only ordering question, and frecency already answers it everywhere else
  // in the app.
  const scores = scoreByPath()
  files.sort(
    (a, b) =>
      (scores.get(b.path) ?? 0) - (scores.get(a.path) ?? 0) || a.path.localeCompare(b.path),
  )

  const items: TodoHit[] = []
  const byFile: Record<string, TodoTally> = {}
  let total = 0

  for (const file of files) {
    byFile[file.path] = file.tally
    total += file.hits.length
    for (const hit of file.hits) {
      if (items.length < limit) items.push(hit)
    }
  }

  return { items, total, truncated: total > items.length, byFile }
}
