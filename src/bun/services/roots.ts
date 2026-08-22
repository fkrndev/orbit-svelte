import { basename } from 'node:path'
import { existsSync } from 'node:fs'
import type { Root, RootId } from '../../shared/types'
import { JsonStore, registerStore } from './jsonStore'
import { STORE_FILES } from '../paths'
import { newId } from './ids'
import { retargetUnder } from '../../shared/rename'

interface RootsFile {
  version: 1
  roots: Root[]
}

const store = registerStore(
  new JsonStore<RootsFile>(STORE_FILES.roots, () => ({ version: 1, roots: [] })),
)

/**
 * Pinned roots first, then most recently opened.
 *
 * Recency alone has a quiet failure: the folder you keep for reference sinks
 * further the less you open it, which is the opposite of what "keep this
 * reachable" should mean.
 */
export function listRoots(): Root[] {
  return [...store.get().roots].sort((a, b) => {
    const pinned = Number(b.pinned ?? false) - Number(a.pinned ?? false)
    return pinned !== 0 ? pinned : b.lastOpenedAt - a.lastOpenedAt
  })
}

/**
 * Idempotent: opening a folder you already know about just bumps its
 * `lastOpenedAt`. A "root" is a bookmark, not a workspace you have to leave.
 */
export function addRoot(path: string): Root {
  const now = Date.now()
  const existing = store.get().roots.find(r => r.path === path)
  if (existing) {
    store.update(draft => {
      const target = draft.roots.find(r => r.id === existing.id)
      if (target) target.lastOpenedAt = now
    })
    return { ...existing, lastOpenedAt: now }
  }

  const root: Root = {
    id: newId('r'),
    path,
    name: basename(path) || path,
    addedAt: now,
    lastOpenedAt: now,
    collapsed: false,
  }
  store.update(draft => {
    draft.roots.push(root)
  })
  return root
}

export function removeRoot(id: RootId) {
  store.update(draft => {
    draft.roots = draft.roots.filter(r => r.id !== id)
  })
}

export function setRootCollapsed(id: RootId, collapsed: boolean) {
  store.update(draft => {
    const target = draft.roots.find(r => r.id === id)
    if (target) target.collapsed = collapsed
  })
}

export function setRootPinned(id: RootId, pinned: boolean): Root[] {
  store.update(draft => {
    const target = draft.roots.find(r => r.id === id)
    if (target) target.pinned = pinned
  })
  return listRoots()
}

/**
 * Follows a folder that moved.
 *
 * A root whose folder was renamed and *not* updated here is the worst outcome
 * of the whole operation: it points at nothing, so `liveRoots` drops it, the
 * sidebar loses the folder entirely, and every file inside it silently reports
 * `rootId: null`. Nested roots move too — renaming a parent relocates them just
 * as much as renaming them directly.
 *
 * The displayed name follows only for the folder that was actually renamed. A
 * nested root keeps its own basename, which has not changed.
 */
export function trackRootMove(from: string, to: string) {
  store.update(draft => {
    for (const root of draft.roots) {
      const next = retargetUnder(root.path, from, to)
      if (!next) continue
      root.path = next
      if (root.path === to) root.name = basename(to) || to
    }
  })
}

/**
 * Which known root contains this file, if any. Longest match wins so a nested
 * root beats its parent.
 */
export function rootIdForPath(path: string): RootId | null {
  let best: Root | null = null
  for (const root of store.get().roots) {
    if (path === root.path || path.startsWith(`${root.path}/`)) {
      if (!best || root.path.length > best.path.length) best = root
    }
  }
  return best?.id ?? null
}

export function getRoot(id: RootId): Root | undefined {
  return store.get().roots.find(r => r.id === id)
}

/** Roots whose folder still exists — used before any disk walk. */
export function liveRoots(): Root[] {
  return listRoots().filter(root => existsSync(root.path))
}
