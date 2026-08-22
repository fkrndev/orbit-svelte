/**
 * Turning a name the user typed into a destination path.
 *
 * Lives in `shared/` because both sides need it: the dialog validates as you
 * type, and the handler validates again before touching the disk. One set of
 * rules, so the two can never disagree about what a legal name is.
 *
 * Paths are treated as POSIX — this app targets macOS, and the rest of the
 * webview already slices paths on `/`.
 */

export const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx'])

/**
 * Anything that would make the name unusable, or turn a rename into a move.
 * The separators are the important ones: `../notes` must be rejected, not
 * quietly relocate the file out of the folder the user was looking at.
 */
const ILLEGAL_CHARS = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']

export type RenamePlan =
  | { kind: 'ok'; nextPath: string }
  /** The name resolves to where the file already is; the caller should do nothing. */
  | { kind: 'unchanged' }
  | { kind: 'invalid'; reason: string }

export function planRename(path: string, rawName: string): RenamePlan {
  const name = rawName.trim()
  const problem = nameProblem(name)
  if (problem) return { kind: 'invalid', reason: problem }

  const nextName = withExtensionOf(name, path)
  if (nextName === basename(path)) return { kind: 'unchanged' }
  return { kind: 'ok', nextPath: `${dirname(path)}/${nextName}` }
}

/**
 * Renaming a folder, also always in place.
 *
 * A separate function rather than a flag on `planRename`, because the two
 * disagree about the rule that matters most here: a file gets a markdown
 * extension attached, and a folder must never have one bolted on.
 */
export function planFolderRename(path: string, rawName: string): RenamePlan {
  const name = rawName.trim()
  const problem = nameProblem(name)
  if (problem) return { kind: 'invalid', reason: problem }

  // The folder equivalent of dropping the extension. Every walk and directory
  // listing skips dot-directories, so `.archive` would take the folder and
  // everything inside it out of the sidebar, out of quick-open, and out of
  // search — with no visible cause and no obvious way back.
  if (name.startsWith('.')) {
    return { kind: 'invalid', reason: 'A folder starting with "." is hidden from the sidebar' }
  }

  if (name === basename(path)) return { kind: 'unchanged' }
  return { kind: 'ok', nextPath: `${dirname(path)}/${name}` }
}

/**
 * What is wrong with this name, if anything. Shared so files and folders agree
 * — and exported so a caller that *invents* a name can check it by the same
 * rules the dialogs do, instead of writing a second, looser set.
 */
export function nameProblem(name: string): string | null {
  if (!name) return 'Name cannot be empty'
  if (name === '.' || name === '..') return `"${name}" is not a name`
  const illegal = ILLEGAL_CHARS.find(char => name.includes(char))
  return illegal ? `A name cannot contain ${illegal}` : null
}

/**
 * Where `path` ends up when the folder `from` is renamed to `to` — the folder
 * itself included. `null` when `path` is outside the move.
 *
 * Every store that keys on a path needs this exact question answered the same
 * way, and the failure it prevents is silent: a record left behind at a path
 * nothing will look up again reads as lost metadata, not as a bug.
 */
export function retargetUnder(path: string, from: string, to: string): string | null {
  if (from === to) return null
  if (path === from) return to
  if (path.startsWith(`${from}/`)) return to + path.slice(from.length)
  return null
}

/**
 * Typing `meeting notes` must not produce an extensionless file: every walk and
 * directory listing filters on the markdown extensions, so the file would
 * disappear from the sidebar and from quick-open the moment it was renamed.
 *
 * The *original* extension is reused rather than a hardcoded `.md`, so renaming
 * a `.mdx` file does not silently convert it into something else.
 */
function withExtensionOf(name: string, path: string): string {
  if (isMarkdownName(name)) return name
  const original = extension(basename(path))
  return MARKDOWN_EXTENSIONS.has(original) ? `${name}${original}` : `${name}.md`
}

/** The editable part of a filename — what the rename field should open with. */
export function nameWithoutExtension(path: string): string {
  const name = basename(path)
  const ext = extension(name)
  return MARKDOWN_EXTENSIONS.has(ext) ? name.slice(0, -ext.length) : name
}

export function isMarkdownName(name: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extension(name))
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function dirname(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut <= 0 ? '/' : path.slice(0, cut)
}

/** Lowercased, including the dot. Empty when there is none — a leading dot does not count. */
function extension(name: string): string {
  const cut = name.lastIndexOf('.')
  return cut <= 0 ? '' : name.slice(cut).toLowerCase()
}
