<script lang="ts">
  import { untrack } from 'svelte'
  import { EditorView } from '@codemirror/view'
  import { codemirror, setReadOnly, syncDocument } from './codemirror'
  import { getState } from '@/store.svelte'
  import { onGotoHeading } from './gotoHeading'
  import { codeMirrorFindEngine } from './codeMirrorFindEngine'
  import { codeMirrorTodoEngine } from './codeMirrorTodoEngine'
  import { registerFindEngine, unregisterFindEngine } from '@/find'
  import { registerTodoEngine, unregisterTodoEngine } from '@/todoEngine'
  import './editor.css'

  /**
   * The raw markdown editor: a CodeMirror view over the file exactly as it is on
   * disk, frontmatter included.
   *
   * This is the escape hatch. Whenever the rich editor's model of a document is
   * wrong, or a file uses syntax the schema does not model, the user can drop to
   * source and the bytes are the bytes.
   *
   * The CodeMirror setup and its extensions (markdown + YAML frontmatter
   * highlighting, arrow ligatures, zoom cursor fix) are lifted unchanged; only
   * the wrapper is Svelte — see `codemirror.ts`.
   */
  let {
    content,
    onChange,
    onEditIntent,
    onSave,
  }: {
    content: string
    onChange: (markdown: string) => void
    onEditIntent: () => void
    onSave: () => void
  } = $props()

  let view = $state<EditorView | null>(null)
  const read = () => view

  /**
   * The file changing anywhere other than in this editor — a reload from disk, a
   * frontmatter edit from the inspector — reaches the document here.
   *
   * `view` is `$state` so this effect re-runs once the action has mounted; on
   * the first pass there is nothing to sync into yet.
   */
  $effect(() => {
    if (view) syncDocument(view, content)
  })

  /**
   * Reading mode. Pushed in the same way `content` is — a reconfigure on the
   * live view rather than a prop the action rebuilds — because the view is
   * created once and outlives every change to this flag.
   */
  const readOnly = $derived(getState().settings.readOnly)

  $effect(() => {
    if (view) setReadOnly(view, readOnly)
  })

  /**
   * ⌘K, from `LinkFileDialog`. A **relative markdown link** — readable by
   * GitHub, by `cat`, by anything. The dialog has already worked out the
   * relative path; this only has to put it where the caret is.
   */
  $effect(() => {
    const onInsert = (event: Event) => {
      const { href, text } = (event as CustomEvent<{ href: string; text: string }>).detail
      if (!view) return
      const { from, to } = view.state.selection.main
      const insert = `[${text}](${href})`
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
      })
      view.focus()
    }
    window.addEventListener('app:insert-link', onInsert)
    return () => window.removeEventListener('app:insert-link', onInsert)
  })

  $effect(() =>
    onGotoHeading(heading => {
      if (!view) return
      // Line numbers here are the file's, frontmatter included, which is
      // exactly what this editor shows.
      const line = view.state.doc.line(Math.min(heading.line + 1, view.state.doc.lines))
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 24 }),
      })
      view.focus()
    }),
  )

  // Here the searchable text is the document itself, so the engine is rebuilt
  // — and the match list refreshed — on every keystroke.
  /*
   * `untrack` around the registration, and it is load bearing.
   *
   * `registerFindEngine` runs a search, which reads *and writes* the find state.
   * Read inside the effect body those become dependencies, so the write
   * re-invalidates the effect that made it and the two spin: the bar redrew
   * hundreds of times a second and never settled on the query being typed into
   * it. Only `content` should re-register the engine.
   */
  $effect(() => {
    const engine = codeMirrorFindEngine(read, content)
    untrack(() => registerFindEngine(engine))
    return () => unregisterFindEngine(engine)
  })

  // Here a task is just a line, so the panel's edits are ordinary CodeMirror
  // dispatches — one undo step each, and the change flows out through
  // `onDocChange` exactly as typing does.
  $effect(() => {
    const engine = codeMirrorTodoEngine(read)
    untrack(() => registerTodoEngine(engine))
    return () => unregisterTodoEngine(engine)
  })
</script>

<div
  class="raw-editor-shell"
  use:codemirror={{
    content,
    onView: next => (view = next),
    onDocChange: doc => {
      onEditIntent()
      onChange(doc)
    },
    onCursorActivity: () => {},
    onSave,
    // Nothing here owns Escape — returning false lets it bubble so the app's
    // overlays can close.
    onEscape: () => false,
  }}
></div>
