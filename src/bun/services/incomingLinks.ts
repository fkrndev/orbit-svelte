import { readFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import type { IncomingLink, IncomingLinkScan } from '../../shared/types'
import { linksToFile } from '../../shared/links'
import { walkMarkdown } from './files'
import { liveRoots } from './roots'

/**
 * Which open files link to this one.
 *
 * Deliberately **not** an index. A backlink panel backed by one would have to be
 * maintained on every write, and — worse — it would answer with an empty list
 * whether nothing links here or the linking folder simply is not open. People
 * read a persistent empty panel as proof; they read a search result as a search
 * result. Making this an explicit act, run when asked, is what keeps the answer
 * from claiming more than it knows.
 *
 * That is also why there is no cache: it runs while someone waits, once, and a
 * result that can go stale is worth less than the milliseconds it saves.
 */

/**
 * Sized like `searchUnder`, for the same reason: this runs while someone is
 * waiting rather than in the background, so it is bounded to "answers before
 * you notice" and reports the cap instead of hiding it.
 */
const MAX_FILES = 4000
const DEFAULT_LIMIT = 60

export function findIncomingLinks(targetPath: string, limit = DEFAULT_LIMIT): IncomingLinkScan {
  const name = basename(targetPath)
  // A link may have been written with the name percent-encoded, which is what
  // a space becomes. Both spellings have to pass the cheap gate below.
  const encoded = encodeURIComponent(name)

  const hits: IncomingLink[] = []
  const seen = new Set<string>()
  let scanned = 0
  let truncated = false

  for (const root of liveRoots()) {
    for (const path of walkMarkdown(root.path, { maxFiles: MAX_FILES })) {
      // Roots may nest, so the same file can be reached twice.
      if (path === targetPath || seen.has(path)) continue
      seen.add(path)

      if (scanned >= MAX_FILES) {
        truncated = true
        break
      }
      scanned += 1

      const hit = scanFile(path, targetPath, name, encoded)
      if (!hit) continue

      hits.push(hit)
      if (hits.length >= limit) {
        truncated = true
        break
      }
    }
    if (truncated) break
  }

  // Shallowest path first, then alphabetical: a stable order that puts the
  // files nearest the top of a folder — usually the index-ish ones — first.
  hits.sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))

  return { hits, scanned, truncated }
}

/**
 * One entry per file rather than per link. The question is "which files refer to
 * this", and a note that links the same target six times would otherwise fill
 * the answer on its own — so the count comes back as a number instead.
 */
function scanFile(
  path: string,
  targetPath: string,
  name: string,
  encoded: string,
): IncomingLink | null {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return null
  }

  // Parsing every link in every file is the expensive half. A file that never
  // mentions the name cannot resolve to it, and this rejects almost all of them
  // for the cost of a substring search.
  if (!content.includes(name) && !content.includes(encoded)) return null

  const refs = linksToFile(content, path, targetPath)
  const first = refs[0]
  if (!first) return null

  return {
    path,
    name: basename(path),
    folder: basename(dirname(path)),
    line: first.line,
    excerpt: first.text.trim().slice(0, 200),
    count: refs.length,
  }
}

function depth(path: string): number {
  return path.split('/').length
}
