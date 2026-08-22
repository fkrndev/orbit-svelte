import type { FileMeta, Fingerprint } from '../../shared/types'

/**
 * Metadata lives outside the markdown file, keyed by path. That is fast and
 * keeps the user's files pristine, but it means a move or rename performed
 * outside the app breaks the link.
 *
 * When the app is running, the watcher catches renames directly. This module
 * handles the other case: the file moved while the app was closed, so all we
 * have is a path that no longer resolves and a set of orphaned records.
 *
 * Pure by design — no fs, no store — so the matching rules can be tested
 * without a filesystem.
 */

export interface RepairCandidate {
  meta: FileMeta
  /** Whether `meta.path` still points at something on disk. */
  stillExists: boolean
}

export type RepairResult =
  | { kind: 'matched'; meta: FileMeta }
  | { kind: 'ambiguous'; candidates: FileMeta[] }
  | { kind: 'none' }

function sameContent(a: Fingerprint, b: Fingerprint): boolean {
  return a.head === b.head && a.size === b.size
}

function basename(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? path : path.slice(index + 1)
}

/**
 * Find the orphaned metadata record that belongs to a file we just opened.
 *
 * Only orphans are considered: if a record's own path still resolves, that file
 * is alive and its metadata is spoken for. Without that rule, opening a copy of
 * a file would steal the original's tags.
 */
export function findRepairTarget(
  incomingPath: string,
  incomingFingerprint: Fingerprint | null,
  candidates: RepairCandidate[],
): RepairResult {
  if (!incomingFingerprint) return { kind: 'none' }

  const orphans = candidates.filter(c => !c.stillExists && c.meta.fingerprint)
  const byContent = orphans.filter(c => sameContent(c.meta.fingerprint!, incomingFingerprint))

  if (byContent.length === 1) return { kind: 'matched', meta: byContent[0]!.meta }
  if (byContent.length === 0) return { kind: 'none' }

  // Several orphans have identical content — a duplicated file, most likely.
  // Prefer the one that also kept its filename.
  const name = basename(incomingPath)
  const byName = byContent.filter(c => basename(c.meta.path) === name)
  if (byName.length === 1) return { kind: 'matched', meta: byName[0]!.meta }

  return { kind: 'ambiguous', candidates: byContent.map(c => c.meta) }
}

/** True when a record carries anything the user would be sad to lose. */
export function hasUserData(meta: FileMeta): boolean {
  return (
    meta.labels.length > 0 ||
    meta.tags.length > 0 ||
    meta.note.trim().length > 0 ||
    meta.pinned
  )
}
