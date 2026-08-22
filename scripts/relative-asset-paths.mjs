import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Rewrites `dist/index.html` to reference its assets relatively.
 *
 * `kit.paths.relative` only takes effect for *prerendered* pages. The SPA
 * fallback is not prerendered, so the adapter emits absolute `/_app/...` URLs —
 * and inside the desktop bundle the document is loaded from
 * `views://mainview/index.html`, where a leading `/` does not resolve to the
 * directory the bundle put those files in. The window comes up white with
 * nothing in the console, because the failure is a scheme handler declining a
 * path rather than a script throwing.
 *
 * Only `index.html` needs this: Vite already emits chunk-to-chunk imports
 * relative, so nothing under `_app/immutable/` refers to an absolute path.
 *
 * The check at the end is the point of the script. A silent no-op here would
 * ship exactly the blank window it exists to prevent.
 */

const file = resolve(process.argv[2] ?? 'dist/index.html')
const before = readFileSync(file, 'utf8')

const after = before
  // href="/_app/…", src="/_app/…", and the two dynamic `import("/_app/…")` calls
  // in the bootstrap script.
  .replaceAll('"/_app/', '"./_app/')
  // Anything else served out of `static/`, the favicon above all.
  .replaceAll('href="/', 'href="./')
  .replaceAll('src="/', 'src="./')

if (after.includes('"/_app/')) {
  console.error(`[assets] ${file} still contains absolute /_app/ references`)
  process.exit(1)
}

if (after === before) {
  console.log(`[assets] ${file} already relative`)
} else {
  writeFileSync(file, after)
  console.log(`[assets] rewrote ${file} to relative asset paths`)
}
