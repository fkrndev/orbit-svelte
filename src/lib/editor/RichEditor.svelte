<script lang="ts">
  import { untrack } from 'svelte'
  import { Edra } from '@/components/edra/shadcn'
  import { useEditor } from '@/components/edra/tiptap/index'
  import { api } from '@/rpcClient'
  import { getState, notify, setState } from '@/store.svelte'
  import { assetNameForUpload, assetStamp } from '$shared/assets'
  import { toDisplayUrl } from './assetUrls'
  import RichToolbar from './RichToolbar.svelte'
  import { richExtensions } from './richExtensions'
  import { refItemLoader } from './refItemLoader'
  import { bodyForEditor, serializeRichEditorDocument } from './richEditorMarkdown'
  import { onGotoHeading } from './gotoHeading'
  import { attachFindHighlight } from './richEditorFindHighlight'
  import { buildRichFindIndex, collectFindRuns, richFindEngine } from './richFindEngine'
  import type { RichFindIndex } from './richEditorFindIndex'
  import { richTodoEngine } from './richTodoEngine'
  import { registerFindEngine, unregisterFindEngine } from '@/find'
  import { registerTodoEngine, unregisterTodoEngine } from '@/todoEngine'
  import './editor.css'

  /**
   * The rich editor: Edra over Tiptap, showing the file as prose.
   *
   * Frontmatter never reaches it — `bodyForEditor` slices it off on the way in
   * and `richEditorMarkdown` re-attaches it verbatim on the way out, so the YAML
   * block cannot be reordered or reflowed by a serializer that does not
   * understand it. `__tests__/roundTrip.test.ts` is what holds that.
   */
  let {
    path,
    content,
    onChange,
    onEditIntent,
  }: {
    path: string
    content: string
    onChange: (markdown: string) => void
    onEditIntent: () => void
  } = $props()

  /**
   * A pasted or dropped image is written next to the note and linked
   * relatively, so the note travels with its pictures. The editor shows it
   * through a URL it can actually fetch; the *file* gets the relative path back
   * on serialize — see `assetUrls.ts`.
   */
  async function onFileUpload(file: File): Promise<string> {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error)
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
      reader.readAsDataURL(file)
    })

    // A clipboard image calls itself `image.png` every single time, so the name
    // is decided here rather than taken on trust — see `shared/assets.ts`.
    const name = assetNameForUpload(
      path.slice(path.lastIndexOf('/') + 1),
      file.name,
      file.type,
      assetStamp(new Date()),
    )

    try {
      const saved = await api.saveAsset({ notePath: path, name, base64 })
      return toDisplayUrl(path, saved.relative)
    } catch (error) {
      notify('error', `Could not save ${file.name}: ${String(error)}`)
      throw error
    }
  }

  /*
   * `useEditor` with our own list, rather than Edra's `createEditor`.
   *
   * `createEditor` builds its list and *appends* whatever you pass, so handing
   * it `richExtensions()` registered every extension twice — Tiptap warned
   * about the duplicate names and ProseMirror then refused the second copy of a
   * keyed plugin outright. One list, owned here, is also what lets the
   * round-trip test assert against the same schema the app runs.
   *
   * `content` seeds the document and is deliberately read untracked: the editor
   * owns it from here on, and re-seeding on every keystroke would fight the
   * caret. External changes are pushed in by the effect below instead.
   */
  const editor = useEditor({
    // `/` → "Link to file" opens the same picker ⌘K does, against *this* file:
    // the link is relative, so it is only meaningful next to the note it is
    // written into. The component is keyed on the path, so this closure cannot
    // go stale.
    extensions: richExtensions({
      onFileUpload,
      onLinkFile: () => setState({ linkFile: { path } }),
      // Pasted markdown carries images the same way the file does — relative to
      // this note. See `markdownPaste.ts`. Read untracked like `content` below:
      // the component is keyed on the path, so a different file is a different
      // editor, and a tracked read here only invites a re-run that rebuilds the
      // extension list under a live document.
      notePath: untrack(() => path),
      // `#` and `@` complete against what the vault already contains, so the
      // same tag keeps the same spelling — see `refSuggestionItems.ts`.
      loadRefItems: refItemLoader(untrack(() => path)),
    }),
    // Seeded through the constructor rather than a mount effect. `setContent`
    // from inside an `$effect` wedged the page outright: it runs a transaction
    // storm while the surrounding component is still settling, and the two
    // never finished settling. The component is keyed on the file path, so a
    // different file gets a different editor anyway.
    content: untrack(() => bodyForEditor(content, path)),
    contentType: 'markdown',
  })

  /** What the editor last produced, so an external change can be told apart. */
  let lastSerialized = untrack(() => content)

  /*
   * The editor, reachable from a test harness — the same bargain as `__cmView`
   * in `codemirror.ts`. Synthetic key events do not reach a ProseMirror
   * contenteditable reliably, so an end-to-end check of "type, autosave, land on
   * disk" needs the editor itself.
   */
  let shell = $state<HTMLDivElement | null>(null)

  $effect(() => {
    // Captured, not read again in the teardown: `bind:this` has already been
    // set back to `null` by then, and deleting a property off null throws —
    // which took the whole unmount with it and left the surface blank after a
    // switch to source mode.
    const element = shell
    if (!element || !editor) return
    ;(element as unknown as { __editor?: unknown }).__editor = editor
    return () => {
      delete (element as unknown as { __editor?: unknown }).__editor
    }
  })

  $effect(() => {
    if (!editor) return

    const handleUpdate = () => {
      /*
       * The whole *file*, not the body.
       *
       * Serializing the body alone dropped the frontmatter on the first
       * autosave: the editor never sees the YAML block, so a body-only string
       * is a file with the block deleted. It also never matched `content`, so
       * every file marked itself dirty the moment it opened and rewrote itself
       * a second later. The block is read back from the tab's own buffer and
       * re-attached verbatim — see `richEditorMarkdown.ts`.
       */
      const markdown = serializeRichEditorDocument(editor, content, path)
      // The serializer normalises, so an untouched document can come back
      // spelled slightly differently. Reporting that as an edit would mark
      // every file dirty the moment it opened.
      if (markdown === lastSerialized) return
      lastSerialized = markdown
      onEditIntent()
      onChange(markdown)
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  })

  /**
   * ⌘K, from `LinkFileDialog`. A relative markdown link, exactly as in source
   * mode — the mark is what the serializer turns back into `[text](href)`.
   */
  $effect(() => {
    const onInsert = (event: Event) => {
      const { href, text } = (event as CustomEvent<{ href: string; text: string }>).detail
      editor
        ?.chain()
        .focus()
        .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
        .run()
    }
    window.addEventListener('app:insert-link', onInsert)
    return () => window.removeEventListener('app:insert-link', onInsert)
  })

  // The table of contents speaks in headings; here they are nodes rather than
  // lines, so the nth heading is found by walking the document.
  $effect(() =>
    onGotoHeading(heading => {
      if (!editor) return
      let seen = 0
      let target: number | null = null
      editor.state.doc.descendants((node, pos) => {
        if (target !== null) return false
        if (node.type.name !== 'heading') return true
        if (seen === heading.index) target = pos
        seen += 1
        return false
      })
      if (target === null) return
      editor.commands.focus(target + 1)
    }),
  )

  /*
   * Find, over the *rendered* prose.
   *
   * The trigger is the flattened *text*, not the transaction count. Painting a
   * highlight is itself a transaction, so re-registering on every update meant
   * register -> search -> highlight -> update -> register, and the page locked
   * up hard enough that even evaluating an expression in it timed out. Text is
   * the honest dependency anyway: a match list is only meaningful against the
   * string it was computed from.
   */
  /*
   * The two pieces of formatting chrome, both settings — see `shared/types.ts`
   * for why the defaults point opposite ways. Read here rather than passed in
   * because the surface that renders this component has no opinion about them:
   * they are the editor's own furniture.
   */
  const readOnly = $derived(getState().settings.readOnly)

  /*
   * Both are suppressed outright while reading, not disabled.
   *
   * A toolbar of greyed-out buttons is a row of things you have to read before
   * discovering you cannot use any of them, and a bubble menu that appears over
   * every selection is actively in the way of the one thing reading mode is
   * for — selecting text to copy it.
   */
  const toolbarOpen = $derived(getState().settings.editorToolbarOpen && !readOnly)
  const bubbleMenuOpen = $derived(getState().settings.editorBubbleMenuOpen && !readOnly)

  /**
   * The document itself. Tiptap keeps `editable` on the view, so this is a
   * command rather than an option — and it is what takes away the caret, the
   * drag handles, and the checkbox clicks all at once.
   */
  $effect(() => {
    // `emitUpdate: false`. Flipping the flag changes no text, and letting it
    // fire `update` would run the whole serialize-and-compare path — the one
    // that decides whether a file is dirty — for a change to the chrome.
    editor?.setEditable(!readOnly, false)
  })

  let findIndex: RichFindIndex | null = null
  let findText = $state('')

  function syncFindIndex() {
    if (!editor) return
    const index = buildRichFindIndex(collectFindRuns(editor.state.doc))
    findIndex = index
    // Assigning the same string is a no-op, which is what breaks the cycle.
    findText = index.text
  }

  $effect(() => {
    if (!editor) return
    syncFindIndex()
    const onUpdate = () => syncFindIndex()
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  })

  /*
   * Registered through Tiptap rather than by reconfiguring the view directly.
   * Edra's editor caches its own `state`, and a plugin list changed behind its
   * back leaves the two disagreeing — the decorations then never paint.
   */
  $effect(() => {
    if (!editor) return
    return attachFindHighlight(editor)
  })

  /*
   * The Todos panel's hands, for Home's task rows and the inspector's tab. Only
   * one engine exists at a time — the surface tears this editor down when it
   * switches to source — and the registration is untracked for the same reason
   * the find one is.
   */
  $effect(() => {
    if (!editor) return
    const engine = richTodoEngine(() => editor)
    untrack(() => registerTodoEngine(engine))
    return () => unregisterTodoEngine(engine)
  })

  $effect(() => {
    void findText
    const index = findIndex
    if (!editor || !index) return
    const engine = richFindEngine(() => editor?.view ?? null, index)
    untrack(() => registerFindEngine(engine))
    return () => unregisterFindEngine(engine)
  })
</script>

<Edra {editor}>
  <div class="flex h-full min-h-0 flex-col">
    <!--
      The toolbar is its own strip rather than the first child of the scroll
      area. Edra sizes it `h-full`, which inside a scrolling column meant it
      claimed the whole height and centred its buttons halfway down the page.
    -->
    {#if toolbarOpen}
      <div class="edra-toolbar-strip">
        <RichToolbar />
      </div>
    {/if}

    <div class="rich-editor-shell" bind:this={shell}>
      <!-- A handle for reordering blocks you cannot reorder is furniture. -->
      {#if !readOnly}
        <Edra.DragHandle />
      {/if}
      {#if bubbleMenuOpen}
        <Edra.BubbleMenu />
      {/if}
      <Edra.Content class="edra-content" />
    </div>
  </div>
</Edra>
