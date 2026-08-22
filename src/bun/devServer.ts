import { basename } from 'node:path'
import type { FileChangeEvent } from '../shared/types'
import { DEFAULT_API_PORT } from '../shared/api'
import { createRequestHandlers, type NativeBridge } from './handlers'
import { startApiServer } from './apiServer'
import { flushAllStores } from './services/jsonStore'
import { listRoots, liveRoots } from './services/roots'
import { verifyIndex } from './services/meta'
import { verifyBookmarks } from './services/sidebar'
import { reportMissingFiles, unwatchAll, watchRoot } from './services/watcher'
import { STORE_DIR } from './paths'
import { moveToTrash } from './services/trash'

/**
 * Serves the browser build *without* the desktop app.
 *
 * The desktop app hosts the same API itself, so this standalone process only
 * exists for working in a browser alone. Starting both is safe by accident
 * rather than by design — the second one fails to bind the port and says so —
 * but it is still not what you want, because whichever process wins owns the
 * stores and the other is left holding a stale copy.
 */

verifyIndex()
verifyBookmarks()
reportMissingFiles()

const native: NativeBridge = {
  // No system dialog from a web page. The UI checks for `null` and opens its
  // own picker, which is why browser mode can still reach any folder.
  pickPath: async () => null,
  moveToTrash,
  showItemInFolder: path => {
    console.log(`[api] reveal requested for ${path} (not available over HTTP)`)
  },
  // A web page opens its own links. Returning false is the signal for that, not
  // a failure — see `openExternal` in `rpc.ts`.
  openExternal: () => false,
  // A tab does not own its window, so the title bar's double-click does nothing here.
  toggleWindowZoom: () => ({ zoomed: false }),
}

const handlers = createRequestHandlers({
  native,
  emitFileChange: event => emitFileChange(event),
})

const server = startApiServer({
  handlers,
  port: Number(process.env.ORBIT_LITE_API_PORT ?? DEFAULT_API_PORT),
  label: 'standalone server',
})

if (!server) {
  console.error('[api] exiting: nothing to serve on.')
  process.exit(1)
}

function emitFileChange(event: FileChangeEvent) {
  server?.broadcast(event)
}

for (const root of liveRoots()) {
  watchRoot(root.path, emitFileChange)
}

function shutdown() {
  unwatchAll()
  server?.stop()
  flushAllStores()
}

process.on('exit', shutdown)
process.on('SIGINT', () => {
  shutdown()
  process.exit(0)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(0)
})

console.log(`[api] store: ${STORE_DIR}`)
console.log(
  `[api] ${listRoots().length} root(s): ${listRoots().map(r => basename(r.path)).join(', ') || 'none yet'}`,
)
