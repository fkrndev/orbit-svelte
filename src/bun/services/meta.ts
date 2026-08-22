import { existsSync } from 'node:fs'
import type { FileId, FileMeta, LabelDef } from '../../shared/types'
import { JsonStore, registerStore } from './jsonStore'
import { STORE_FILES } from '../paths'
import { newId } from './ids'
import { fingerprint } from './files'
import { rootIdForPath } from './roots'
import { findRepairTarget, hasUserData, type RepairCandidate } from './metaRepair'
import { retargetUnder } from '../../shared/rename'

interface FilesStore {
  version: 1
  files: Record<FileId, FileMeta>
  byPath: Record<string, FileId>
  labelDefs: Record<string, LabelDef>
}

const DEFAULT_LABELS: Record<string, LabelDef> = {
  draft: { name: 'draft', color: '#f0a35e', order: 0 },
  active: { name: 'active', color: '#5eb0f0', order: 1 },
  done: { name: 'done', color: '#63c98a', order: 2 },
  reference: { name: 'reference', color: '#a98ef0', order: 3 },
}

const store = registerStore(
  new JsonStore<FilesStore>(STORE_FILES.files, () => ({
    version: 1,
    files: {},
    byPath: {},
    labelDefs: { ...DEFAULT_LABELS },
  })),
)

/** `byPath` is a derived index; rebuild it if it ever drifts from `files`. */
function reindex(draft: FilesStore) {
  draft.byPath = {}
  for (const meta of Object.values(draft.files)) {
    draft.byPath[meta.path] = meta.id
  }
}

function blankMeta(path: string): FileMeta {
  const now = Date.now()
  return {
    id: newId('f'),
    path,
    rootId: rootIdForPath(path),
    labels: [],
    tags: [],
    note: '',
    pinned: false,
    createdAt: now,
    updatedAt: now,
    fingerprint: fingerprint(path),
  }
}

/**
 * The single entry point for "give me the record for this path".
 *
 * Creates one on first sight, and attempts a fingerprint-based repair when the
 * path is unknown but an orphaned record looks like the same file.
 */
export function ensureMeta(path: string): FileMeta {
  const known = store.get().byPath[path]
  if (known) {
    const meta = store.get().files[known]
    if (meta) return refreshFingerprint(meta)
  }

  const repaired = tryRepair(path)
  if (repaired) return repaired

  const meta = blankMeta(path)
  store.update(draft => {
    draft.files[meta.id] = meta
    draft.byPath[path] = meta.id
  })
  return meta
}

/**
 * Keep the fingerprint current so a *future* move can still be matched. Without
 * this, the stored fingerprint drifts further from reality with every edit and
 * repair stops working after the first save.
 */
function refreshFingerprint(meta: FileMeta): FileMeta {
  if (!existsSync(meta.path)) return meta
  const current = fingerprint(meta.path)
  if (!current) return meta
  if (
    meta.fingerprint &&
    current.head === meta.fingerprint.head &&
    current.size === meta.fingerprint.size
  ) {
    return meta
  }
  store.update(draft => {
    const target = draft.files[meta.id]
    if (target) target.fingerprint = current
  })
  return { ...meta, fingerprint: current }
}

function tryRepair(path: string): FileMeta | null {
  const incoming = fingerprint(path)
  if (!incoming) return null

  const candidates: RepairCandidate[] = Object.values(store.get().files)
    // Only records worth rescuing — re-pointing an empty record buys nothing
    // and risks stealing identity from a file the user still has.
    .filter(hasUserData)
    .map(meta => ({ meta, stillExists: existsSync(meta.path) }))

  const result = findRepairTarget(path, incoming, candidates)
  if (result.kind !== 'matched') {
    if (result.kind === 'ambiguous') {
      console.warn(
        `[meta] ${path} matches ${result.candidates.length} orphaned records; treating as new`,
      )
    }
    return null
  }

  const previousPath = result.meta.path
  let repaired: FileMeta | null = null
  store.update(draft => {
    const target = draft.files[result.meta.id]
    if (!target) return
    delete draft.byPath[previousPath]
    target.path = path
    target.rootId = rootIdForPath(path)
    target.fingerprint = incoming
    target.updatedAt = Date.now()
    draft.byPath[path] = target.id
    repaired = { ...target }
  })
  console.log(`[meta] relinked metadata: ${previousPath} -> ${path}`)
  return repaired
}

export function getMetaMany(paths: string[]): Record<string, FileMeta | undefined> {
  const out: Record<string, FileMeta | undefined> = {}
  for (const path of paths) {
    const id = store.get().byPath[path]
    out[path] = id ? store.get().files[id] : undefined
  }
  return out
}

export function updateMeta(
  path: string,
  patch: Partial<Pick<FileMeta, 'labels' | 'tags' | 'note' | 'pinned' | 'icon' | 'color'>>,
): FileMeta {
  const current = ensureMeta(path)
  let next: FileMeta = current
  store.update(draft => {
    const target = draft.files[current.id]
    if (!target) return
    if (patch.labels) target.labels = normalizeList(patch.labels)
    if (patch.tags) target.tags = normalizeList(patch.tags)
    if (patch.note !== undefined) target.note = patch.note
    if (patch.pinned !== undefined) target.pinned = patch.pinned
    // An empty string is how the picker says "back to the default", so it
    // removes the key rather than storing a blank one that reads as a value.
    if (patch.icon !== undefined) {
      if (patch.icon) target.icon = patch.icon
      else delete target.icon
    }
    if (patch.color !== undefined) {
      if (patch.color) target.color = patch.color
      else delete target.color
    }
    target.updatedAt = Date.now()
    next = { ...target }
  })
  return next
}

/** Lowercased, trimmed, de-duplicated — so `Rust`, `rust ` and `rust` are one tag. */
function normalizeList(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = raw.trim().toLowerCase()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/** Called by the watcher when a rename is observed while the app is running. */
export function movePath(from: string, to: string) {
  const id = store.get().byPath[from]
  if (!id) return
  store.update(draft => {
    const target = draft.files[id]
    if (!target) return
    delete draft.byPath[from]
    target.path = to
    target.rootId = rootIdForPath(to)
    target.updatedAt = Date.now()
    draft.byPath[to] = id
  })
}

/**
 * Follows a folder that moved: every record at or under `from`.
 *
 * Returns the pairs it moved so the caller can tell the rest of the app which
 * files changed address. Fingerprint repair would eventually re-link most of
 * these one file at a time, on next open — but only for records that carry user
 * data, and only if the file is opened again at all. Doing it here means the
 * whole folder's tags, notes, pins and history survive the rename outright.
 */
export function movePathsUnder(from: string, to: string): Array<{ from: string; to: string }> {
  const moved: Array<{ from: string; to: string }> = []
  for (const meta of allMeta()) {
    const next = retargetUnder(meta.path, from, to)
    if (next) moved.push({ from: meta.path, to: next })
  }
  if (moved.length === 0) return moved

  const now = Date.now()
  store.update(draft => {
    for (const { from: was, to: now_ } of moved) {
      const id = draft.byPath[was]
      if (!id) continue
      const target = draft.files[id]
      if (!target) continue
      delete draft.byPath[was]
      target.path = now_
      target.rootId = rootIdForPath(now_)
      target.updatedAt = now
      draft.byPath[now_] = id
    }
  })
  return moved
}

export function allMeta(): FileMeta[] {
  return Object.values(store.get().files)
}

export function metaById(id: FileId): FileMeta | undefined {
  return store.get().files[id]
}

export function metaByPath(path: string): FileMeta | undefined {
  const id = store.get().byPath[path]
  return id ? store.get().files[id] : undefined
}

export function listTags(): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>()
  for (const meta of allMeta()) {
    for (const tag of meta.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export function listLabels(): LabelDef[] {
  return Object.values(store.get().labelDefs).sort((a, b) => a.order - b.order)
}

export function upsertLabel(label: LabelDef): LabelDef[] {
  store.update(draft => {
    draft.labelDefs[label.name] = label
  })
  return listLabels()
}

export function deleteLabel(name: string): LabelDef[] {
  store.update(draft => {
    delete draft.labelDefs[name]
    for (const meta of Object.values(draft.files)) {
      if (meta.labels.includes(name)) {
        meta.labels = meta.labels.filter(l => l !== name)
        meta.updatedAt = Date.now()
      }
    }
  })
  return listLabels()
}

/** Repairs a drifted `byPath` index. Cheap, and runs once at boot. */
export function verifyIndex() {
  const data = store.get()
  const expected = Object.keys(data.files).length
  const actual = Object.keys(data.byPath).length
  if (expected !== actual) {
    console.warn(`[meta] byPath index drifted (${actual} vs ${expected}); rebuilding`)
    store.update(reindex)
  }
}
