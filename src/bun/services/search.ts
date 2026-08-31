import { existsSync } from 'node:fs'
import { basename, relative } from 'node:path'
import type { QuickOpenHit, TreeFilterResult } from '../../shared/types'
import { fuzzyMatch, matchTier } from '../../shared/fuzzy'
import { ancestorDirs } from '../../shared/treeFilter'
import { parseRefQuery } from '../../shared/home'
import type { InlineRefKind } from '../../shared/inlineRefs'
import { metaByPath } from './meta'
import { hitsForRef } from './tagIndex'
import { liveRoots } from './roots'
import { isOpenable, walkDirs, walkMarkdown } from './files'

/**
 * A path list per root, rebuilt lazily.
 *
 * Deliberately not a persistent index: rebuilding is fast enough for the scale
 * this app targets (a few thousand markdown files), and an index that can go
 * stale is a bug factory. The watcher invalidates entries as files come and go.
 */
const cache = new Map<string, { at: number; paths: string[] }>()
const CACHE_TTL_MS = 30_000

function pathsForRoot(rootPath: string): string[] {
  const cached = cache.get(rootPath)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.paths
  const paths = [...walkMarkdown(rootPath, { accept: isOpenable })]
  cache.set(rootPath, { at: Date.now(), paths })
  return paths
}

export function invalidateSearchCache(path?: string) {
  if (!path) {
    cache.clear()
    return
  }
  for (const rootPath of cache.keys()) {
    if (path.startsWith(`${rootPath}/`)) cache.delete(rootPath)
  }
}

interface IndexedPath {
  path: string
  rootId: string | null
  rootPath: string
}

function allPaths(): IndexedPath[] {
  const out: IndexedPath[] = []
  for (const root of liveRoots()) {
    for (const path of pathsForRoot(root.path)) {
      out.push({ path, rootId: root.id, rootPath: root.path })
    }
  }
  return out
}

/**
 * Files carrying one tag or mention (`tagIndex.ts`).
 *
 * Matched case-insensitively, because nothing anywhere else in the app treats
 * `#Draft` and `#draft` as two tags. The index has already ranked them, so this
 * takes the order it is given rather than sorting again.
 */
function refHits(kind: InlineRefKind, label: string, limit: number): QuickOpenHit[] {
  return hitsForRef(kind, label, limit).map(hit => ({
    path: hit.path,
    name: hit.name,
    rootId: hit.rootId ?? metaByPath(hit.path)?.rootId ?? null,
    score: 0,
    // Nothing in the *name* matched — the tag did — so highlighting any of it
    // would be pointing at the wrong reason.
    matched: [],
  }))
}

export function quickOpen(query: string, limit = 40): QuickOpenHit[] {
  const ref = parseRefQuery(query)
  if (ref) return refHits(ref.kind, ref.label, limit)

  const trimmed = query.trim()
  const candidates = allPaths()

  if (!trimmed) {
    return candidates.slice(0, limit).map(entry => ({
      path: entry.path,
      name: basename(entry.path),
      rootId: entry.rootId,
      score: 0,
      matched: [],
    }))
  }

  const scored: Array<QuickOpenHit & { tier: number }> = []

  for (const entry of candidates) {
    const name = basename(entry.path)
    // Try the filename first — that is what the user is usually typing. Fall
    // back to the root-relative path so `docs/plan` style queries also work.
    const nameResult = fuzzyMatch(trimmed, name)
    if (nameResult.match) {
      scored.push({
        path: entry.path,
        name,
        rootId: entry.rootId,
        score: nameResult.score + 20,
        matched: nameResult.matched,
        tier: matchTier(trimmed, name),
      })
      continue
    }

    const rel = relative(entry.rootPath, entry.path)
    const pathResult = fuzzyMatch(trimmed, rel)
    if (pathResult.match) {
      scored.push({
        path: entry.path,
        name,
        rootId: entry.rootId,
        score: pathResult.score,
        matched: [],
        tier: 4,
      })
    }
  }

  scored.sort((a, b) => a.tier - b.tier || b.score - a.score || a.name.localeCompare(b.name))
  return scored.slice(0, limit).map(({ tier: _tier, ...hit }) => hit)
}

/**
 * Name filter for the sidebar tree.
 *
 * Shares the matcher and the path cache with `quickOpen` — the two answer
 * different questions (jump somewhere vs. look at something in place) but they
 * must never disagree about what counts as a match.
 *
 * Also returns the folders that have to be open for the hits to be visible.
 * Working that out here rather than in the webview is what lets the filter
 * reach files inside folders the tree has never listed.
 */
export function filterTree(query: string, limit = 200): TreeFilterResult {
  const trimmed = query.trim()
  if (!trimmed) return { query, files: [], dirs: [], truncated: false }

  const hits = quickOpen(trimmed, limit + 1)
  const truncated = hits.length > limit
  const files = hits.slice(0, limit).map(hit => hit.path)
  const dirs = ancestorDirs(files, liveRoots().map(root => root.path))

  return { query, files, dirs, truncated }
}

/** Every folder under one root, for Expand All. */
export function listTreeDirs(rootPath: string, max = 2000): { dirs: string[]; truncated: boolean } {
  return walkDirs(rootPath, { max })
}
