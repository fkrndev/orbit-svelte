import { basename } from 'node:path'
import type { QuickOpenHit } from '../../shared/types'
import { fuzzyMatch } from '../../shared/fuzzy'
import { walkMarkdown } from './files'
import { rootIdForPath } from './roots'

/**
 * Searching downwards from a folder that is not a root.
 *
 * The completion in `pathComplete.ts` only ever reads the folder in front of
 * you, which is what keeps it instant — and what leaves you stuck the moment
 * you know a note's name but not which subfolder it is in. This is the way out
 * of that, and it is deliberately a separate, explicit act rather than
 * something the completion escalates to on its own: a walk is orders of
 * magnitude more work than a `readdir`, and it should happen because someone
 * asked for it.
 */

/**
 * Much tighter than the caps `quickOpen` uses over roots. That index is built
 * once and cached; this runs while someone is waiting, so it is sized to
 * "answers before you notice" rather than "eventually complete".
 */
const MAX_DEPTH = 8
const MAX_FILES = 2000

export function searchUnder(
  dir: string,
  query: string,
  limit = 40,
): { hits: QuickOpenHit[]; truncated: boolean } {
  const trimmed = query.trim()
  if (!trimmed) return { hits: [], truncated: false }

  const scored: QuickOpenHit[] = []
  let scanned = 0

  for (const path of walkMarkdown(dir, { maxDepth: MAX_DEPTH, maxFiles: MAX_FILES })) {
    scanned += 1
    const name = basename(path)

    // The filename first, because that is what people type. Falling back to the
    // part of the path below `dir` is what makes `docs plan` find
    // `docs-id/plan.md` — the folder is part of how you remember a note.
    let result = fuzzyMatch(trimmed, name)
    if (!result.match) {
      const relative = path.slice(dir.length + 1)
      const onPath = fuzzyMatch(trimmed, relative)
      if (!onPath.match) continue
      // Halved: a name match is a stronger signal than a path match, and
      // without this a deep folder full of near-misses buries the real hit.
      result = { ...onPath, score: Math.round(onPath.score / 2), matched: [] }
    }

    scored.push({
      path,
      name,
      rootId: rootIdForPath(path),
      score: result.score,
      // Indices are relative to the name, so a path match reports none rather
      // than highlighting the wrong characters.
      matched: result.matched.filter(index => index < name.length),
    })
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return { hits: scored.slice(0, limit), truncated: scanned >= MAX_FILES }
}
