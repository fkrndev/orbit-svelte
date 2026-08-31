import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { PathColumn, PathColumns, PathCompletion, PathEntry } from '../../shared/types'
import { normalizePathInput, splitPathInput } from '../../shared/pathInput'
import { fuzzyMatch } from '../../shared/fuzzy'
import { IGNORED_DIRS, isOpenable, toStat } from './files'

/**
 * Completing a path as it is typed, one segment at a time.
 *
 * This is what makes "open by path" faster than the file dialog rather than a
 * slower way to do the same thing: the answer to `~/project/mark` is the folder
 * listing, not an error, so the path can be walked out of a half-remembered
 * prefix instead of recalled exactly.
 *
 * Everything here reads one directory, plus one cheap `readdir` per folder it
 * offers to count the markdown inside. There is deliberately no walk and no
 * index — a completion that pauses is worse than one that shows fewer things,
 * and this stays bounded by the folder in front of you rather than by how big
 * the project happens to be. Searching *downwards* is a separate, explicit act;
 * see `searchUnder.ts`.
 */

/**
 * More than a screenful is already more than anyone reads before typing the
 * next character.
 */
const MAX_ENTRIES = 40

export function completePath(input: string, home: string): PathCompletion {
  const resolved = normalizePathInput(input, home)
  const { dir, prefix } = splitPathInput(resolved)
  const kind = pathKind(resolved)
  const listing = suggest(dir, prefix)

  return {
    resolved,
    dir,
    dirExists: isDirectory(dir),
    kind,
    // Anything else on disk is a file the app cannot render, and offering to
    // open it would end at a screenful of bytes rather than a note.
    openable: kind === 'file' && isOpenable(resolved),
    entries: listing.entries,
    hiddenCount: listing.hidden,
  }
}

/**
 * The same answer, but as the whole chain of folders leading to it — one column
 * per level, the way Finder browses.
 *
 * A single list can only ever say "here is where you are". Columns say where you
 * are *and* what was beside every choice that got you here, which is the part
 * that makes a wrong turn cheap: the sibling you actually meant is still on
 * screen, one row up in a column you never left.
 *
 * One call rather than one per column, because the chain is derived from the
 * path — asking for it piecemeal would mean the UI recomputing what the path
 * already says, four times, on every keystroke.
 */
export function pathColumns(input: string, home: string): PathColumns {
  const resolved = normalizePathInput(input, home)
  const { dir, prefix } = splitPathInput(resolved)
  const kind = pathKind(resolved)

  const columns: PathColumn[] = []
  for (const [index, folder] of chainTo(dir, home).entries()) {
    const last = folder === dir
    // Only the folder being read is filtered by what is typed, and only it pays
    // for the note counts: those are a `readdir` per row, and the columns
    // behind you are context rather than something you are searching.
    const listing = last
      ? suggest(folder, prefix)
      : suggest(folder, '', { counts: false, cap: ANCESTOR_ENTRIES })
    columns.push({
      dir: folder,
      entries: listing.entries,
      hiddenCount: last ? listing.hidden : 0,
      // Unlike the per-row counts this is paid for in every column, because it
      // is one `readdir` per level of the chain rather than one per row — and a
      // heading that says how much markdown is under it is what tells you a
      // folder is worth walking into before you walk into it.
      noteCount: countOpenable(folder),
      // Where the path continues — the row this column is being read *through*.
      selected: chainTo(dir, home)[index + 1] ?? (kind === 'file' ? resolved : null),
    })
  }

  return {
    resolved,
    dir,
    dirExists: isDirectory(dir),
    kind,
    openable: kind === 'file' && isOpenable(resolved),
    columns,
  }
}

/**
 * Home downwards, or the filesystem root for anything outside it.
 *
 * Starting at `/` for every path would spend the first two columns on `Users`
 * and your own account name, which nobody is browsing — the same reason paths
 * are written with `~`.
 */
function chainTo(dir: string, home: string): string[] {
  const base = home && (dir === home || dir.startsWith(`${home}/`)) ? home : '/'
  const chain = [base]
  if (dir === base) return chain

  const rest = dir.slice(base === '/' ? 1 : base.length + 1)
  let current = base === '/' ? '' : base
  for (const segment of rest.split('/')) {
    if (!segment) continue
    current = `${current}/${segment}`
    chain.push(current)
  }
  return chain
}

/**
 * Higher than the cap on the folder you are reading, because a column behind
 * you has to contain the row the path runs through — cutting it off would show
 * a chain that does not lead where the field says it does.
 */
const ANCESTOR_ENTRIES = 300

function suggest(
  dir: string,
  prefix: string,
  options: { counts?: boolean; cap?: number } = {},
): { entries: PathEntry[]; hidden: number } {
  let dirents
  try {
    dirents = readdirSync(dir, { withFileTypes: true })
  } catch {
    // Unreadable or not there. `dirExists` already tells the UI which, and an
    // empty list is the honest answer to both.
    return { entries: [], hidden: 0 }
  }

  const needle = prefix.toLowerCase()
  const ranked: Array<{ entry: PathEntry; tier: number; score: number }> = []
  let hidden = 0

  for (const dirent of dirents) {
    const name = dirent.name
    // Dotfiles stay out of the way until they are asked for by name — which is
    // the only way to reach `.github/CONTRIBUTING.md` at all.
    if (name.startsWith('.') && !prefix.startsWith('.')) continue

    if (!dirent.isDirectory() && !isOpenable(name)) {
      hidden += 1
      continue
    }

    const match = rank(name, needle, dirent.isDirectory())
    if (!match) continue

    const full = join(dir, name)
    if (dirent.isDirectory()) {
      // The build-output folders the rest of the app skips. Typing one out
      // still reaches it: the exclusion is about what gets *offered*.
      if (IGNORED_DIRS.has(name) && needle.length === 0) continue
      ranked.push({
        entry: { name, path: full, isDirectory: true, matched: match.matched },
        ...match,
      })
    } else {
      try {
        ranked.push({
          entry: {
            name,
            path: full,
            isDirectory: false,
            stat: toStat(full),
            matched: match.matched,
          },
          ...match,
        })
      } catch {
        // Vanished between the listing and the stat — a git checkout mid-type.
      }
    }
  }

  ranked.sort(compare)
  const entries = ranked.slice(0, options.cap ?? MAX_ENTRIES).map(item => item.entry)

  // Counted only for what survives the cap, so the cost stays tied to what is
  // on screen rather than to the size of the folder.
  if (options.counts !== false) {
    for (const entry of entries) {
      if (entry.isDirectory) entry.noteCount = countOpenable(entry.path)
    }
  }

  return { entries, hidden }
}

interface Match {
  /** Prefix matches before scattered ones, and files before folders. */
  tier: number
  score: number
  matched: number[]
}

/**
 * How well a name answers what was typed.
 *
 * Files outrank folders at equal quality, which inverts the plain listing on
 * purpose: the moment you type something you are hunting a note, and a folder
 * is only ever the road to one. With nothing typed the tiers collapse and the
 * order falls back to folders-then-files, matching the sidebar.
 */
function rank(name: string, needle: string, isDirectory: boolean): Match | null {
  if (needle.length === 0) return { tier: 0, score: 0, matched: [] }

  const lower = name.toLowerCase()
  if (lower.startsWith(needle)) {
    return {
      tier: isDirectory ? 1 : 0,
      // Shorter names win among prefix matches: `plan.md` before `plan-setting.md`.
      score: 1000 - name.length,
      matched: Array.from({ length: needle.length }, (_, i) => i),
    }
  }

  const fuzzy = fuzzyMatch(needle, name)
  if (!fuzzy.match) return null
  return {
    tier: isDirectory ? 3 : 2,
    // Same length rule as above, scaled so it only ever breaks a tie: `pln`
    // scores identically against `plan.md` and `plan-sidebar-result.md`, and
    // the one that is nearly what you typed should not lose on the alphabet.
    score: fuzzy.score * 100 - name.length,
    matched: fuzzy.matched,
  }
}

function compare(
  a: { entry: PathEntry; tier: number; score: number },
  b: { entry: PathEntry; tier: number; score: number },
): number {
  if (a.tier !== b.tier) return a.tier - b.tier
  if (a.score !== b.score) return b.score - a.score
  // Only reachable with nothing typed, where every tier and score is equal.
  if (a.entry.isDirectory !== b.entry.isDirectory) return a.entry.isDirectory ? -1 : 1
  return a.entry.name.localeCompare(b.entry.name)
}

/**
 * Markdown directly inside a folder — one level, never recursive.
 *
 * A recursive count would be the more useful number and is not worth what it
 * costs here: this runs for every row of every keystroke, and one `readdir` is
 * a syscall while a walk is a folder tree.
 */
function countOpenable(dir: string): number {
  try {
    let count = 0
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      if (!dirent.isDirectory() && isOpenable(dirent.name)) count += 1
    }
    return count
  } catch {
    return 0
  }
}

function pathKind(path: string): PathCompletion['kind'] {
  try {
    return statSync(path).isDirectory() ? 'directory' : 'file'
  } catch {
    return 'missing'
  }
}

function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  } catch {
    return false
  }
}
