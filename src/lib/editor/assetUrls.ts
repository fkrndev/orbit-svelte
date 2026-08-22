/**
 * Making a relative image path displayable, without letting the display form
 * reach the file.
 *
 * A note refers to its images the way markdown always has — `assets/shot.png`,
 * relative to the note. A webview resolves that against the *page*, not against
 * the folder on disk, so the image renders broken while the markdown is
 * perfectly correct. It is the one place where what belongs in the file and
 * what the editor can render are genuinely different strings.
 *
 * So they are swapped at the boundary, in the same pre/post-process pass the
 * math and durable-fence codecs already use: rewritten to a fetchable URL on
 * the way in, and back to the relative path on the way out. Nothing in between
 * has to know, and the file never sees a `localhost` URL.
 */

import { DEFAULT_API_PORT } from '$shared/api'

const FILE_ROUTE = '/api/file?path='

/**
 * Where `/api/file` is, as seen from the page.
 *
 * Taken from the page rather than written down, because every surface the editor
 * runs on is served over HTTP by something that forwards `/api` to the process
 * that owns the files — the browser build by the dev server, the desktop shell by
 * the same Vite server its view is loaded from. Borrowing the origin is therefore
 * the only form that stays correct when the port moves, and a hardcoded one is
 * how every image in the app came to point at a port nothing was listening on.
 *
 * A packaged build is the exception, and the reason this is not simply a relative
 * URL: its view has no HTTP origin to borrow, so `/api/file` would resolve
 * against `views://` and reach nothing.
 */
function apiOrigin(): string {
  const origin = typeof location === 'undefined' ? '' : location.origin
  return origin.startsWith('http') ? origin : `http://localhost:${DEFAULT_API_PORT}`
}

/** Anything with a scheme is the author's own link and is left alone. */
function isAbsolute(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
}

/**
 * `encodeURIComponent` leaves brackets alone, and a markdown image ends at the
 * first `)` — so a note in `~/plans (old)/` would otherwise serialize back as a
 * truncated URL with the rest of the path spilled into the paragraph.
 */
function encodePath(path: string): string {
  return encodeURIComponent(path).replace(/\(/g, '%28').replace(/\)/g, '%29')
}

function dirname(path: string): string {
  const at = path.lastIndexOf('/')
  return at <= 0 ? '/' : path.slice(0, at)
}

/** Resolve `../` and `./` against the note's folder, POSIX-style. */
export function resolveAgainstNote(notePath: string, relative: string): string {
  const parts = dirname(notePath).split('/')
  for (const segment of relative.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join('/')
}

export function toDisplayUrl(notePath: string, relative: string): string {
  if (isAbsolute(relative)) return relative
  const absolute = resolveAgainstNote(notePath, decodeURI(relative))
  return `${apiOrigin()}${FILE_ROUTE}${encodePath(absolute)}`
}

/**
 * The inverse: only ever unwraps a URL this module produced.
 *
 * Liberal about *which* origin it wraps, deliberately. What must never reach the
 * file is a `localhost` URL, and the origin an image was displayed through is not
 * guaranteed to be the one in force when the document is serialized — a port
 * moves, a reload lands on a different one. Matching the route rather than one
 * exact prefix is what keeps a relative path relative across that.
 */
const OURS = /^(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)?\/api\/file\?path=(.+)$/

export function fromDisplayUrl(notePath: string, url: string): string {
  const here = `${apiOrigin()}${FILE_ROUTE}`
  const encoded = url.startsWith(here) ? url.slice(here.length) : OURS.exec(url)?.[1]
  if (!encoded) return url
  return relativeTo(dirname(notePath), decodeURIComponent(encoded))
}

function relativeTo(fromDir: string, target: string): string {
  const from = fromDir.split('/')
  const to = target.split('/')
  let shared = 0
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared += 1
  const up = Array<string>(from.length - shared).fill('..')
  return [...up, ...to.slice(shared)].join('/')
}

const IMAGE = /(!\[[^\]]*\]\()([^)\s]+)(\))/g

/** Markdown on disk -> markdown the editor can render. */
export function preProcessAssetMarkdown(notePath: string, markdown: string): string {
  return markdown.replace(IMAGE, (_, open: string, url: string, close: string) =>
    `${open}${toDisplayUrl(notePath, url)}${close}`,
  )
}

/** Markdown from the editor -> markdown for disk. */
export function postProcessAssetMarkdown(notePath: string, markdown: string): string {
  return markdown.replace(IMAGE, (_, open: string, url: string, close: string) =>
    `${open}${fromDisplayUrl(notePath, url)}${close}`,
  )
}
