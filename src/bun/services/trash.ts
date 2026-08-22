import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { homedir } from 'node:os'

/**
 * Move-to-trash without a native bridge, for the HTTP dev server.
 *
 * Deleting is the one operation where "close enough" is not acceptable, so this
 * only ever *moves* files. If it cannot reach a real trash location it throws
 * rather than falling back to an unlink — a failed delete is recoverable, a
 * silent permanent one is not.
 */
export function moveToTrash(path: string) {
  if (!existsSync(path)) return

  const trashDir = resolveTrashDir()
  if (!trashDir) {
    throw new Error(`Trash is not available on ${process.platform}; delete this file manually`)
  }

  mkdirSync(trashDir, { recursive: true })
  renameSync(path, uniqueTrashPath(trashDir, basename(path)))
}

function resolveTrashDir(): string | null {
  const home = homedir()
  switch (process.platform) {
    case 'darwin':
      return join(home, '.Trash')
    case 'linux':
      return join(process.env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'Trash', 'files')
    default:
      return null
  }
}

/** The trash already holds files from everywhere; never overwrite one. */
function uniqueTrashPath(trashDir: string, name: string): string {
  const ext = extname(name)
  const stem = basename(name, ext)
  let candidate = join(trashDir, name)
  let n = 2
  while (existsSync(candidate)) {
    candidate = join(trashDir, `${stem} ${n}${ext}`)
    n += 1
  }
  return candidate
}
