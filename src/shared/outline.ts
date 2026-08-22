import { splitFrontmatter } from './frontmatter'

/**
 * The document's headings, in reading order.
 *
 * Read from the markdown rather than from the rendered DOM, so the outline is
 * the same in the rich editor and the raw one, and exists before either has
 * mounted.
 */
export interface Heading {
  /** 1–6. */
  level: number
  text: string
  /** 0-based line in the whole file, which is what the raw editor scrolls to. */
  line: number
  /** Position among all headings, which is how the rich editor finds the block. */
  index: number
}

export const FENCE = /^\s{0,3}(```|~~~)/
const ATX = /^(#{1,6})\s+(.*)$/

/**
 * How many lines of the file the frontmatter occupies.
 *
 * Every scanner that reports a *file* line has to add this back, because they
 * all read the body with the YAML block sliced off.
 */
export function bodyLineOffset(frontmatter: string): number {
  return frontmatter ? frontmatter.replace(/\r\n/g, '\n').split('\n').length - 1 : 0
}

/** Strip the inline markup that would otherwise be read aloud in the outline. */
export function plain(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/([*_]{1,3})(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/==(.+?)==/g, '$1')
    // A trailing `###` is the closing half of a closed ATX heading, not text.
    .replace(/\s+#+\s*$/, '')
    .trim()
}

export function outline(content: string): Heading[] {
  const [frontmatter] = splitFrontmatter(content)
  const offset = bodyLineOffset(frontmatter)
  const body = content.slice(frontmatter.length).replace(/\r\n/g, '\n').split('\n')

  const headings: Heading[] = []
  let fence: string | null = null

  for (let i = 0; i < body.length; i += 1) {
    const line = body[i]!

    // A `#` inside a code block is a comment or a shell prompt, not a heading.
    const fenceMatch = line.match(FENCE)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]!
      else if (line.trimStart().startsWith(fence)) fence = null
      continue
    }
    if (fence !== null) continue

    const match = line.match(ATX)
    if (!match) continue
    const text = plain(match[2]!)
    if (!text) continue

    headings.push({
      level: match[1]!.length,
      text,
      line: offset + i,
      index: headings.length,
    })
  }

  return headings
}

/**
 * Indent relative to the shallowest heading present, so a document that starts
 * at `##` is not permanently pushed one step right for no reason.
 */
export function outlineDepth(headings: Heading[], heading: Heading): number {
  const shallowest = Math.min(...headings.map(h => h.level))
  return heading.level - shallowest
}
