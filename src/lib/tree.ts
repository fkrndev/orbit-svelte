/**
 * Which folders are open in the sidebar tree.
 *
 * Pure and store-free, in the same spirit as `navHistory.ts`: every operation
 * takes a state and returns a new one, so expand-all, reveal, and the filter's
 * temporary expansion can all be tested without mounting a component.
 *
 * This used to be a `useState` inside `DirNode`, which had two consequences.
 * Nothing outside the node could open it — ruling out expand-all, collapse-all,
 * and revealing the active file — and closing a parent unmounted its children,
 * so their state was thrown away. Reopening a folder found everything below it
 * collapsed again, which read as a bug long before any of this was a feature.
 */

export interface TreeState {
  /** Absolute paths of the folders currently open. */
  readonly expanded: ReadonlySet<string>
}

export const EMPTY_TREE: TreeState = { expanded: new Set() }

/**
 * How many open folders survive a restart.
 *
 * `expandedPaths` rides along in `settings.json`, which is read whole at boot
 * and written whole on every change. A tree someone expanded across a large
 * monorepo would otherwise turn a preferences file into a path dump.
 */
export const MAX_EXPANDED = 500

export function isExpanded(state: TreeState, path: string): boolean {
  return state.expanded.has(path)
}

export function expand(state: TreeState, path: string): TreeState {
  if (state.expanded.has(path)) return state
  const next = new Set(state.expanded)
  next.add(path)
  return { expanded: next }
}

export function collapse(state: TreeState, path: string): TreeState {
  if (!state.expanded.has(path)) return state
  const next = new Set(state.expanded)
  next.delete(path)
  return { expanded: next }
}

export function toggle(state: TreeState, path: string): TreeState {
  return state.expanded.has(path) ? collapse(state, path) : expand(state, path)
}

export function expandMany(state: TreeState, paths: Iterable<string>): TreeState {
  const next = new Set(state.expanded)
  let added = false
  for (const path of paths) {
    if (next.has(path)) continue
    next.add(path)
    added = true
  }
  return added ? { expanded: next } : state
}

/**
 * Closes everything inside one root, and the root itself is the caller's
 * business — roots carry their own `collapsed` flag in `roots.json`.
 *
 * Scoped rather than global because "collapse all" while six projects are open
 * should not close the five you were not looking at.
 */
export function collapseUnder(state: TreeState, rootPath: string): TreeState {
  const next = new Set<string>()
  for (const path of state.expanded) {
    if (!isUnder(path, rootPath)) next.add(path)
  }
  return next.size === state.expanded.size ? state : { expanded: next }
}

export function collapseAll(): TreeState {
  return EMPTY_TREE
}

/** `child` sits inside `parent` — not equal to it, and not merely prefixed by it. */
export function isUnder(child: string, parent: string): boolean {
  return child.startsWith(`${parent}/`)
}

/**
 * Every folder between `rootPath` and `path`, outermost first.
 *
 * `path` itself is never included: revealing a file means opening the folders
 * that contain it, and revealing a folder should not force it open.
 */
export function ancestorsWithin(rootPath: string, path: string): string[] {
  if (!isUnder(path, rootPath)) return []
  const rest = path.slice(rootPath.length + 1).split('/')
  const out: string[] = []
  let current = rootPath
  // The last segment is the target itself.
  for (const segment of rest.slice(0, -1)) {
    current = `${current}/${segment}`
    out.push(current)
  }
  return out
}

/** Opens the folders that make `path` visible. */
export function reveal(state: TreeState, rootPath: string, path: string): TreeState {
  return expandMany(state, ancestorsWithin(rootPath, path))
}

/**
 * Rewrites open paths after a folder moved.
 *
 * Without this, renaming a folder leaves its whole subtree recorded under a
 * path that no longer exists — the entries never match anything again, and they
 * sit in `settings.json` forever because nothing ever collapses them.
 */
export function movePrefix(state: TreeState, from: string, to: string): TreeState {
  if (from === to) return state
  let changed = false
  const next = new Set<string>()
  for (const path of state.expanded) {
    if (path === from) {
      next.add(to)
      changed = true
    } else if (isUnder(path, from)) {
      next.add(to + path.slice(from.length))
      changed = true
    } else {
      next.add(path)
    }
  }
  return changed ? { expanded: next } : state
}

/**
 * Drops open paths that are no longer inside any known root.
 *
 * Run at boot. Removing a root, or renaming a folder while the app was closed,
 * otherwise leaves entries that can never be reached and never be cleaned up.
 */
export function pruneToRoots(state: TreeState, rootPaths: string[]): TreeState {
  const next = new Set<string>()
  for (const path of state.expanded) {
    if (rootPaths.some(root => isUnder(path, root))) next.add(path)
  }
  return next.size === state.expanded.size ? state : { expanded: next }
}

/** For `settings.json`. Sorted so an unchanged tree produces an unchanged file. */
export function serializeExpanded(state: TreeState, limit = MAX_EXPANDED): string[] {
  return [...state.expanded].sort().slice(0, limit)
}

export function hydrateExpanded(paths: string[] | undefined): TreeState {
  if (!paths || paths.length === 0) return EMPTY_TREE
  return { expanded: new Set(paths.slice(0, MAX_EXPANDED)) }
}
