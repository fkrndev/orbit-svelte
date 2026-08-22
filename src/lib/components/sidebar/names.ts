/**
 * Roots are named after their basename, so a handful of folders all called
 * `docs` render as an indistinguishable column. Keyed by path — every surface
 * that lists roots has the path on hand, not always the id.
 */
export function rootLabels(roots: readonly { path: string; name: string }[]): Map<string, string> {
  const byName = new Map<string, { path: string; name: string }[]>()
  for (const root of roots) {
    const group = byName.get(root.name)
    if (group) group.push(root)
    else byName.set(root.name, [root])
  }

  const labels = new Map<string, string>()
  for (const group of byName.values()) {
    for (const root of group) {
      labels.set(root.path, group.length < 2 ? root.name : `${root.name} — ${tail(root, group)}`)
    }
  }
  return labels
}

/** The shortest run of parent folders that tells this root apart from its namesakes. */
function tail(root: { path: string }, group: readonly { path: string }[]): string {
  const parents = root.path.split('/').filter(Boolean).slice(0, -1)
  for (let depth = 1; depth <= parents.length; depth++) {
    const candidate = parents.slice(-depth).join('/')
    const unique = group.every(
      other =>
        other.path === root.path ||
        other.path.split('/').filter(Boolean).slice(0, -1).slice(-depth).join('/') !== candidate,
    )
    if (unique) return candidate
  }
  return parents.join('/') || root.path
}

/** Markdown extensions are noise in a list where everything is markdown. */
export function displayName(pathOrName: string): string {
  const base = pathOrName.slice(pathOrName.lastIndexOf('/') + 1)
  return base.replace(/\.mdx?$/, '')
}

/**
 * The folder a file sits in, named so that it can be told apart from the other
 * folders in the same list. Most projects call their notes folder `docs`, and a
 * badge reading `docs` on every row of a mixed list says nothing — so a name
 * shared with another folder in the list grows a parent until it is unique.
 *
 * Keyed by the folder path; callers have the file path and take its parent.
 */
export function folderLabels(paths: readonly string[]): Map<string, string> {
  const dirs = new Map<string, { path: string; name: string }>()
  for (const path of paths) {
    const dir = path.slice(0, path.lastIndexOf('/'))
    if (dir && !dirs.has(dir)) dirs.set(dir, { path: dir, name: displayName(dir) })
  }
  return rootLabels([...dirs.values()])
}
