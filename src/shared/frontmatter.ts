/**
 * Reading and editing the YAML block at the top of a markdown file.
 *
 * Two rules shape everything here.
 *
 * **We never reserialize the block.** A parse-then-stringify round trip would
 * let an edit to `status` silently requote `title`, reorder keys, or drop a
 * comment. So a write is surgery: the lines belonging to one key are replaced
 * and every other byte of the file is passed through untouched.
 *
 * **We only claim to understand what we can put back.** A key whose value is a
 * nested map or a multi-line scalar is shown but not editable, because
 * rewriting it safely means understanding YAML, and being wrong means damaging
 * a file the app did not create. The raw editor (⌘/) is the escape hatch.
 *
 * Lives in `shared/` because both sides need identical answers — see the note
 * on `rename.ts` in AGENTS.md.
 */

export type FrontmatterSplit = [frontmatter: string, body: string]

function frontmatterOpeningLength(content: string): number | null {
  if (content.startsWith('---\n')) return 4
  if (content.startsWith('---\r\n')) return 5
  return null
}

export function splitFrontmatter(content: string): FrontmatterSplit {
  const openLength = frontmatterOpeningLength(content)
  if (openLength === null) return ['', content]

  const afterOpen = content.slice(openLength)
  const close = afterOpen.match(/(?:^|\r?\n)---(?:\r?\n|$)/)
  if (!close || close.index === undefined) return ['', content]

  const to = openLength + close.index + close[0].length
  return [content.slice(0, to), content.slice(to)]
}

export function extractEditorBody(rawFileContent: string): string {
  const [, rawBody] = splitFrontmatter(rawFileContent)
  return rawBody.trimStart()
}

// ---- reading --------------------------------------------------------------

/** How a value is written in YAML, which decides whether we can rewrite it. */
export type PropertyShape = 'scalar' | 'list' | 'unsupported'

export interface PropertyEntry {
  key: string
  shape: PropertyShape
  /** Scalars: the value with quotes stripped. Lists: the items. Unsupported: empty. */
  value: string
  items: string[]
  /** Index into the frontmatter's line array — used to rewrite in place. */
  line: number
  /** How many lines the key spans, including its continuation lines. */
  span: number
}

/** A top-level key line: no indent, a name, a colon, then value or nothing. */
const KEY_LINE = /^([A-Za-z_][\w .-]*):(?:\s+(.*))?$/

const BLOCK_ITEM = /^\s*-\s*(.*)$/

/**
 * A name that will still parse as this same key after it is written back.
 *
 * Checked against the bare name rather than by testing `${name}:` against
 * `KEY_LINE`, because a name containing a colon passes that test — the colon
 * simply ends the key early, and `a: b` would be written as `a: b: draft`,
 * turning one property into a different one plus a syntax error.
 */
const KEY_NAME = /^[A-Za-z_][\w .-]*$/

/** Whether a name can be added to the block and read back as the same key. */
export function isPropertyKey(name: string): boolean {
  return KEY_NAME.test(name.trim())
}

function unquote(raw: string): string {
  const value = raw.trim()
  if (value.length < 2) return value
  const first = value[0]
  if ((first === '"' || first === "'") && value.endsWith(first)) {
    return value.slice(1, -1)
  }
  return value
}

function splitInlineList(raw: string): string[] {
  return raw
    .slice(1, -1)
    .split(',')
    .map(unquote)
    .filter(item => item.length > 0)
}

/** The lines of the YAML block, without the `---` fences. */
function frontmatterLines(content: string): { lines: string[]; open: number } | null {
  const [block] = splitFrontmatter(content)
  if (!block) return null
  const lines = block.replace(/\r\n/g, '\n').split('\n')
  // First line is the opening fence; the closing fence is the last `---`.
  const close = lines.lastIndexOf('---')
  if (close <= 0) return null
  return { lines: lines.slice(1, close), open: 1 }
}

function classify(rest: string | undefined, following: string[]): Omit<PropertyEntry, 'key' | 'line'> {
  const inline = (rest ?? '').trim()

  if (inline.startsWith('[') && inline.endsWith(']')) {
    return { shape: 'list', value: inline, items: splitInlineList(inline), span: 1 }
  }

  if (inline.length > 0) {
    // A block scalar (`|`, `>`) owns the indented lines under it, and we are
    // not in the business of rewriting those.
    if (inline.startsWith('|') || inline.startsWith('>')) {
      const span = 1 + following.findIndex(l => l.trim() !== '' && !/^\s/.test(l))
      return { shape: 'unsupported', value: '', items: [], span: span || 1 + following.length }
    }
    return { shape: 'scalar', value: unquote(inline), items: [], span: 1 }
  }

  // Nothing after the colon: either a block list or a nested map.
  const items: string[] = []
  let span = 1
  for (const line of following) {
    if (line.trim() === '') break
    if (!/^\s/.test(line)) break
    const item = line.match(BLOCK_ITEM)
    if (!item) return { shape: 'unsupported', value: '', items: [], span }
    items.push(unquote(item[1] ?? ''))
    span += 1
  }
  if (items.length === 0) return { shape: 'scalar', value: '', items: [], span: 1 }
  return { shape: 'list', value: '', items, span }
}

/** Every top-level key in the block, in the order the file writes them. */
export function readProperties(content: string): PropertyEntry[] {
  const parsed = frontmatterLines(content)
  if (!parsed) return []

  const entries: PropertyEntry[] = []
  for (let index = 0; index < parsed.lines.length; index += 1) {
    const match = parsed.lines[index]!.match(KEY_LINE)
    if (!match) continue
    const rest = classify(match[2], parsed.lines.slice(index + 1))
    entries.push({ key: match[1]!, line: index, ...rest })
    index += rest.span - 1
  }
  return entries
}

export function readProperty(content: string, key: string): PropertyEntry | null {
  const lower = key.toLowerCase()
  return readProperties(content).find(entry => entry.key.toLowerCase() === lower) ?? null
}

// ---- writing --------------------------------------------------------------

/** Quote only when the value would otherwise parse as something else. */
function renderScalar(value: string): string {
  if (value === '') return "''"
  if (/^[\s]|[\s]$|^[-?:,[\]{}#&*!|>'"%@`]|: |#/.test(value)) {
    return `'${value.replace(/'/g, "''")}'`
  }
  return value
}

function renderLines(key: string, value: string | string[]): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${key}: []`]
    return [`${key}:`, ...value.map(item => `  - ${renderScalar(item)}`)]
  }
  return [`${key}: ${renderScalar(value)}`]
}

function rebuild(content: string, mutate: (lines: string[]) => void): string {
  const [block, body] = splitFrontmatter(content)
  const crlf = block.includes('\r\n')
  const lines = block.replace(/\r\n/g, '\n').split('\n')
  const close = lines.lastIndexOf('---')
  const inner = lines.slice(1, close)

  mutate(inner)

  const rebuilt = ['---', ...inner, '---', ''].join('\n')
  return (crlf ? rebuilt.replace(/\n/g, '\r\n') : rebuilt) + body
}

/**
 * A file with no frontmatter gets one, which is the only case where this
 * function adds bytes above the body rather than rewriting bytes inside it.
 */
function withEmptyBlock(content: string): string {
  return `---\n---\n${content.startsWith('\n') ? content.slice(1) : content}`
}

/**
 * Set a key, adding it at the end of the block if it is new.
 *
 * Returns the content unchanged when the key exists in a form we refuse to
 * rewrite — the caller should not have offered an editor for it.
 */
export function writeProperty(content: string, key: string, value: string | string[]): string {
  const source = splitFrontmatter(content)[0] ? content : withEmptyBlock(content)
  const existing = readProperty(source, key)
  if (existing?.shape === 'unsupported') return content
  // A name with a colon in it would be written as `a: b: value`, which reads
  // back as a *different* key — so a new key has to be one YAML can hold.
  if (!existing && !isPropertyKey(key)) return content

  return rebuild(source, lines => {
    const rendered = renderLines(existing?.key ?? key, value)
    if (existing) lines.splice(existing.line, existing.span, ...rendered)
    else lines.push(...rendered)
  })
}

/**
 * Rename a key, keeping its value and its position in the block.
 *
 * Deliberately not "remove then add": that would move the property to the
 * bottom of the frontmatter, so renaming a typo in `titel` would reshuffle a
 * file the user only meant to spell correctly.
 *
 * Refuses when the name is already taken, when the value is one we do not
 * rewrite, or when nothing would change — the caller gets the content back
 * unchanged and should treat that as a rejected rename.
 */
export function renamePropertyKey(content: string, from: string, to: string): string {
  const name = to.trim()
  if (!KEY_NAME.test(name)) return content

  const existing = readProperty(content, from)
  if (!existing || existing.shape === 'unsupported') return content
  if (existing.key === name) return content
  if (name.toLowerCase() !== from.toLowerCase() && readProperty(content, name)) return content

  const value = existing.shape === 'list' ? existing.items : existing.value
  return rebuild(content, lines => {
    lines.splice(existing.line, existing.span, ...renderLines(name, value))
  })
}

/** Remove a key and its continuation lines. Unknown keys are a no-op. */
export function removeProperty(content: string, key: string): string {
  const existing = readProperty(content, key)
  if (!existing || existing.shape === 'unsupported') return content
  return rebuild(content, lines => {
    lines.splice(existing.line, existing.span)
  })
}
