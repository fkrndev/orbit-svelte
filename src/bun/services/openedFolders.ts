import { dirname } from 'node:path'

/**
 * Folders reached by opening a file directly, rather than by adding a root.
 *
 * These exist for one reason: `/api/file` serves a note's images, and it only
 * serves what sits under a folder the user has explicitly opened — otherwise a
 * localhost endpoint with a free-text `?path=` hands out `~/.ssh/id_rsa` to any
 * process on the machine. A root used to be the only way to be explicit.
 *
 * Opening a file by typing its path is exactly as explicit, and it deliberately
 * does *not* register a root — so without this, every image in a note opened
 * that way is a broken box. The grant is the note's own folder, for this run of
 * the app only: nothing is persisted, so quitting revokes it.
 */
const folders = new Set<string>()

/** Called when a file is opened outside the roots. Grants its folder, nothing above it. */
export function grantFolderFor(filePath: string) {
  folders.add(dirname(filePath))
}

export function isGrantedFolder(path: string): boolean {
  for (const folder of folders) {
    if (path.startsWith(`${folder}/`)) return true
  }
  return false
}

/** Test seam — the set is process-wide and would otherwise leak between cases. */
export function clearGrantedFolders() {
  folders.clear()
}
