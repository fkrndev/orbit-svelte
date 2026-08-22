import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import type { FindHighlightState } from './editorFindHighlight'

/**
 * The rich editor's half of find highlighting.
 *
 * Same job as `editorFindHighlight`, different engine: ProseMirror decorations
 * rather than CodeMirror ones, carried on transaction metadata. The CSS classes
 * are deliberately shared, so a match looks identical in both editors.
 *
 * The plugin is added to the live view by reconfiguring its state rather than
 * declared up front, because BlockNote owns the editor's construction and we
 * only need this while the find bar is open.
 */

const findHighlightKey = new PluginKey<DecorationSet>('markdownLocalFindHighlight')

function buildDecorations(docSize: number, state: FindHighlightState): Decoration[] {
  return state.ranges.flatMap((range, index) => {
    if (range.from >= range.to || range.to > docSize) return []
    return [Decoration.inline(range.from, range.to, {
      class: index === state.active ? 'editor-find-match editor-find-match--active' : 'editor-find-match',
    })]
  })
}

function createFindHighlightPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: findHighlightKey,
    state: {
      init: () => DecorationSet.empty,
      apply(transaction, decorations, _oldState, newState) {
        const next = transaction.getMeta(findHighlightKey) as FindHighlightState | undefined
        if (next) return DecorationSet.create(newState.doc, buildDecorations(newState.doc.content.size, next))
        return decorations.map(transaction.mapping, transaction.doc)
      },
    },
    props: {
      decorations(state) {
        return findHighlightKey.getState(state)
      },
    },
  })
}

/**
 * The slice of the editor this needs. Narrowed so the module stays free of a
 * Tiptap import — the decorations are ProseMirror's, and nothing here cares
 * which library owns the view.
 */
interface PluginHost {
  view: EditorView
  registerPlugin(plugin: Plugin): unknown
  unregisterPlugin(key: PluginKey): unknown
}

/**
 * Adds the plugin to a running editor, returning a function that takes it back
 * out. The document and the selection are preserved — only the plugin list
 * changes.
 *
 * Registered through the *editor* rather than by reconfiguring its view
 * directly: Edra caches the editor state on the instance, so a plugin list
 * changed behind its back leaves the cache and the view disagreeing, and the
 * decorations never reach the screen.
 */
export function attachFindHighlight(editor: PluginHost): () => void {
  if (editor.view.isDestroyed || findHighlightKey.get(editor.view.state)) return () => {}

  editor.registerPlugin(createFindHighlightPlugin())

  return () => {
    // Switching editors tears the view down before this cleanup runs, and
    // reconfiguring a destroyed view throws — taking the unmount, and the
    // component tree above it, with it.
    if (editor.view.isDestroyed) return
    editor.unregisterPlugin(findHighlightKey)
  }
}

export function paintFindHighlights(view: EditorView, state: FindHighlightState): void {
  if (view.isDestroyed || !findHighlightKey.get(view.state)) return
  view.dispatch(view.state.tr.setMeta(findHighlightKey, state))
}
