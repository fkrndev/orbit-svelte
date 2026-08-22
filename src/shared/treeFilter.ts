/**
 * The two rules the sidebar filter turns on, kept where both sides can run
 * them: the backend builds the result, the webview decides whether to show it.
 */

/**
 * Every folder that has to be open for these files to be visible.
 *
 * Computed from the hits rather than walked from the roots, because the filter
 * exists precisely to reach files inside folders the tree has never listed —
 * asking the tree which folders it knows about would defeat the point.
 */
export function ancestorDirs(files: string[], rootPaths: string[]): string[] {
  const dirs = new Set<string>()

  for (const file of files) {
    const root = rootPaths.find(candidate => file.startsWith(`${candidate}/`))
    if (!root) continue

    // Walk up from the file's own folder, stopping at the root, which is drawn
    // by the root row rather than as a folder inside the tree.
    let dir = parentDir(file)
    while (dir.length > root.length && dir.startsWith(`${root}/`)) {
      dirs.add(dir)
      dir = parentDir(dir)
    }
  }

  return [...dirs]
}

function parentDir(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut <= 0 ? path : path.slice(0, cut)
}

/**
 * Whether a filter response still describes what the user has typed.
 *
 * Responses are matched by query rather than trusted in arrival order: a slow
 * answer for `pl` landing after a fast one for `plan` would replace the right
 * result with a stale one, which reads as the search skipping characters.
 */
export function isStaleFilter(currentQuery: string, resultQuery: string): boolean {
  return currentQuery !== resultQuery
}
