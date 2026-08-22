import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { scanRefsInText } from '$shared/inlineRefs'
import { activeSuggestionRange } from './refSuggestion'

/**
 * `#tag` and `@mention`, drawn as pills in the rich editor.
 *
 * Decorations, not nodes. A node would have to be parsed out of the markdown on
 * open and serialized back on save, and the first time those two disagreed the
 * file would quietly change shape — a tag becoming `\#tag`, or a mention landing
 * inside a link. Decorations touch nothing: the document holds the literal
 * characters the file holds, and this only paints over them. Deleting the `#`
 * un-tags it, because that is exactly what it does to the file.
 *
 * The classes are shared with the source editor (`inlineRefHighlight.ts`), so a
 * tag looks the same in both — the same bargain as find highlighting.
 */

/** Stands in for an inline atom: not whitespace, not a label character. */
const PLACEHOLDER = '\ufffc'

const inlineRefKey = new PluginKey<DecorationSet>('orbitInlineRefs')

/**
 * A block's inline content flattened to a string, with a doc position for every
 * character in it.
 *
 * Built rather than taken from `textBetween` because every offset the scanner
 * reports has to come back as a *document position*, and the two only line up
 * while nothing between them is a node of its own. Two details it buys:
 *
 * - Text under a `code` mark is blanked to spaces, so `` `#nope` `` is not a tag
 *   while the characters after it keep their positions.
 * - An inline atom — an image, an inline formula — becomes one placeholder that
 *   is neither whitespace nor a label character, so it cannot start a ref or
 *   extend one that runs into it.
 *
 * Flattening the whole block rather than each text node is also what makes the
 * "preceded by whitespace" rule honest across a mark boundary: `**bold**#x` is
 * two text nodes, and scanning them separately would see `#x` at the start of
 * its own string and call it a tag.
 */
function flattenBlock(block: ProseMirrorNode, blockPos: number) {
  let text = ''
  const positions: number[] = []

  block.forEach((child, offset) => {
    const base = blockPos + 1 + offset

    if (child.isText) {
      const isCode = child.marks.some(mark => mark.type.name === 'code')
      const value = child.text ?? ''
      for (let i = 0; i < value.length; i += 1) {
        text += isCode ? ' ' : value[i]
        positions.push(base + i)
      }
      return
    }

    for (let i = 0; i < child.nodeSize; i += 1) {
      text += PLACEHOLDER
      positions.push(base + i)
    }
  })

  return { text, positions }
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    // A fenced block is code all the way down; nothing in it is a tag.
    if (node.type.spec.code) return false
    if (!node.isTextblock) return true

    const { text, positions } = flattenBlock(node, pos)
    if (!text.includes('#') && !text.includes('@')) return false

    for (const ref of scanRefsInText(text)) {
      const from = positions[ref.start]
      const last = positions[ref.end - 1]
      if (from === undefined || last === undefined) continue

      decorations.push(
        Decoration.inline(from, last + 1, { class: `inline-ref inline-ref--${ref.kind}` }),
        // The sigil is dimmed rather than hidden. It is a real character in the
        // file, and a pill that hides the one key you press to make it is a pill
        // people cannot work out how to type.
        Decoration.inline(from, from + 1, { class: 'inline-ref__sigil' }),
      )
    }

    return false
  })

  return DecorationSet.create(doc, decorations)
}

export const InlineRefDecorations = Extension.create({
  name: 'inlineRefDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: inlineRefKey,
        state: {
          init: (_config, state) => buildDecorations(state.doc),
          // Rebuilt only when the text changed. Mapping the old set forward
          // instead would keep a pill on `#draf` after the `t` is deleted, and
          // — worse — leave one behind on a word that is no longer a tag.
          apply: (transaction, decorations) =>
            transaction.docChanged ? buildDecorations(transaction.doc) : decorations,
        },
        props: {
          /*
           * The ref under an open `#`/`@` menu is dropped here rather than never
           * built, and that is deliberate: another plugin's state is only
           * readable once the whole state exists, which inside `apply` it does
           * not — the suggestion plugins are applied after this one, so asking
           * there returned nothing and the pill stayed split.
           *
           * Why drop it at all: the Suggestion plugin decorates its own active
           * range — the sigil up to the caret — and ProseMirror renders two
           * partly-overlapping inline decorations as *adjacent* spans rather
           * than nested ones. The pill was therefore sliced wherever the caret
           * happened to be, so putting the cursor inside `#asdf` drew `#`, `as`
           * and `df` as three separate chips.
           *
           * Unpilling it while the menu is open also reads better than it
           * sounds: a ref you have the caret in is one you are still typing, the
           * menu below already says so, and plain characters are easier to edit.
           * The pill is back the moment the caret leaves.
           */
          decorations(state) {
            const set = inlineRefKey.getState(state)
            const range = activeSuggestionRange(state)
            if (!set || !range) return set
            return set.remove(set.find(range.from, range.to))
          },
        },
      }),
    ]
  },
})
