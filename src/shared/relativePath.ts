/**
 * The path to write in a link, from one note to another.
 *
 * Relative, always. This app has no vault root to resolve an absolute path
 * against, and an absolute one breaks the moment the folder moves or is opened
 * on another machine. A relative link is also the one every other markdown
 * tool already follows.
 *
 * POSIX-only by design: it produces text for a markdown document, not a path
 * for the filesystem, and `/` is what markdown links use everywhere.
 */
export function relativePathBetween(fromFile: string, toFile: string): string {
  const from = fromFile.split('/').slice(0, -1)
  const to = toFile.split('/')
  const name = to.pop() ?? ''

  let shared = 0
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared += 1

  const up = Array<string>(from.length - shared).fill('..')
  const down = to.slice(shared)
  const parts = [...up, ...down, name]

  // A sibling is `./name`, not a bare `name`: without the prefix a link to
  // `assets.md` is ambiguous with a URL scheme in some renderers.
  return up.length === 0 && down.length === 0 ? `./${name}` : parts.join('/')
}
