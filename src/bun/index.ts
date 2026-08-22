import { BrowserView, BrowserWindow, Updater, Utils, type RPCSchema } from 'electrobun/bun'
import { basename, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import type { AppRPCMessages, AppRPCRequests } from '../shared/rpc'
import type { FileChangeEvent } from '../shared/types'
import { DEFAULT_API_PORT } from '../shared/api'
import { installApplicationMenu } from './menu'
import { flushAllStores } from './services/jsonStore'
import { listRoots, liveRoots } from './services/roots'
import { verifyIndex } from './services/meta'
import { verifyBookmarks } from './services/sidebar'
import { reportMissingFiles, unwatchAll, watchRoot } from './services/watcher'
import { createRequestHandlers, type NativeBridge } from './handlers'
import { queueOpen } from './services/pendingOpens'
import { startApiServer } from './apiServer'
import { STORE_DIR } from './paths'

const DEV_SERVER_URL = 'http://localhost:5373'

type AppRPCType = {
  bun: RPCSchema<{ requests: AppRPCRequests; messages: Record<never, unknown> }>
  webview: RPCSchema<{ requests: Record<never, unknown>; messages: AppRPCMessages }>
}

// ---- startup reconciliation ----------------------------------------------

verifyIndex()
verifyBookmarks()
reportMissingFiles()

/**
 * Files named on the command line — `orbit ~/notes/plan.md`.
 *
 * The bundle already declares `fileAssociations` for md/markdown/mdx, so macOS
 * lists the app under Open With. Finishing that route needs the
 * `application:openFile:` delegate, which Electrobun 1.18 does not surface to
 * the Bun side, so a double-click still opens the app without the document.
 * The argument path is what can be honoured today, and it is the same queue the
 * delegate would feed once there is a hook for it — see `pendingOpens.ts`.
 */
for (const arg of Bun.argv.slice(2)) {
  if (arg.startsWith('-')) continue
  queueOpen(resolve(arg))
}

// ---- native bridge --------------------------------------------------------

const native: NativeBridge = {
  /**
   * The dialog returns a comma-joined string, and an empty selection comes back
   * as `[""]` rather than `[]` — normalise both here so callers see `null`.
   */
  async pickPath({ canChooseFiles, canChooseDirectory, allowedFileTypes }) {
    const result = await Utils.openFileDialog({
      startingFolder: '~/',
      allowsMultipleSelection: false,
      allowedFileTypes: allowedFileTypes ?? '*',
      canChooseFiles,
      canChooseDirectory,
    })
    const first = result.find(entry => entry.trim().length > 0)
    return first && existsSync(first) ? first : null
  },
  moveToTrash: path => Utils.moveToTrash(path),
  showItemInFolder: path => Utils.showItemInFolder(path),
  openExternal: url => Utils.openExternal(url),
  toggleWindowZoom: () => {
    const zoomed = mainWindow.isMaximized()
    if (zoomed) mainWindow.unmaximize()
    else mainWindow.maximize()
    return { zoomed: !zoomed }
  },
  // Quits and relaunches from inside Electrobun, so nothing after this runs.
  applyUpdate: () => {
    void Updater.applyUpdate()
  },
}

const handlers = createRequestHandlers({
  native,
  emitFileChange: event => emitFileChange(event),
})

const rpc = BrowserView.defineRPC<AppRPCType>({
  maxRequestTime: 15_000,
  handlers: { requests: handlers, messages: {} },
})

// ---- window ---------------------------------------------------------------

async function resolveViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel()
  if (channel === 'dev') {
    try {
      await fetch(DEV_SERVER_URL, { method: 'HEAD' })
      console.log(`[app] using Vite dev server at ${DEV_SERVER_URL}`)
      return DEV_SERVER_URL
    } catch {
      console.log('[app] Vite dev server not running; serving the bundled view')
    }
  }
  return 'views://mainview/index.html'
}

const mainWindow = new BrowserWindow<typeof rpc>({
  title: 'Orbit Lite',
  url: await resolveViewUrl(),
  rpc,
  frame: { width: 1280, height: 860, x: 120, y: 100 },
  titleBarStyle: 'hiddenInset',
})

/**
 * `hiddenInset` places the traffic lights for the standard 28pt title bar, so in
 * ours — `h-11`, sized to fit the search field — they sit about 5pt high.
 *
 * Measured rather than guessed: at 14 the buttons' centre lands within a quarter
 * of a point of the bar's. It pairs with the height in
 * [`TitleBar.tsx`](../lib/components/TitleBar.svelte), so the two move together.
 */
mainWindow.setWindowButtonPosition(20, 14)

/**
 * The desktop app also serves the browser build.
 *
 * Doing it from here rather than a second process is the whole point: this
 * process owns the JSON stores, so a browser tab attaching to it can never race
 * a separate owner. `bun run dev` therefore gives you both surfaces at once.
 */
const apiServer = startApiServer({
  handlers,
  port: Number(process.env.ORBIT_LITE_API_PORT ?? DEFAULT_API_PORT),
  label: 'desktop app',
})

function emitFileChange(event: FileChangeEvent) {
  mainWindow.webview?.rpc?.send.fileChanged(event)
  apiServer?.broadcast(event)
}

installApplicationMenu(command => {
  mainWindow.webview?.rpc?.send.menuCommand({ command })
})

// Watch every known root so external edits show up without a restart.
for (const root of liveRoots()) {
  watchRoot(root.path, emitFileChange)
}

// ---- updates --------------------------------------------------------------

/**
 * Look once at startup, fetch in the background, then tell the window the new
 * bundle is staged — and stop there.
 *
 * Applying is left to a click on purpose: `Updater.applyUpdate()` swaps the
 * bundle and quits, and doing that under someone's cursor mid-sentence is how
 * an editor loses a paragraph. Stores flush on exit (see `shutdown`), but the
 * unsaved buffer in the webview does not.
 *
 * `checkForUpdate` short-circuits on the dev channel, so this is inert under
 * `bun run dev` and only does real work in a `build:stable` bundle.
 */
async function checkForUpdate() {
  try {
    const update = await Updater.checkForUpdate()
    if (!update.updateAvailable) return

    await Updater.downloadUpdate()
    // `downloadUpdate` reports failure on the info object rather than throwing.
    if (!Updater.updateInfo()?.updateReady) return

    mainWindow.webview?.rpc?.send.updateReady({ version: update.version })
  } catch (error) {
    // Starting offline lands here, which is normal — not worth a dialog.
    console.log('[update]', error instanceof Error ? error.message : error)
  }
}

void checkForUpdate()

// ---- shutdown -------------------------------------------------------------

/**
 * Stores debounce their writes, so a quit inside that window would drop the
 * last change. Flush on every exit path we can observe.
 */
function shutdown() {
  unwatchAll()
  apiServer?.stop()
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

console.log(`[app] ready — data dir: ${STORE_DIR}`)
console.log(
  `[app] ${listRoots().length} root(s): ${listRoots().map(r => basename(r.path)).join(', ') || 'none yet'}`,
)
