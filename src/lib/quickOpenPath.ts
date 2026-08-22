import type { PathCompletion } from '$shared/types'
import { looksLikePath, normalizePathInput } from '$shared/pathInput'
import { isMarkdownName, nameProblem } from '$shared/rename'

/**
 * What Enter should do to a typed path when the list has nothing highlighted.
 *
 * Its reason for existing is the case where the completion never arrived — an
 * RPC that failed, a main process still running last week's handlers, a folder
 * that took too long. The palette used to render "no matches" there and then
 * ignore Enter, which is the worst of both: a fully typed, perfectly valid path
 * sitting in the field, and no key that does anything with it.
 *
 * So the rule is that a typed path is always worth trying unless something
 * *known* says otherwise. Without a completion the answer is "try it, let the
 * main process say no" — it is the side that can actually check, and its error
 * reaches the user as a notice rather than as silence.
 */
export type TypedPathAction =
  | { kind: 'none' }
  /** Walk into a folder, by rewriting the field. */
  | { kind: 'descend'; query: string }
  | { kind: 'open'; path: string }

export function typedPathAction(
  query: string,
  home: string,
  completion: PathCompletion | null,
): TypedPathAction {
  if (!looksLikePath(query)) return { kind: 'none' }

  // `~` cannot be expanded before the home directory is known, and guessing
  // would send Enter to a path the user never typed.
  const needsHome = query.trim().startsWith('~') || /^file:\/\/~/i.test(query.trim())
  if (needsHome && !home) return { kind: 'none' }

  const typed = normalizePathInput(query, home)

  // A completion from a previous keystroke describes a different path, and
  // acting on it would open whatever was under the cursor two characters ago.
  const current = completion && completion.resolved === typed ? completion : null

  if (current) {
    if (current.kind === 'directory') return { kind: 'descend', query: `${current.resolved}/` }
    return current.openable ? { kind: 'open', path: current.resolved } : { kind: 'none' }
  }

  // Blind, and deliberately conservative about it: a trailing slash or a bare
  // home directory is someone mid-path, not someone naming a file.
  if (typed.endsWith('/') || typed === home || typed === '/') return { kind: 'none' }
  return { kind: 'open', path: typed }
}

/**
 * Whether the palette is still at the starting line — a path that names no
 * folder yet, so there is nothing to list and everything to suggest.
 *
 * This is what decides between showing the contents of the home directory
 * (forty folders nobody asked for) and showing where you have actually been.
 */
export function isPathStart(query: string, home: string): boolean {
  if (!looksLikePath(query)) return false
  const typed = normalizePathInput(query, home)
  return typed === '/' || typed === home || typed === `${home}/`
}

/**
 * The query one level up, for `←` and Backspace.
 *
 * Returns `null` at the top rather than looping or clearing the field — running
 * out of parents is a real edge and silently doing nothing is the right answer
 * to it. Always ends in a slash: going up means looking *inside* the parent,
 * not editing the name of the folder you left.
 */
export function parentQuery(query: string, home: string): string | null {
  if (!looksLikePath(query)) return null
  const typed = normalizePathInput(query, home)
  const trimmed = typed.endsWith('/') ? typed.slice(0, -1) : typed
  const cut = trimmed.lastIndexOf('/')
  if (cut < 0 || trimmed === '') return null
  return `${trimmed.slice(0, cut) || '/'}${cut === 0 ? '' : '/'}`
}

/**
 * The folder the browser is sitting in, taken from the path it remembers.
 *
 * The stored value always ends in a slash — it is a query, not a path — and the
 * difference matters to anything that writes there: `/Users/me/notes/` and
 * `/Users/me/notes` name the same folder, but only one of them is what
 * `createFile` expects to be handed. `null` when nowhere has been browsed yet,
 * so the caller falls back rather than writing to the root of the disk.
 */
export function browsedDir(browsePath: string): string | null {
  const trimmed = browsePath.trim()
  if (!trimmed.startsWith('/')) return null
  const withoutSlash = trimmed.replace(/\/+$/, '')
  return withoutSlash || '/'
}

/** The default name for the file the button is about to create. */
export const UNTITLED_NOTE = 'untitled.md'

/**
 * What "New note" should call the file, given what is in the field.
 *
 * The half-typed name at the end of the path is the strongest statement of
 * intent the page has: someone who typed `.../meetings/standup` and found
 * nothing was naming a note, not filtering for one. So that fragment becomes
 * the filename — which is also what makes the button an answer to the empty
 * column rather than a second way to reach `untitled.md`.
 *
 * Anything the rename rules would reject falls back to the default instead of
 * being cleaned up. A name silently rewritten is worse than an obvious one:
 * `untitled.md` is visibly not what you typed, and the rename field is right
 * there.
 */
export function newNoteName(needle: string): string {
  const name = needle.trim()
  if (!name || nameProblem(name)) return UNTITLED_NOTE
  return isMarkdownName(name) ? name : `${name}.md`
}

/**
 * An absolute path written the short way. `~` is not decoration: it is the
 * difference between a breadcrumb that fits and one that truncates before it
 * reaches the part you needed to read.
 */
export function displayPath(absolute: string, home: string): string {
  if (!home) return absolute
  if (absolute === home) return '~'
  return absolute.startsWith(`${home}/`) ? `~${absolute.slice(home.length)}` : absolute
}

/**
 * The line under the field when there is nothing to list. It is the only place
 * a failed completion can announce itself, so it says what went wrong *and*
 * what still works.
 */
export function pathEmptyMessage(completion: PathCompletion | null, failed: boolean): string {
  if (failed) return 'Could not read that folder — press Enter to open the path anyway'
  if (!completion) return 'Type a path, or press Enter to open it'
  if (!completion.dirExists) return 'That folder does not exist'
  if (completion.kind === 'file') {
    return completion.openable ? 'Press Enter to open this file' : 'Not a markdown file'
  }
  if (completion.kind === 'missing') return 'Nothing at that path'
  if (completion.hiddenCount > 0) {
    return `Nothing matches — ${completion.hiddenCount} non-markdown ${
      completion.hiddenCount === 1 ? 'file' : 'files'
    } here are not shown`
  }
  return 'No markdown files or folders match'
}
