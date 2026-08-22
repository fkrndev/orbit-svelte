import { splitFrontmatter } from './frontmatter'
import { FENCE, bodyLineOffset } from './outline'
import { isMarkdownName } from './rename'

/**
 * Reading the links out of a markdown file, and working out what they point at.
 *
 * This is the reverse of `relativePathBetween`, which writes them. The two have
 * to agree: anything `⌘K` can produce, this has to be able to resolve back to
 * the same file, or "which files link here" quietly under-reports.
 *
 * Deliberately string-only and POSIX-only — it is handed document text and
 * returns document paths, so it runs identically on either side of the RPC and
 * needs no filesystem to be tested.
 */

export interface LinkRef {
  /** The target as written, minus any angle brackets, anchor, or title. */
  target: string
  /** Line in the file, counting frontmatter — the same basis as `outline()`. */
  line: number
  /** The whole line, so a hit can be shown in context. */
  text: string
  /** `![alt](…)` rather than `[text](…)`: an embed, not a reference. */
  image: boolean
}

/**
 * `[text](target)` / `![alt](target)`, with an optional `"title"` after it.
 *
 * The target is either `<…>` — the form used when it contains spaces — or a run
 * of non-space characters. Markdown does allow balanced parentheses in a bare
 * target; that is not supported here on purpose, because the regex to do it is
 * unreadable and the app's own links never produce one.
 */
const INLINE_LINK = /(!?)\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g

/** `[id]: target` — a link whose target was written somewhere else in the file. */
const REFERENCE_DEF = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/

/** Anything of the form `scheme:` — http, https, mailto, and every other non-file. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** Every link in the file, in document order. */
export function linkTargets(content: string): LinkRef[] {
  const [frontmatter] = splitFrontmatter(content)
  const offset = bodyLineOffset(frontmatter)
  const body = content.slice(frontmatter.length).replace(/\r\n/g, '\n').split('\n')

  const refs: LinkRef[] = []
  let fence: string | null = null

  for (let i = 0; i < body.length; i += 1) {
    const line = body[i]!

    // A link inside a code block is sample text, not a reference to follow.
    const fenceMatch = line.match(FENCE)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]!
      else if (line.trimStart().startsWith(fence)) fence = null
      continue
    }
    if (fence !== null) continue

    const at = offset + i

    const definition = line.match(REFERENCE_DEF)
    if (definition) {
      refs.push({ target: unwrap(definition[1]!), line: at, text: line, image: false })
      continue
    }

    // `matchAll` rather than a single match: two links on one line is ordinary
    // prose, and taking only the first would lose half of them.
    for (const match of line.matchAll(INLINE_LINK)) {
      refs.push({ target: unwrap(match[2]!), line: at, text: line, image: match[1] === '!' })
    }
  }

  return refs
}

/**
 * The absolute path a link points at, or `null` when it does not point at a
 * file on this disk.
 *
 * Case-sensitive, even though macOS usually is not. Matching case-insensitively
 * would find one more link here and invent false ones on a case-sensitive disk,
 * and the links this app writes always carry the real name anyway.
 */
export function resolveLink(fromFile: string, target: string): string | null {
  const cleaned = decodePath(unwrap(target).trim())
    // An anchor or a query names a place *inside* the target, not another file.
    .split('#')[0]!
    .split('?')[0]!

  if (!cleaned) return null
  if (URL_SCHEME.test(cleaned)) return null

  const base = cleaned.startsWith('/') ? [] : fromFile.split('/').slice(0, -1)
  return normalise([...base, ...cleaned.split('/')])
}

/** Every link in `content` that points at `targetFile`. */
export function linksToFile(content: string, fromFile: string, targetFile: string): LinkRef[] {
  return linkTargets(content).filter(
    // Images are excluded: an embedded picture is not one note referring to
    // another, and counting it would put every note that pastes a screenshot
    // into the results for that screenshot.
    ref => !ref.image && resolveLink(fromFile, ref.target) === targetFile,
  )
}

/**
 * What following a link should actually do.
 *
 * `blocked` carries the sentence to show, because the alternative is a link
 * that does nothing when clicked and never says why.
 */
export type LinkAction =
  | { kind: 'note'; path: string }
  | { kind: 'file'; path: string }
  | { kind: 'external'; url: string }
  | { kind: 'blocked'; reason: string }

/**
 * The only schemes a note is allowed to launch.
 *
 * Everything else is refused, and that is a security boundary rather than a
 * missing feature: markdown arrives from repositories, downloads, and other
 * people, and handing an arbitrary scheme to the operating system lets a
 * document decide which application runs. `javascript:`, `data:`, and `file:`
 * are the obvious ones; the custom schemes registered by installed apps are the
 * reason an allowlist is the right shape rather than a blocklist.
 */
const OPENABLE_SCHEMES = new Set(['http', 'https', 'mailto'])

/**
 * Whether this URL may be handed to the operating system.
 *
 * Exported so the RPC handler can enforce it too. `linkAction` decides which
 * button to draw; this decides what is allowed to run, and a check that lives
 * only in the UI protects nothing.
 */
export function isOpenableUrl(url: string): boolean {
  const scheme = url.trim().match(URL_SCHEME)?.[0]?.slice(0, -1).toLowerCase()
  return scheme !== undefined && OPENABLE_SCHEMES.has(scheme)
}

/** Decides what a link does, without doing any of it. */
export function linkAction(fromFile: string, url: string): LinkAction {
  const raw = unwrap(url).trim()
  if (!raw) return { kind: 'blocked', reason: 'This link has no target.' }

  const scheme = raw.match(URL_SCHEME)?.[0]?.slice(0, -1).toLowerCase()
  if (scheme) {
    return OPENABLE_SCHEMES.has(scheme)
      ? { kind: 'external', url: raw }
      : { kind: 'blocked', reason: `Orbit will not open ${scheme}: links.` }
  }

  if (raw.startsWith('#')) {
    return { kind: 'blocked', reason: 'This link points inside the note you are reading.' }
  }

  const path = resolveLink(fromFile, raw)
  if (!path) return { kind: 'blocked', reason: 'This link does not point at a file.' }

  return isMarkdownName(path) ? { kind: 'note', path } : { kind: 'file', path }
}

function unwrap(target: string): string {
  return target.startsWith('<') && target.endsWith('>') ? target.slice(1, -1) : target
}

/**
 * `%20` is how a space reaches a markdown link, so it has to come back out.
 * A malformed escape is left alone rather than thrown — `100%.md` is a legal
 * filename and an illegal escape sequence at the same time.
 */
function decodePath(target: string): string {
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}

/** Collapses `.` and `..` segments. Leading `..` is dropped: nothing is above the root. */
function normalise(parts: string[]): string {
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return `/${out.join('/')}`
}
