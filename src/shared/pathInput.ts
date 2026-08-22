/**
 * Turning what a person typed — or pasted, or dragged in — into an absolute path.
 *
 * Shared because both sides need the same answer from the same string: the
 * webview decides whether the palette is searching names or naming a place, and
 * the Bun side resolves that place against the disk. Two implementations of
 * "does this look like a path" would disagree on exactly the inputs that matter.
 *
 * The forms handled here are the ones a path actually arrives in. Nobody types
 * a clean absolute path when they are moving between projects all day; they
 * copy it from a terminal (`~/`, backslash-escaped spaces), from Finder's
 * Copy as Pathname (quoted), or from a browser or an editor's "copy link"
 * (`file://`). Refusing those is refusing the paste that motivated the feature.
 */

/**
 * Whether the palette should switch out of name-search and into path mode.
 *
 * Deliberately narrow: only roots (`/`), home (`~`) and `file://` count. A
 * leading `./` is left out because this app has no working directory to resolve
 * it against, so it could only ever be a guess — and a query like `./` is far
 * more likely to be someone searching than someone navigating.
 */
export function looksLikePath(input: string): boolean {
  const text = unquote(input.trim())
  return text.startsWith('/') || text.startsWith('~') || /^file:\/\//i.test(text)
}

/** The absolute path a piece of typed text names, with nothing resolved on disk. */
export function normalizePathInput(input: string, home: string): string {
  let text = unquote(input.trim())

  if (/^file:\/\//i.test(text)) {
    text = text.replace(/^file:\/\/(localhost)?/i, '')
    try {
      text = decodeURIComponent(text)
    } catch {
      // A stray `%` is not a reason to refuse the rest of the path.
    }
  }

  // Shell escaping: `/Users/me/My\ Notes` is what a terminal hands you back.
  text = text.replace(/\\(.)/g, '$1')

  if (text === '~') text = home
  else if (text.startsWith('~/')) text = trimTrailingSlash(home) + text.slice(1)

  // `//` is legal on disk but never meant, and it breaks the prefix arithmetic
  // every caller here does. The trailing slash is kept — it is the difference
  // between "inside this folder" and "beside this name".
  return text.replace(/\/{2,}/g, '/')
}

/**
 * Splits an absolute path into the folder to read and the fragment to match
 * against its entries — the two halves a completion needs.
 *
 * A trailing slash is not a prefix of anything, so it means the folder itself:
 * `/a/b/` lists `b`, while `/a/b` offers whatever in `/a` starts with "b".
 */
export function splitPathInput(absolute: string): { dir: string; prefix: string } {
  if (absolute.endsWith('/')) return { dir: trimTrailingSlash(absolute) || '/', prefix: '' }
  const cut = absolute.lastIndexOf('/')
  if (cut < 0) return { dir: '/', prefix: absolute }
  return { dir: absolute.slice(0, cut) || '/', prefix: absolute.slice(cut + 1) }
}

/** The folder a file sits in. */
export function folderOf(path: string): string {
  const cut = trimTrailingSlash(path).lastIndexOf('/')
  return cut <= 0 ? '/' : path.slice(0, cut)
}

/**
 * Which registered folder already covers this path, if any.
 *
 * Longest match wins, so a nested folder beats its parent — the same rule the
 * Bun side applies in `rootIdForPath`. The webview needs its own copy because
 * it is what decides whether opening a path has anything to ask the user about,
 * and that decision happens before any round trip.
 */
export function containingRootPath(rootPaths: string[], path: string): string | null {
  let best: string | null = null
  for (const root of rootPaths) {
    const inside = path === root || path.startsWith(`${trimTrailingSlash(root)}/`)
    if (inside && (!best || root.length > best.length)) best = root
  }
  return best
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.replace(/\/+$/, '') : path
}

/** Finder's Copy as Pathname quotes anything with a space in it. */
function unquote(text: string): string {
  const quoted =
    (text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))
  return quoted && text.length >= 2 ? text.slice(1, -1) : text
}
