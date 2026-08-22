import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

/**
 * Where the app keeps its data.
 *
 * This deliberately does *not* import from `electrobun` — the same services run
 * behind the desktop shell and behind the dev HTTP server, and the dev server is
 * a plain Bun process with no native bridge. Both must resolve to the identical
 * directory, otherwise the browser and the app would each see their own half of
 * your history and tags.
 *
 * The layout mirrors Electrobun's `Utils.paths.userData`:
 * `<app data>/<identifier>/<channel>`.
 */

/**
 * A *filesystem path*, not a name.
 *
 * Deliberately **not** the React build's `local.markdown.app`. Both apps hold
 * the JSON stores in memory and write them back whole, so pointing them at one
 * directory would have each overwriting the other's tags, pins, roots, and
 * history — silently, and only when both had been open. It must stay distinct
 * even though the two apps are otherwise the same program.
 */
const APP_IDENTIFIER = 'local.orbitlite.app'

/** Electrobun sets the channel per build; default to `dev` for the plain server. */
const CHANNEL = process.env.ORBIT_LITE_CHANNEL ?? 'dev'

function appDataDir(): string {
  const home = homedir()
  switch (process.platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support')
    case 'win32':
      return process.env.APPDATA ?? join(home, 'AppData', 'Roaming')
    default:
      return process.env.XDG_DATA_HOME ?? join(home, '.local', 'share')
  }
}

export const HOME_DIR = homedir()
export const DATA_DIR = join(appDataDir(), APP_IDENTIFIER, CHANNEL)
export const STORE_DIR = join(DATA_DIR, 'store')

mkdirSync(STORE_DIR, { recursive: true })

export const STORE_FILES = {
  files: join(STORE_DIR, 'files.json'),
  history: join(STORE_DIR, 'history.json'),
  properties: join(STORE_DIR, 'properties.json'),
  roots: join(STORE_DIR, 'roots.json'),
  settings: join(STORE_DIR, 'settings.json'),
  sidebar: join(STORE_DIR, 'sidebar.json'),
} as const
