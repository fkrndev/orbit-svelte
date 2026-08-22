/**
 * The document's checklist items, in reading order.
 *
 * Read from the markdown rather than from the rendered document, for the same
 * reasons as `outline.ts`: the list is identical in the rich editor and the raw
 * one, it exists before either has mounted, and it stays honest while you type
 * without anyone having to remember to invalidate it.
 *
 * This module only *reads*. Ticking an item off is an edit to the body of the
 * document, which — unlike frontmatter — the rich editor owns, so it has to go
 * through whichever editor is mounted. See `todoEngine.ts` for that half.
 */

import { splitFrontmatter } from './frontmatter'
import { FENCE, bodyLineOffset, outline, plain, type Heading } from './outline'

export interface TodoItem {
  /** Position among all checklist items, which is how the rich editor finds the block. */
  index: number
  /** 0-based line in the whole file, which is what the raw editor edits. */
  line: number
  text: string
  checked: boolean
  /** Nesting depth among checklist items; 0 is a top-level item. */
  depth: number
  /** The heading this item sits under, or `null` before the first heading. */
  section: Heading | null
}

/** A group of items under one heading, which is how the panel draws them. */
export interface TodoGroup {
  /** `null` for items that come before the document's first heading. */
  section: Heading | null
  items: TodoItem[]
  done: number
}

/**
 * A checklist line: `- [ ] thing`, `* [x] thing`, `+ [X] thing`.
 *
 * The marker and the box are required; the text is not, because a freshly
 * created empty item is a real state the panel has to be able to show.
 */
const TODO_LINE = /^(\s*)([-*+])\s+\[([ xX])\]\s?(.*)$/

/** Any list item, checklist or not — enough to know a list has not ended. */
const LIST_LINE = /^(\s*)(?:[-*+]|\d+[.)])\s+/

const ATX_LINE = /^\s{0,3}#{1,6}\s+/

/**
 * Depth from indentation, tracked as a stack rather than divided by two.
 *
 * Markdown nests lists by any consistent indent — two spaces, four, a tab — and
 * a document that uses four would come out twice as deep as it looks. What
 * matters is only that this line is further in than the one that contains it.
 */
class IndentStack {
  private stack: number[] = []

  reset() {
    this.stack = []
  }

  depthOf(indent: number): number {
    while (this.stack.length > 0 && indent < this.stack[this.stack.length - 1]!) this.stack.pop()
    if (this.stack.length === 0 || indent > this.stack[this.stack.length - 1]!) {
      this.stack.push(indent)
    }
    return this.stack.length - 1
  }
}

/** Tabs count as an indent step, not as one column. */
function indentWidth(prefix: string): number {
  let width = 0
  for (const char of prefix) width += char === '\t' ? 4 : 1
  return width
}

export function todos(content: string): TodoItem[] {
  const [frontmatter] = splitFrontmatter(content)
  const offset = bodyLineOffset(frontmatter)
  const body = content.slice(frontmatter.length).replace(/\r\n/g, '\n').split('\n')
  const headings = outline(content)

  const items: TodoItem[] = []
  const indents = new IndentStack()
  let fence: string | null = null
  let section: Heading | null = null
  let headingAt = 0

  for (let i = 0; i < body.length; i += 1) {
    const line = body[i]!

    // A `- [ ]` inside a code block is sample text, not a task.
    const fenceMatch = line.match(FENCE)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]!
      else if (line.trimStart().startsWith(fence)) fence = null
      continue
    }
    if (fence !== null) continue

    if (ATX_LINE.test(line)) {
      // Headings are matched by position: `outline()` skipped any whose text
      // was empty, so walking its list in step is what keeps them aligned.
      const heading = headings[headingAt]
      if (heading && heading.line === offset + i) {
        section = heading
        headingAt += 1
      }
      indents.reset()
      continue
    }

    const match = line.match(TODO_LINE)
    if (!match) {
      // A list ends at the first unindented line that is not part of one, and
      // the next list after it starts counting its nesting again from zero.
      if (line.trim() !== '' && !/^\s/.test(line) && !LIST_LINE.test(line)) indents.reset()
      continue
    }

    items.push({
      index: items.length,
      line: offset + i,
      text: plain(match[4]!),
      checked: match[3]!.toLowerCase() === 'x',
      depth: indents.depthOf(indentWidth(match[1]!)),
      section,
    })
  }

  return items
}

/**
 * The items, gathered under their headings.
 *
 * A heading with no items of its own is left out — the panel is a list of
 * tasks, and an outline of empty sections is what the outline tab is for.
 */
export function groupTodos(items: TodoItem[]): TodoGroup[] {
  const groups: TodoGroup[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.section === item.section) last.items.push(item)
    else groups.push({ section: item.section, items: [item], done: 0 })
  }
  for (const group of groups) group.done = group.items.filter(item => item.checked).length
  return groups
}

export function countDone(items: TodoItem[]): number {
  return items.filter(item => item.checked).length
}

// ---- editing ---------------------------------------------------------------

/**
 * Where a new task goes.
 *
 * Expressed as a position rather than a line number because the rich editor has
 * no lines — it finds the nth checklist item or the nth heading and inserts
 * after it. The raw editor turns the same anchor back into a line.
 */
export type TodoAnchor =
  | { at: 'todo'; index: number }
  | { at: 'heading'; index: number }
  | { at: 'end' }

/**
 * Where "add a task" in one group should land.
 *
 * After the group's last *top-level* item, so a new task joins the bottom of
 * the list at the level the list is written at. Anchoring on the last item
 * outright would make a new task a sibling of whatever happened to be nested
 * last — type one after a sub-task and it silently becomes another sub-task.
 *
 * A group whose heading has no items yet anchors on the heading itself.
 */
export function anchorForGroup(group: TodoGroup): TodoAnchor {
  if (group.items.length > 0) {
    const base = Math.min(...group.items.map(item => item.depth))
    for (let i = group.items.length - 1; i >= 0; i -= 1) {
      const item = group.items[i]!
      if (item.depth === base) return { at: 'todo', index: item.index }
    }
  }
  if (group.section) return { at: 'heading', index: group.section.index }
  return { at: 'end' }
}

/** Flip the box on one checklist line, leaving its indent and text untouched. */
export function toggleTodoLine(line: string): string {
  const match = line.match(TODO_LINE)
  if (!match) return line
  const box = match[3]!.toLowerCase() === 'x' ? ' ' : 'x'
  return `${match[1]}${match[2]} [${box}]${match[4] === '' ? '' : ` ${match[4]}`}`
}

/** A new checklist line, indented to sit alongside the item it follows. */
export function renderTodoLine(text: string, depth = 0): string {
  return `${'  '.repeat(depth)}- [ ] ${text.trim()}`
}
