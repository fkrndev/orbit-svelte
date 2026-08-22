import { basename } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import type {
  Dashboard,
  DashboardItem,
  HistoryEvent,
  HistoryEventType,
  RecentFolder,
  RecentItem,
  RecentSort,
} from '../../shared/types'
import { JsonStore, registerStore } from './jsonStore'
import { STORE_FILES } from '../paths'
import { allMeta, ensureMeta } from './meta'
import { getRoot } from './roots'
import { scoreEvents } from './frecency'
import { readHead } from './files'
import { compareRecents, foldersOf } from '../../shared/recents'
import { excerptFromMarkdown } from '../../shared/excerpt'

interface HistoryFile {
  version: 1
  events: HistoryEvent[]
}

/**
 * Hard cap on stored events. At ~120 bytes per event this keeps the file around
 * 2.5MB worst case, which still parses instantly at boot.
 */
const MAX_EVENTS = 20_000

const store = registerStore(
  new JsonStore<HistoryFile>(STORE_FILES.history, () => ({ version: 1, events: [] })),
)

// Trim once at boot rather than on every append.
store.update(draft => {
  if (draft.events.length > MAX_EVENTS) {
    draft.events = draft.events.slice(-MAX_EVENTS)
  }
})

/**
 * Consecutive `open` events for the same file within this window collapse into
 * one. Tab switching would otherwise flood the log and distort the ranking.
 */
const OPEN_DEDUPE_MS = 30_000

export function recordEvent(
  path: string,
  type: HistoryEventType,
  extra: { dwellMs?: number; from?: string } = {},
) {
  const meta = ensureMeta(path)
  const now = Date.now()

  if (type === 'open') {
    const last = findLastEvent(meta.id, 'open')
    if (last && now - last.at < OPEN_DEDUPE_MS) return
  }

  store.update(draft => {
    draft.events.push({ fileId: meta.id, type, at: now, ...extra })
    if (draft.events.length > MAX_EVENTS + 500) {
      draft.events = draft.events.slice(-MAX_EVENTS)
    }
  })
  invalidateDashboard()
}

function findLastEvent(fileId: string, type: HistoryEventType): HistoryEvent | undefined {
  const events = store.get().events
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!
    if (event.fileId === fileId && event.type === type) return event
  }
  return undefined
}

// ---- ranking ---------------------------------------------------------------

/**
 * A dashboard item plus the one fact the dashboard does not need: whether this
 * file has any recorded activity at all.
 *
 * `lastOpenedAt` falls back to `meta.updatedAt` so the dashboard can sort every
 * file it knows about. Recents must not inherit that — a file that was tagged
 * but never opened would appear in a list of files you have opened.
 */
interface RankedItem extends DashboardItem {
  hasActivity: boolean
}

let cache: { at: number; items: RankedItem[] } | null = null
const CACHE_TTL_MS = 60_000

function invalidateDashboard() {
  cache = null
}

/**
 * Scores every known file once, for both the dashboard and the Recents panel.
 *
 * Two call sites computing frecency separately would drift apart eventually,
 * and on the day they disagreed nobody would be able to say which was right.
 */
function rankedItems(): RankedItem[] {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items

  const now = Date.now()
  const stats = scoreEvents(store.get().events, now)
  const items: RankedItem[] = []

  for (const meta of allMeta()) {
    // A file that no longer exists is noise on a dashboard, not a shortcut.
    if (!existsSync(meta.path)) continue
    const stat = stats.get(meta.id)
    items.push({
      meta,
      score: stat?.score ?? 0,
      lastOpenedAt: stat?.lastOpenedAt ?? meta.updatedAt,
      lastEditedAt: stat?.lastEditedAt ?? null,
      openCount: stat?.openCount ?? 0,
      editCount: stat?.editCount ?? 0,
      hasActivity: stat !== undefined,
    })
  }

  cache = { at: now, items }
  return items
}

// ---- recents ---------------------------------------------------------------

/**
 * Enough bytes to clear a frontmatter block and still reach the prose under it.
 * A file whose YAML is longer than this previews as empty, which is the right
 * failure: the alternative is reading whole documents to fill three clipped
 * lines.
 */
const EXCERPT_BYTES = 8192

/**
 * Excerpts, keyed by path and invalidated by mtime.
 *
 * The panel reloads on every open, every metadata write, and every watcher
 * event, so without this the list would re-read eighty files each time the user
 * clicks a row. Bounded by the number of files that have ever been listed,
 * which is the recents limit — this map does not grow with the vault.
 */
const excerpts = new Map<string, { mtimeMs: number; text: string }>()

function excerptFor(path: string): string {
  let mtimeMs: number
  try {
    mtimeMs = statSync(path).mtimeMs
  } catch {
    return ''
  }

  const cached = excerpts.get(path)
  if (cached && cached.mtimeMs === mtimeMs) return cached.text

  const head = readHead(path, EXCERPT_BYTES)
  const text = head === null ? '' : excerptFromMarkdown(head)
  excerpts.set(path, { mtimeMs, text })
  return text
}

export function listRecents(
  sort: RecentSort = 'recent',
  limit = 60,
  withExcerpt = false,
): RecentItem[] {
  return rankedItems()
    .filter(item => item.hasActivity)
    .sort(compareRecents(sort))
    .slice(0, limit)
    .map(item => ({
      path: item.meta.path,
      name: basename(item.meta.path),
      rootId: item.meta.rootId,
      lastOpenedAt: item.lastOpenedAt,
      lastEditedAt: item.lastEditedAt,
      openCount: item.openCount,
      editCount: item.editCount,
      score: item.score,
      pinned: item.meta.pinned,
      labels: item.meta.labels,
      ...(item.meta.icon ? { icon: item.meta.icon } : {}),
      ...(item.meta.color ? { color: item.meta.color } : {}),
      ...(withExcerpt ? { excerpt: excerptFor(item.meta.path) } : {}),
    }))
}

/**
 * The folders your notes actually live in, ranked the way Recents ranks files.
 *
 * This is what the path palette opens on. Typing `~/project/whatever/` from
 * memory every time is the slow part of opening a file by path, and the app has
 * known the answer all along — it just never offered it.
 *
 * No existence check of its own: `rankedItems` already drops files that are
 * gone, and a folder derived from a file that exists exists too.
 */
export function listRecentFolders(limit = 8): RecentFolder[] {
  const opened = rankedItems()
    .filter(item => item.hasActivity)
    .map(item => ({
      path: item.meta.path,
      score: item.score,
      lastOpenedAt: item.lastOpenedAt,
    }))

  return foldersOf(opened, limit).map(folder => ({
    ...folder,
    name: basename(folder.path) || folder.path,
  }))
}

/** The cached, mtime-keyed excerpt, for anything that wants a taste of a file. */
export function fileExcerpt(path: string): string {
  return excerptFor(path)
}

/**
 * Frecency keyed by path, for callers that hold paths rather than file records.
 *
 * The todo scan walks the disk, so all it has is paths — and it needs the same
 * ranking the dashboard and Recents use rather than a second opinion about
 * which file matters. Reads the same cached ranking they do.
 */
export function scoreByPath(): Map<string, number> {
  const scores = new Map<string, number>()
  for (const item of rankedItems()) scores.set(item.meta.path, item.score)
  return scores
}

// ---- dashboard -----------------------------------------------------------

export function getDashboard(limit = 12): Dashboard {
  return buildDashboard(limit)
}

/** `hasActivity` is internal bookkeeping; it has no business crossing the RPC. */
function toDashboardItem({ hasActivity: _internal, ...item }: RankedItem): DashboardItem {
  return item
}

function buildDashboard(limit: number): Dashboard {
  const items = rankedItems()

  const pinned = items
    .filter(item => item.meta.pinned)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .map(toDashboardItem)

  const frequent = items
    .filter(item => !item.meta.pinned && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(toDashboardItem)

  const recentlyEdited = items
    .filter(item => item.lastEditedAt !== null)
    .sort((a, b) => (b.lastEditedAt ?? 0) - (a.lastEditedAt ?? 0))
    .slice(0, limit)
    .map(toDashboardItem)

  return {
    pinned,
    frequent,
    recentlyEdited,
    rootCounts: countBy(items, item => (item.meta.rootId ? [item.meta.rootId] : []))
      .map(([rootId, count]) => ({ rootId, name: getRoot(rootId)?.name ?? 'unknown', count })),
  }
}

function countBy(items: DashboardItem[], pick: (item: DashboardItem) => string[]): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const key of pick(item)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
