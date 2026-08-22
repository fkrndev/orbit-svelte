import { Extension, type JSONContent } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { preProcessAssetMarkdown } from './assetUrls'

/**
 * Pasted markdown, rendered as prose.
 *
 * Tiptap parses the *file* as markdown but the *clipboard* as HTML or plain
 * text, so `## Notes` pasted from a terminal, a `.md` file, or a chat reply
 * landed in the document as the literal characters `## Notes`. In an app whose
 * documents are markdown that is the wrong default: the same string means a
 * heading one way in and a hash the other.
 *
 * The rule this settles on — and the reason it is small — comes from reading the
 * two editors that do this well:
 *
 * - **Lexical** never lets markdown near the clipboard. Its paste path is a
 *   strict priority list: its own slice, then `text/html`, then plain text
 *   inserted verbatim. HTML paste is where its fidelity lives (that is why a
 *   pasted checklist survives), and nothing is allowed to shadow it.
 * - **markdown-local**, this app's React ancestor, has no markdown paste either,
 *   but its *load* path is a hardened pipeline: preprocess, parse, and — if the
 *   parse throws or comes back empty — fall back to showing every byte as plain
 *   text rather than a blank document.
 *
 * So: the same priority list, with markdown slotted in at the one rung Lexical
 * leaves empty — plain text — plus markdown-local's rule that a failed parse
 * degrades to the native paste rather than eating the clipboard. Rich HTML
 * paste is untouched, which is the behaviour that was already good.
 */

export interface MarkdownPasteOptions {
  /**
   * The note being edited, for images. Pasted `![](assets/shot.png)` is
   * relative to the *note*, and the editor can only fetch an absolute URL — the
   * same rewrite `bodyForEditor` does on open, and which `serializeRichEditorDocument`
   * undoes on save. See `assetUrls.ts`.
   *
   * Absent in the headless round-trip test, which has no editor to show an
   * image in; the rewrite is then skipped and the markdown parses unchanged.
   */
  notePath?: string
}

/*
 * No lookbehind anywhere in this file.
 *
 * These run in whatever WebKit the desktop shell was built against, and a
 * regex literal with `(?<=` is a *parse* error rather than a runtime one — it
 * takes the whole module down on load, not the one paste that used it. Every
 * boundary below is expressed with an explicit character class instead.
 */

/** Block-level markdown: the shapes that only ever mean markup. */
const BLOCK_SIGNALS = [
  /^ {0,3}#{1,6}[ \t]+\S/m, // # Heading
  /^ {0,3}(?:```|~~~)/m, // fenced code
  /^ {0,3}>[ \t]/m, // > quote
  /^[ \t]*[-*+][ \t]+\S/m, // - bullet (and - [ ] task)
  /^[ \t]*\d{1,9}[.)][ \t]+\S/m, // 1. ordered
  /^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/m, // thematic break
]

/** Inline markdown, for a paste that is a sentence rather than a document. */
const INLINE_SIGNALS = [
  /\*\*[^\s*][^*]*\*\*/, // **bold**
  /!?\[[^\]\n]*\]\([^()\s]+\)/, // [link](url) and ![image](url)
  /`[^`\n]+`/, // `code`
  /~~[^~\n]+~~/, // ~~strike~~
]

/** A table needs two rows to be a table; one pipe is a pipe. */
function hasTableRows(text: string): boolean {
  let rows = 0
  for (const line of text.split('\n')) {
    if (/^[ \t]*\|.*\|[ \t]*$/.test(line)) rows += 1
    if (rows >= 2) return true
  }
  return false
}

/**
 * Is this plain text worth parsing as markdown?
 *
 * Deliberately a syntax test rather than "does it parse" — *everything* parses
 * as markdown, so a parse can only ever say yes. The question that matters is
 * whether the author typed markup, and the answer has to be no for the ordinary
 * case of pasting a paragraph of prose, or every paste would round-trip through
 * a serializer for nothing.
 *
 * A known false positive: source code pasted into a paragraph, where `# ` is a
 * comment rather than a heading. Pasting into a code block is already excluded
 * (`isLiteralContext`), and ⇧⌘V still pastes verbatim, so the escape hatches
 * exist — but this is the trade, and it is the one every markdown editor makes.
 */
export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  // A bare URL is a link, and Tiptap's own paste handling already makes it one
  // — with the selected text kept as the label, which markdown cannot express.
  if (!/\s/.test(trimmed) && /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false

  if (BLOCK_SIGNALS.some(pattern => pattern.test(text))) return true
  if (INLINE_SIGNALS.some(pattern => pattern.test(text))) return true
  return hasTableRows(text)
}

/**
 * Tags that carry meaning of their own. Anything here means the clipboard's
 * HTML is the better source and this extension must keep its hands off it.
 *
 * The inverse — a fixed allow-list — is what makes this safe. An unknown tag
 * counts as formatting, so a clipboard flavour nobody anticipated falls through
 * to the native path rather than being flattened into text.
 */
const PLAIN_CARRIER_TAGS = new Set([
  'html',
  'head',
  'body',
  'meta',
  'title',
  'style',
  'div',
  'span',
  'p',
  'br',
  'font',
])

/**
 * Does this `text/html` say anything the plain text does not?
 *
 * Code editors are the reason this exists. Copy markdown out of VS Code and the
 * clipboard carries HTML — but it is `<div><span style="color:#…">` around the
 * very same characters, syntax colouring and nothing else. Honouring it would
 * mean the one source people copy raw markdown *from* is the one source that
 * pastes as literal text.
 *
 * A real document — a heading, a list, a link, a `<pre>` — is left alone.
 */
export function isPlainTextCarrier(html: string): boolean {
  const trimmed = html.trim()
  if (!trimmed) return true

  // ProseMirror stamps its own copies. An internal copy/paste is already
  // lossless and must stay that way, whatever its text happens to look like.
  if (trimmed.includes('data-pm-slice')) return false

  let body: HTMLElement | null = null
  try {
    body = new DOMParser().parseFromString(trimmed, 'text/html').body
  } catch {
    return false
  }
  if (!body) return false

  for (const element of body.querySelectorAll('*')) {
    if (!PLAIN_CARRIER_TAGS.has(element.tagName.toLowerCase())) return false
  }
  return true
}

/**
 * Places where markdown is text and must stay text: a code block, a fenced
 * mermaid diagram, an inline `code` span. Pasting a shell script into a code
 * block and getting headings back would be a bug with no workaround.
 */
export function isLiteralContext(state: EditorState): boolean {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.spec.code) return true
  }
  const code = state.schema.marks.code
  if (code && code.isInSet(state.storedMarks ?? $from.marks())) return true
  return false
}

/**
 * `{ type: 'doc' }` -> what to hand `insertContent`.
 *
 * A single paragraph is unwrapped to its inline content on purpose. Inserted as
 * a *block* it splits whatever paragraph the caret is in — paste `**done**` mid
 * sentence and the sentence breaks in three. Its children are inline nodes,
 * which merge at the caret the way typing does. Anything taller than one
 * paragraph is block content and is inserted as-is.
 */
export function pasteContentFromDoc(doc: JSONContent): JSONContent[] | null {
  const blocks = doc.content ?? []
  if (blocks.length === 0) return null
  if (blocks.length === 1 && blocks[0].type === 'paragraph') {
    const inline = blocks[0].content ?? []
    return inline.length > 0 ? inline : null
  }
  return blocks
}

/** True when the browser reports the paste was made with shift held. */
function isPlainPaste(view: EditorView): boolean {
  // `input` is ProseMirror's own record of the keys in play; it is what the
  // library itself reads to decide whether ⇧⌘V means "paste without
  // formatting". Reading it here is what keeps that shortcut an escape hatch
  // rather than something this extension quietly overrides.
  const input = (view as unknown as { input?: { shiftKey?: boolean } }).input
  return input?.shiftKey === true
}

export const MarkdownPaste = Extension.create<MarkdownPasteOptions>({
  name: 'markdownPaste',

  addOptions() {
    return { notePath: undefined }
  },

  addProseMirrorPlugins() {
    const { editor } = this
    const notePath = this.options.notePath

    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste: (view, event) => {
            if (!view.editable) return false

            const clipboard = event.clipboardData
            if (!clipboard) return false
            // An image paste is the uploader's, not ours.
            if (clipboard.files.length > 0) return false
            if (isPlainPaste(view)) return false

            const text = clipboard.getData('text/plain') || clipboard.getData('Text')
            if (!text.trim()) return false
            if (!isPlainTextCarrier(clipboard.getData('text/html'))) return false
            if (isLiteralContext(view.state)) return false
            if (!looksLikeMarkdown(text)) return false

            const manager = editor.storage.markdown?.manager
            if (!manager) return false

            let content: JSONContent[] | null = null
            try {
              const markdown = notePath ? preProcessAssetMarkdown(notePath, text) : text
              content = pasteContentFromDoc(manager.parse(markdown))
            } catch (error) {
              // markdown-local's rule: a parse that fails must not cost the
              // user their clipboard. Falling through hands the paste back to
              // ProseMirror, which inserts the text verbatim.
              console.warn('[editor] pasting as plain text, markdown did not parse:', error)
              return false
            }
            if (!content) return false

            editor.commands.insertContent(content)
            return true
          },
        },
      }),
    ]
  },
})
