import {
  Decoration,
  type DecorationSet,
  EditorView,
  lineNumbers,
  highlightActiveLine,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { frontmatterHighlightPlugin, frontmatterHighlightTheme } from './frontmatterHighlight'
import { markdownLanguage } from './markdownHighlight'
import { RUNTIME_STYLE_NONCE } from './runtimeStyleNonce'
import { resolveArrowLigatureInput } from './arrowLigatures'
import { zoomCursorFix } from './zoomCursorFix'
import { editorFindHighlight } from './editorFindHighlight'
import { inlineRefHighlight } from './inlineRefHighlight'
import { nativeTextAssistanceDisabledAttributes } from './nativeTextAssistance'

/**
 * CodeMirror 6, wired up as a Svelte action.
 *
 * The extension list below is the React build's, unchanged — CodeMirror does not
 * know or care which framework mounts it, so the port is entirely in the
 * wrapper. What was a `useEffect` keyed on a container ref is now `use:codemirror`
 * on the element itself, and the callbacks that used to live in a ref are read
 * through `params` at call time so a re-render never tears the view down.
 */

const FONT_FAMILY =
  '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

const RAW_EDITOR_COLORS = {
  activeLineBackground: 'var(--state-hover-subtle)',
  background: 'var(--surface-editor)',
  foreground: 'var(--text-primary)',
  gutterBackground: 'var(--surface-editor)',
  gutterBorder: 'var(--border-subtle)',
  gutterText: 'var(--text-muted)',
}

const AUTO_TEXT_DIRECTION_LINE = Decoration.line({ attributes: { dir: 'auto' } })

interface MarkdownFence {
  character: '`' | '~'
  length: number
}

export interface CodeMirrorCallbacks {
  onDocChange: (doc: string) => void
  onCursorActivity: (view: EditorView) => void
  onSave: () => void
  onEscape: () => boolean
}

export interface CodeMirrorParams extends CodeMirrorCallbacks {
  content: string
  /** Handed the live view on mount, and `null` on teardown. */
  onView: (view: EditorView | null) => void
}

function readMarkdownFence(line: string): MarkdownFence | null {
  const match = /^( {0,3})(`{3,}|~{3,})/.exec(line)
  if (!match) return null

  const fence = match[2]!
  return { character: fence[0] as MarkdownFence['character'], length: fence.length }
}

function isClosingMarkdownFence(line: string, opening: MarkdownFence): boolean {
  const match = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(line)
  if (!match) return false

  const fence = match[2]!
  return fence[0] === opening.character && fence.length >= opening.length
}

function isInsideMarkdownFence(markdownBeforeCursor: string): boolean {
  const lines = markdownBeforeCursor.split(/\r?\n/)
  let opening: MarkdownFence | null = null

  for (const line of lines) {
    if (opening) {
      if (isClosingMarkdownFence(line, opening)) opening = null
      continue
    }
    opening = readMarkdownFence(line)
  }

  return opening !== null
}

function buildBaseTheme() {
  return EditorView.theme({
    '&': {
      fontSize: '13px',
      fontFamily: FONT_FAMILY,
      backgroundColor: RAW_EDITOR_COLORS.background,
      color: RAW_EDITOR_COLORS.foreground,
      flex: '1',
      minHeight: '0',
    },
    '.cm-scroller': {
      fontFamily: FONT_FAMILY,
      lineHeight: '1.6',
      padding: '0',
      overflow: 'auto',
    },
    '.cm-content': {
      padding: '16px 32px 16px 12px',
      caretColor: RAW_EDITOR_COLORS.foreground,
    },
    '.cm-gutters': {
      backgroundColor: RAW_EDITOR_COLORS.gutterBackground,
      color: RAW_EDITOR_COLORS.gutterText,
      borderRight: `1px solid ${RAW_EDITOR_COLORS.gutterBorder}`,
      minHeight: '100%',
      paddingTop: '0',
      paddingLeft: '6px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      paddingRight: '12px',
      minWidth: '28px',
      textAlign: 'right',
    },
    '.cm-activeLine': { backgroundColor: RAW_EDITOR_COLORS.activeLineBackground },
    '.cm-activeLineGutter': { backgroundColor: RAW_EDITOR_COLORS.activeLineBackground },
    '&.cm-focused': { outline: 'none' },
    '.cm-line': { padding: '0', unicodeBidi: 'plaintext', textAlign: 'start' },
  })
}

function buildAutoTextDirectionDecorations(view: EditorView): DecorationSet {
  const ranges = []

  for (const visibleRange of view.visibleRanges) {
    for (let pos = visibleRange.from; pos <= visibleRange.to; ) {
      const line = view.state.doc.lineAt(pos)
      ranges.push(AUTO_TEXT_DIRECTION_LINE.range(line.from))
      pos = line.to + 1
    }
  }

  return Decoration.set(ranges, true)
}

function buildAutoTextDirectionExtension() {
  return [
    EditorView.perLineTextDirection.of(true),
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = buildAutoTextDirectionDecorations(view)
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = buildAutoTextDirectionDecorations(update.view)
          }
        }
      },
      { decorations: plugin => plugin.decorations },
    ),
  ]
}

function buildSaveKeymap(read: () => CodeMirrorCallbacks) {
  return Prec.highest(
    keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          read().onSave()
          return true
        },
      },
      { key: 'Escape', run: () => read().onEscape() },
    ]),
  )
}

function buildArrowLigaturesExtension() {
  let literalAsciiCursor: number | null = null

  return EditorView.inputHandler.of((view, from, _to, text) => {
    if (isInsideMarkdownFence(view.state.doc.sliceString(0, from))) {
      literalAsciiCursor = null
      return false
    }

    const beforeText = view.state.doc.sliceString(Math.max(0, from - 2), from)
    const resolution = resolveArrowLigatureInput({
      beforeText,
      cursor: from,
      inputText: text,
      literalAsciiCursor,
    })
    literalAsciiCursor = resolution.nextLiteralAsciiCursor

    if (!resolution.change) return false

    view.dispatch({
      changes: {
        from: resolution.change.from,
        to: resolution.change.to,
        insert: resolution.change.insert,
      },
      selection: { anchor: resolution.change.from + resolution.change.insert.length },
      userEvent: 'input.type',
    })
    return true
  })
}

/**
 * Views whose current transaction is an external sync rather than a user edit.
 *
 * `syncDocument` sets the flag so the update listener does not report the change
 * back out — that loop is how reloading a file ends up marking its tab dirty.
 */
const syncing = new WeakSet<EditorView>()

/**
 * Replaces the whole document, when the file changed somewhere other than in
 * this editor: a reload from disk, a frontmatter edit from the inspector.
 *
 * Deliberately *not* done from the action's `update`. The action re-runs
 * whenever its parameter object is rebuilt, and it was reverting freshly typed
 * text: one re-run arrived carrying a stale `content` and dispatched it straight
 * over the live document. Keeping the sync in an effect that reads `content` and
 * the view together means there is exactly one writer and it always compares the
 * two values it is actually reconciling.
 */
/**
 * Reading mode, reconfigured rather than baked into the initial state: the view
 * is created once per file and the mode is flipped under it.
 *
 * Both halves are needed and they are not the same thing. `EditorState.readOnly`
 * rejects transactions, which is the rule; `EditorView.editable` takes the
 * `contenteditable` away, which is what stops the caret from blinking in text
 * that will not accept a character. With only the first, the editor looks
 * writable and silently eats what you type.
 */
const editable = new Compartment()

export function setReadOnly(view: EditorView, readOnly: boolean) {
  view.dispatch({
    effects: editable.reconfigure([
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
    ]),
  })
}

export function syncDocument(view: EditorView, next: string) {
  const shown = view.state.doc.toString()
  if (shown === next) return
  syncing.add(view)
  try {
    view.dispatch({ changes: { from: 0, to: shown.length, insert: next } })
  } finally {
    syncing.delete(view)
  }
}

/**
 * `use:codemirror={params}`.
 *
 * The view is created once and never re-created. The parameter carries the
 * callbacks, read through `current` at call time so a re-render cannot tear the
 * view down — and carries the *initial* document only. See `syncDocument` for
 * why later content changes come from elsewhere.
 */
export function codemirror(parent: HTMLElement, params: CodeMirrorParams) {
  let current = params

  const state = EditorState.create({
    doc: current.content,
    extensions: [
      editable.of([EditorState.readOnly.of(false), EditorView.editable.of(true)]),
      lineNumbers(),
      highlightActiveLine(),
      EditorView.lineWrapping,
      buildAutoTextDirectionExtension(),
      history(),
      buildArrowLigaturesExtension(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      buildSaveKeymap(() => current),
      buildBaseTheme(),
      EditorView.cspNonce.of(RUNTIME_STYLE_NONCE),
      EditorView.contentAttributes.of(nativeTextAssistanceDisabledAttributes),
      markdownLanguage(),
      frontmatterHighlightTheme(),
      frontmatterHighlightPlugin,
      zoomCursorFix(),
      inlineRefHighlight(),
      editorFindHighlight(),
      EditorView.updateListener.of(update => {
        if (update.docChanged && !syncing.has(update.view)) {
          current.onDocChange(update.state.doc.toString())
        }
        if (update.selectionSet || update.docChanged) {
          current.onCursorActivity(update.view)
        }
      }),
    ],
  })

  const view = new EditorView({ state, parent })
  current.onView(view)

  // The view, reachable from a test harness. Driving CodeMirror through
  // synthetic key events is unreliable — the editor reads `beforeinput` from a
  // real composition — so an end-to-end check needs the view itself.
  ;(parent as unknown as { __cmView?: EditorView }).__cmView = view

  /*
   * When CSS zoom changes on the document, CodeMirror's cached measurements
   * (scaleX/scaleY, line heights, character widths) become stale because
   * ResizeObserver does not fire for ancestor zoom changes. Force a re-measure
   * so cursor placement stays accurate at any zoom level.
   */
  const handleZoomChange = () => view.requestMeasure()
  window.addEventListener('laputa-zoom-change', handleZoomChange)

  return {
    update(next: CodeMirrorParams) {
      current = next
    },
    destroy() {
      window.removeEventListener('laputa-zoom-change', handleZoomChange)
      delete (parent as unknown as { __cmView?: EditorView }).__cmView
      current.onView(null)
      view.destroy()
    },
  }
}
