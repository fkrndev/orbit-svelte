<script lang="ts">
  import { onMount } from 'svelte'
  import type { MenuCommand } from '$shared/rpc'

  import { getState, setState, activeTab, notify, updateTab } from '@/store.svelte'
  import { focusSidebarFilter, revealActiveFile, toggleBookmarkForPath } from '@/sidebar'
  import { api, onFileChange, onMenuCommand, onUpdateReady, isDesktop } from '@/rpcClient'
  import { goBack, goForward, trackNavigation } from '@/navigation'
  import { applyPaneVars } from '@/layout'
  import { applyTypography } from '@/typography'
  import { applyTheme, trackResolvedTheme } from '@/theme.svelte'
  import { applyThemeSkin } from '@/themeSkin'
  import {
    applyFolderMove,
    applyRename,
    bootstrap,
    browseTo,
    createFileBesideActive,
    openAnyPath,
    openFileDialog,
    openFolderDialog,
    reloadTab,
    saveActive,
    saveAllTabs,
    setSurface,
    startDelete,
    showInspectorTab,
    startRename,
    togglePanelSetting,
    toggleReadOnly,
    updateMeta,
  } from '@/actions'

  import TitleBar from '@/components/TitleBar.svelte'
  import Sidebar from '@/components/Sidebar.svelte'
  import EditorSurface from '@/components/EditorSurface.svelte'
  import Home from '@/components/Home.svelte'
  import InspectorPane from '@/components/InspectorPane.svelte'
  import QuickOpen from '@/components/QuickOpen.svelte'
  import LinkFileDialog from '@/components/LinkFileDialog.svelte'
  import IncomingLinksDialog from '@/components/IncomingLinksDialog.svelte'
  import ImagePreview from '@/components/ImagePreview.svelte'
  import FileBrowser from '@/components/FileBrowser.svelte'
  import PathPicker from '@/components/PathPicker.svelte'
  import Settings from '@/components/settings/Settings.svelte'
  import TabBar from '@/components/TabBar.svelte'
  import Notice from '@/components/Notice.svelte'
  import RenameDialog from '@/components/RenameDialog.svelte'
  import DeleteDialog from '@/components/DeleteDialog.svelte'
  import NewFolderDialog from '@/components/NewFolderDialog.svelte'
  import AddFolderDialog from '@/components/AddFolderDialog.svelte'
  import { Tooltip as TooltipPrimitive } from 'bits-ui'

  const ready = $derived(getState().ready)
  const surface = $derived(getState().surface)
  const settings = $derived(getState().settings)
  const sidebarOpen = $derived(settings.sidebarOpen)
  const inspectorOpen = $derived(settings.inspectorOpen)
  const tabBarOpen = $derived(settings.tabBarOpen)

  // `null` is closed; a string is the query it opens on, which is how a tag
  // chip on Home hands the palette a search rather than a blank field.
  let search = $state<string | null>(null)
  let settingsOpen = $state(false)

  const rename = $derived(getState().rename)
  const newFolder = $derived(getState().newFolder)
  const confirmDelete = $derived(getState().confirmDelete)
  const picker = $derived(getState().picker)
  const linkFile = $derived(getState().linkFile)
  const incomingLinks = $derived(getState().incomingLinks)
  const imagePreview = $derived(getState().imagePreview)

  /*
   * `onMount`, not `$effect` — and that distinction has teeth.
   *
   * `bootstrap()` reads the store while it runs (`hydrateTree`,
   * `resetNavHistory`). Inside an `$effect` those reads become dependencies, so
   * the effect re-ran on *every* store write: each keystroke restarted startup,
   * which re-read every open file from disk and overwrote the buffer with what
   * was still on the sector. The typing vanished about a second after it was
   * typed, and nothing failed.
   *
   * Anything one-shot that touches the store belongs here for the same reason.
   */
  onMount(() => {
    void bootstrap()
    // Started before the first navigation so the opening surface is recorded.
    return trackNavigation()
  })

  /*
   * The boot placeholder lives in `app.html` — static markup, so it is on
   * screen from the first frame instead of waiting for this bundle to parse.
   * Nothing else knows to take it away, so the shell does it once startup has
   * its settings, roots and restored tabs.
   */
  $effect(() => {
    if (ready) document.getElementById('boot')?.remove()
  })

  $effect(() => {
    applyTheme(settings.theme)
    trackResolvedTheme(settings.theme)
  })

  // The palette itself, as a stylesheet rather than a resolved set of values —
  // it carries both themes so the switch above still decides between them.
  // See `themeSkin.ts`.
  $effect(() => {
    applyThemeSkin(settings)
  })

  // Pane widths and reading typography both reach the page as CSS variables —
  // which is also how a drag moves a pane mid-gesture. See `layout.ts` and
  // `typography.ts`.
  $effect(() => {
    applyPaneVars(settings)
    applyTypography(settings)
  })

  function runCommand(command: MenuCommand) {
    switch (command) {
      case 'new-file':
        void createFileBesideActive()
        break
      case 'open-file':
        void openFileDialog()
        break
      case 'open-folder':
        void openFolderDialog()
        break
      case 'save':
        void saveActive()
        break
      case 'rename-file': {
        const tab = activeTab()
        if (tab) startRename(tab.path)
        break
      }
      case 'delete-file': {
        const tab = activeTab()
        if (tab) startDelete(tab.path)
        break
      }
      case 'toggle-pin': {
        const tab = activeTab()
        if (tab) void updateMeta(tab.path, { pinned: !tab.meta?.pinned })
        break
      }
      case 'toggle-bookmark': {
        const tab = activeTab()
        if (tab) void toggleBookmarkForPath(tab.path)
        break
      }
      case 'reveal-in-tree':
        revealActiveFile()
        break
      case 'sidebar-search':
        // Opening the filter with the sidebar hidden would be a shortcut that
        // silently does nothing.
        if (!getState().settings.sidebarOpen) togglePanelSetting('sidebarOpen')
        focusSidebarFilter()
        break
      case 'quick-open':
        search = ''
        break
      // A place, not a dialog — and it keeps whatever folder it was left on,
      // which is why nothing is passed here.
      case 'open-by-path':
        browseTo()
        break
      case 'reload-view':
        // Autosave may still be holding the last keystrokes behind its idle
        // timer, and a reload does not wait for a timer. Every dirty buffer goes
        // to disk first — including the tabs you are not looking at, which are
        // exactly the ones you would not think to check.
        void saveAllTabs().then(() => window.location.reload())
        break
      case 'go-back':
        goBack()
        break
      case 'go-forward':
        goForward()
        break
      case 'go-dashboard':
        setSurface('dashboard')
        break
      case 'toggle-sidebar':
        togglePanelSetting('sidebarOpen')
        break
      case 'toggle-read-only':
        void toggleReadOnly()
        break
      case 'link-file': {
        const tab = activeTab()
        if (tab) setState({ linkFile: { path: tab.path } })
        break
      }
      // The three inspector views are one pane, so these name a tab rather than
      // a panel: they bring their view up, and put the pane away when it is
      // already the one on screen. Panel visibility is a setting, like the
      // sidebar — forwarding it to the editor surface, which does not own it,
      // is what once left ⌘I and its menu item dead.
      case 'show-info':
        void showInspectorTab('info')
        break
      case 'show-outline':
        void showInspectorTab('outline')
        break
      case 'show-todos':
        void showInspectorTab('todos')
        break
      /*
       * ⇧⌘V. The paste itself happens here rather than in the editor because
       * WKWebView only performs a paste for a key the native menu declares, and
       * the key it would have declared (`pasteAndMatchStyle`) arrives at the
       * editor as an ordinary paste event — indistinguishable from ⌘V, and so
       * pasted with its formatting. Inserting the text as characters is the one
       * path no paste handler can reach: not the HTML parser, not markdown on
       * paste. See `markdownPaste.ts`.
       */
      case 'paste-plain':
        void pastePlain()
        break
      case 'toggle-raw-mode':
      case 'find-in-file':
        // Handled inside the editor surface, which owns that state.
        window.dispatchEvent(new CustomEvent('app:menu', { detail: command }))
        break
    }
  }

  /** Whatever is on the clipboard, typed in at the caret with no formatting. */
  async function pastePlain() {
    // Read in Bun: `navigator.clipboard.readText()` wants a user gesture, and a
    // menu command is not one — WKWebView answers it with a permission prompt.
    const { text } = await api.readClipboard()
    if (text) document.execCommand('insertText', false, text)
  }

  // On the desktop the native menu is the source of truth — see src/bun/menu.ts.
  $effect(() => onMenuCommand(runCommand))

  /**
   * The shell downloads updates by itself and only says so once the new bundle
   * is staged, so this notice is always actionable: clicking Restart swaps the
   * app and relaunches it. Dismissing it costs nothing — the staged bundle is
   * still there on the next launch.
   */
  $effect(() =>
    onUpdateReady(({ version }) => {
      notify('info', `Orbit Lite ${version} is ready.`, {
        label: 'Restart',
        run: () => {
          void api.applyUpdate()
        },
      })
    }),
  )

  /**
   * The desktop build declares every shortcut in the native menu. A browser tab
   * has no menu, so the same commands are bound here instead — and only here,
   * to avoid two handlers racing on the desktop.
   */
  $effect(() => {
    if (isDesktop) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      const command = browserShortcut(event.key, event.shiftKey)
      if (!command) return
      event.preventDefault()
      runCommand(command)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  /**
   * A note — or a folder — dragged in from Finder.
   *
   * The path travels as a `file://` URL in `text/uri-list`: WKWebView does not
   * give a dropped `File` a `.path` the way Electron does. It goes through
   * `openAnyPath` rather than a route of its own, so a drag lands exactly where
   * the same path typed into the palette would: same folder question, same
   * image permission, and a folder opens in the sidebar rather than erroring.
   */
  $effect(() => {
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      const list =
        event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain')
      const first = list
        ?.split('\n')
        .find(line => line.trim() && !line.startsWith('#'))
        ?.trim()
      if (!first) return
      event.preventDefault()
      // A URL, not a path (`file:///Users/me/My%20Notes/a.md`), and it may name
      // a folder as easily as a note. `openAnyPath` settles both.
      void openAnyPath(first)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  })

  // Files can change under us — an external editor, a git checkout, a sync tool.
  $effect(() =>
    onFileChange(event => {
      // Matched on the *old* path, because the tab has not moved yet. This
      // also covers renames done outside the app, which would otherwise leave
      // the tab saving to a path that no longer exists.
      if (event.type === 'renamed' && event.from) {
        // A folder rename arrives as its own event alongside one per note
        // inside it — see `followFolderRename` in the watcher.
        if (event.isDirectory) applyFolderMove(event.from, event.path)
        else applyRename(event.from, event.path)
        return
      }
      // Any open tab, not just the visible one — a background tab that
      // silently kept stale content would overwrite the newer file on save.
      const tab = getState().tabs.find(t => t.path === event.path)
      if (!tab) return
      if (event.type === 'deleted') {
        updateTab(event.path, { missing: true })
        return
      }
      if (event.type === 'modified') {
        // An untouched tab can silently take the new content; a dirty one
        // must not, so it is flagged and the user decides.
        if (tab.content === tab.savedContent) void reloadTab(event.path)
        else updateTab(event.path, { conflict: true })
      }
    }),
  )

  /**
   * Mirrors the accelerators declared in `src/bun/menu.ts`. Kept as a plain lookup
   * so the two lists are easy to diff by eye when either changes.
   */
  const BROWSER_SHORTCUTS: Record<string, MenuCommand> = {
    n: 'new-file',
    o: 'open-file',
    s: 'save',
    b: 'toggle-sidebar',
    d: 'toggle-pin',
    p: 'quick-open',
    f: 'find-in-file',
    i: 'show-info',
    k: 'link-file',
    '/': 'toggle-raw-mode',
    '0': 'go-dashboard',
    '[': 'go-back',
    ']': 'go-forward',
  }

  /** Shift turns a few of the bindings into their broader variant. */
  function browserShortcut(key: string, shift: boolean): MenuCommand | null {
    const normalized = key.toLowerCase()
    if (shift && normalized === 'o') return 'open-folder'
    if (shift && normalized === 'p') return 'open-by-path'
    if (shift && normalized === 'r') return 'rename-file'
    if (shift && normalized === 't') return 'show-outline'
    if (shift && normalized === 'd') return 'toggle-bookmark'
    if (shift && normalized === 'e') return 'reveal-in-tree'
    if (shift && normalized === 'f') return 'sidebar-search'
    if (shift && normalized === 'l') return 'toggle-read-only'
    return BROWSER_SHORTCUTS[normalized] ?? null
  }
</script>

{#if ready}
  <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={300}>
  <div class="app-shell flex h-full flex-col" style="background: var(--bg)">
    <TitleBar
      onQuickOpen={() => (search = '')}
      onOpenByPath={() => browseTo()}
      onOpenSettings={() => (settingsOpen = true)}
    />
    <div class="flex min-h-0 flex-1">
      <!--
        The tree belongs to the editor. Both other surfaces are places you go
        *to look for something* and both bring their own way of doing it —
        the path browser has its columns, Home has its cards, tasks, folders
        and tags — so a second navigation column down the left edge is one too
        many, and on Home it would list the same files the page already ranks.

        Hidden rather than closed: `sidebarOpen` is untouched, so the tree is
        back the moment you open a file.
      -->
      {#if sidebarOpen && surface === 'editor'}
        <Sidebar />
      {/if}
      <main class="flex min-w-0 flex-1 flex-col">
        {#if surface === 'editor' && tabBarOpen}
          <TabBar />
        {/if}
        <div class="min-h-0 flex-1">
          {#if surface === 'editor'}<EditorSurface />{/if}
          {#if surface === 'dashboard'}<Home onSearch={query => (search = query)} />{/if}
          {#if surface === 'browse'}<FileBrowser />{/if}
        </div>
      </main>
      {#if surface === 'editor' && inspectorOpen}
        <InspectorPane />
      {/if}
    </div>

    {#if search !== null}
      <QuickOpen initialQuery={search} onClose={() => (search = null)} />
    {/if}

    <!--
      Keyed so the dialog remounts when the target changes: its input holds the
      typed name in local state, and a second rename opened over the first would
      otherwise arrive pre-filled with the previous file's name.
    -->
    {#if rename}
      {#key rename.path}<RenameDialog target={rename} />{/key}
    {/if}
    {#if newFolder}
      {#key newFolder.dir}<NewFolderDialog dir={newFolder.dir} />{/key}
    {/if}
    {#if confirmDelete}
      {#key confirmDelete.path}<DeleteDialog path={confirmDelete.path} />{/key}
    {/if}
    {#if settingsOpen}
      <Settings onClose={() => (settingsOpen = false)} />
    {/if}
    {#if picker}
      <PathPicker mode={picker.mode} />
    {/if}
    {#if linkFile}
      {#key linkFile.path}<LinkFileDialog fromPath={linkFile.path} />{/key}
    {/if}
    {#if incomingLinks}
      {#key incomingLinks.path}<IncomingLinksDialog path={incomingLinks.path} />{/key}
    {/if}
    <!--
      Keyed on the URL: the component measures its image on load and holds the
      zoom, so opening a second image into the first one's state would show it at
      a scale computed for something else.
    -->
    {#if imagePreview}
      {#key imagePreview.src}
        <ImagePreview src={imagePreview.src} alt={imagePreview.alt} />
      {/key}
    {/if}
    <AddFolderDialog />
    <Notice />

    <!--
      The browser build is fully functional — it talks to the same services over
      HTTP — but two things genuinely differ: there is no native menu, so
      shortcuts come from the page, and no system dialog, so opening uses the
      in-app picker. The badge marks which build you are looking at.
    -->
    {#if !isDesktop}
      <div
        class="pointer-events-none fixed right-3 bottom-3 rounded border px-2 py-1 font-mono text-[10px]"
        style="border-color: var(--border); background: var(--bg-raised); color: var(--text-faint)"
      >
        browser build
      </div>
    {/if}
  </div>
  </TooltipPrimitive.Provider>
{/if}
