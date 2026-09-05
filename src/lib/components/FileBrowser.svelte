<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import Check from '@lucide/svelte/icons/check'
  import CornerDownLeft from '@lucide/svelte/icons/corner-down-left'
  import FilePlus2 from '@lucide/svelte/icons/file-plus-2'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import Search from '@lucide/svelte/icons/search'
  import type {
    PathColumns,
    PathCompletion,
    PathEntry,
    QuickOpenHit,
    RecentFolder,
  } from '$shared/types'
  import { api } from '@/rpcClient'
  import {
    createFileIn,
    openByPath,
    openFolderInSidebar,
    setSetting,
    startNewFolder,
  } from '@/actions'
  import { getState, setState } from '@/store.svelte'
  import { rootLabels } from '@/components/sidebar/names'
  import { looksLikePath } from '$shared/pathInput'
  import {
    displayPath,
    isPathStart,
    newNoteName,
    parentQuery,
    pathEmptyMessage,
    typedPathAction,
  } from '@/quickOpenPath'
  import { keysFor } from '$shared/shortcuts'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import Tooltip from './Tooltip.svelte'
  import { copyPath } from './sidebar/rowMenus'
  import BrowseRail from './browse/BrowseRail.svelte'
  import BrowseColumn from './browse/BrowseColumn.svelte'
  import BrowsePreview from './browse/BrowsePreview.svelte'
  import DeepResults from './browse/DeepResults.svelte'

  /**
   * Opening a note by naming where it is — as a place in the app, not a dialog
   * over it, and as a chain of columns rather than one list.
   *
   * **Why a surface.** Finding the file you are about to read is a *destination*,
   * like the dashboard: you arrive, you look around, you change your mind, you
   * look somewhere else. As a modal every one of those was a fresh start — a
   * glance at the editor behind it and the folder you had walked to was gone.
   * Here the query, the folder and the cursor live in the store, so leaving and
   * coming back is genuinely coming *back*, and the folder survives a restart the
   * way open tabs do.
   *
   * **Why columns.** A single list can only say "here is where you are". Columns
   * say that *and* what was beside every turn that got you here, which is what
   * makes a wrong turn cheap: the sibling you actually meant is still on screen,
   * one row up in a column you never left. It is also the shape this job has had
   * on the Mac since NeXT, so it needs no explaining.
   *
   * The rail on the left is the app's own Favourites — folders earned from use
   * rather than a fixed list. It is why this page hides the file-tree sidebar
   * while you are on it: two navigation columns competing down the left edge is
   * one too many, and the tree comes straight back when you leave.
   */
  const query = $derived(getState().browse.query)
  const index = $derived(getState().browse.index)
  const roots = $derived(getState().roots)
  const rootNames = $derived(rootLabels(roots))

  let chain = $state<PathColumns | null>(null)
  let failed = $state(false)
  let home = $state('')
  let places = $state<Array<{ name: string; path: string }>>([])
  let recentFolders = $state<RecentFolder[]>([])
  let deep = $state<{ dir: string; hits: QuickOpenHit[]; truncated: boolean } | null>(null)
  let input = $state<HTMLInputElement | null>(null)
  let strip = $state<HTMLDivElement | null>(null)

  function setQuery(next: string) {
    setState({ browse: { query: next, index: 0 } })
  }

  function moveIndex(next: (current: number) => number) {
    setState(prev => ({ browse: { ...prev.browse, index: next(prev.browse.index) } }))
  }

  const atStart = $derived(isPathStart(query, home))

  /** The last column is the one being read, and the only one the keyboard is in. */
  const active = $derived(chain?.columns[chain.columns.length - 1] ?? null)
  const rows = $derived<PathEntry[]>(deep ? [] : (active?.entries ?? []))
  const cursor = $derived(rows[index])

  // The helpers all speak `PathCompletion`; the chain carries the same facts.
  const completion = $derived<PathCompletion | null>(
    chain && active
      ? {
          resolved: chain.resolved,
          dir: chain.dir,
          dirExists: chain.dirExists,
          kind: chain.kind,
          openable: chain.openable,
          entries: active.entries,
          hiddenCount: active.hiddenCount,
        }
      : null,
  )

  onMount(() => {
    input?.focus()
    const length = input?.value.length ?? 0
    input?.setSelectionRange(length, length)

    api
      .listPlaces()
      .then(result => {
        home = result.home
        places = result.places
        // Nothing typed yet on this run: pick up where the last one left off,
        // falling back to home rather than to an empty field.
        if (!getState().browse.query) {
          setQuery(getState().settings.browsePath || `${result.home}/`)
        }
      })
      .catch(() => undefined)

    api
      .recentFolders({ limit: 6 })
      .then(result => (recentFolders = result))
      .catch(() => undefined)
  })

  /*
   * Bumped when something changes on disk under a column — today that is a
   * folder made from a column heading. The chain is otherwise a pure function
   * of what is typed, so without this the folder you just made is missing from
   * the column you made it in until you touch the path field.
   */
  let revision = $state(0)
  $effect(() => {
    const onDir = () => (revision += 1)
    window.addEventListener('app:dir-changed', onDir)
    return () => window.removeEventListener('app:dir-changed', onDir)
  })

  $effect(() => {
    const typed = query
    void revision
    if (!looksLikePath(typed)) {
      chain = null
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      api
        .pathColumns({ input: typed })
        .then(result => {
          if (cancelled) return
          chain = result
          failed = false
        })
        .catch(() => {
          // Recorded rather than swallowed: without this the page looks empty
          // and answers no keys, which is indistinguishable from a bug.
          if (cancelled) return
          chain = null
          failed = true
        })
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(timer)
      deep = null
    }
  })

  // The rightmost column is the one you are working in, so it is the one that
  // has to be on screen — a new column appearing off the right edge is a column
  // nobody knows appeared.
  $effect(() => {
    void chain?.dir
    if (strip) strip.scrollLeft = strip.scrollWidth
  })

  // The folder to come back to. Written when it changes rather than on every
  // keystroke, which is what `dir` gives us for free.
  $effect(() => {
    const dir = chain?.dir
    if (dir && `${dir}/` !== untrack(() => getState().settings.browsePath)) {
      void setSetting('browsePath', `${dir}/`)
    }
  })

  async function runDeepSearch(searchDir: string, needleText: string) {
    try {
      const result = await api.searchUnder({ dir: searchDir, query: needleText, limit: 60 })
      deep = { dir: searchDir, hits: result.hits, truncated: result.truncated }
    } catch {
      deep = { dir: searchDir, hits: [], truncated: false }
    }
  }

  function open(entry: PathEntry | undefined) {
    if (!entry) {
      const action = typedPathAction(query, home, completion)
      if (action.kind === 'descend') setQuery(action.query)
      if (action.kind === 'open') void openByPath(action.path)
      return
    }
    if (entry.isDirectory) setQuery(`${entry.path}/`)
    else void openByPath(entry.path)
  }

  function goUp() {
    const parent = parentQuery(query, home)
    if (parent) setQuery(parent)
  }

  /**
   * Every key this page answers, in one place — because it has to answer them
   * from two.
   *
   * The field owns the keyboard while you are typing, but a mouse click lands
   * focus wherever it lands, and after that the arrows were simply dead: the
   * handler was attached to an input nobody was in any more. A page that stops
   * answering the keys its own footer advertises is worse than one that never
   * offered them.
   *
   * `atEnd` is what keeps the two callers honest. Inside the field the arrows
   * belong to the text first and only navigate once the caret has run out of
   * path — otherwise `←` could not fix a typo halfway along a long one. Outside
   * it there is no caret to protect, so they always navigate.
   */
  function handleKey(event: KeyboardEvent, atEnd: boolean) {
    if ((event.metaKey || event.ctrlKey) && /^[1-9]$/.test(event.key)) {
      event.preventDefault()
      open(rows[Number(event.key) - 1])
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveIndex(i => Math.min(i + 1, rows.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveIndex(i => Math.max(i - 1, 0))
    }
    if (atEnd && query.endsWith('/') && (event.key === 'ArrowLeft' || event.key === 'Backspace')) {
      event.preventDefault()
      goUp()
    }
    if (atEnd && event.key === 'ArrowRight' && cursor?.isDirectory) {
      event.preventDefault()
      setQuery(`${cursor.path}/`)
    }
    if (event.key === 'Tab' && cursor) {
      event.preventDefault()
      setQuery(cursor.isDirectory ? `${cursor.path}/` : cursor.path)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!event.metaKey && !event.ctrlKey) {
        open(cursor)
        return
      }
      // ⌘⏎ means the folder itself rather than a way through it.
      if (cursor?.isDirectory) void openFolderInSidebar(cursor.path)
      else if (chain?.kind === 'directory') void openFolderInSidebar(chain.resolved)
    }
  }

  $effect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      // Anything that owns its own keys keeps them: the field has its own
      // handler, a dialog traps everything, and a focused resize handle moves
      // its edge with the arrows — without this last one, `←` on a handle would
      // narrow the column *and* climb a folder in the same press.
      if (
        target === input ||
        target?.closest('[role="dialog"], [role="separator"], input, textarea')
      ) {
        return
      }
      handleKey(event, true)
      // And a printable key means you meant to type a path, so put the caret
      // back where typing belongs instead of dropping the character.
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) input?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  /** What the last column is being filtered by — also what a deep search looks for. */
  const needle = $derived(chain ? chain.resolved.slice(chain.dir.length + 1) : '')

  const actionDir = $derived(chain?.dirExists ? chain.dir : null)
  const inSidebar = $derived(roots.some(root => root.path === chain?.dir))
  // The folder's own name, not the path: the field directly above is already
  // spelling the path out, and a tooltip as wide as the window says less.
  const where = $derived(
    actionDir ? actionDir.slice(actionDir.lastIndexOf('/') + 1) || actionDir : '',
  )
</script>

<div class="flex h-full min-h-0">
  <BrowseRail
    {home}
    {recentFolders}
    roots={roots.map(root => ({ path: root.path, name: rootNames.get(root.path) ?? root.name }))}
    {places}
    currentDir={chain?.dir ?? null}
    onGo={path => setQuery(`${path}/`)}
  />

  <div class="flex min-w-0 flex-1 flex-col">
    <header
      class="flex shrink-0 items-center gap-2 border-b px-5 pt-4 pb-3"
      style="border-color: var(--border)"
    >
      <!--
        Paste is named because it is the common case and the field is the only
        place it happens. Reading the clipboard *for* you was tried and
        reverted: on macOS every silent read raises the system's own "Paste"
        permission button, so the page opened by asking for something nobody had
        asked it to do. ⌘V costs one keystroke and no prompt at all.
      -->
      <Input
        bind:ref={input}
        value={query}
        spellcheck={false}
        autocomplete="off"
        placeholder="Type or paste a path — / or ~ — or pick a folder on the left"
        oninput={event => setQuery((event.currentTarget as HTMLInputElement).value)}
        onkeydown={event => {
          // At the end of the field, arrows have no text left to move through —
          // that is when they may move between folders instead.
          const field = event.currentTarget as HTMLInputElement
          const atEnd = field.selectionStart === query.length && field.selectionEnd === query.length
          handleKey(event, atEnd)
        }}
        class="h-auto min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-[13px]"
      />

      <!--
        The two things you can do to the folder you are standing in, rather than
        to something inside it: take it into the sidebar, or put a new note in
        it. Both were already reachable — ⌘⏎ opens the folder, ⌘N writes the
        note — and that is exactly why they are here. A page whose only way in is
        a chord that nothing on screen mentions is a page where those actions do
        not exist for most people.

        `Open folder` stays live for a folder that is already a root: `addRoot`
        is idempotent, so pressing it means "show me that folder", which is what
        someone pressing a button labelled Open folder is asking for.
      -->
      {#if actionDir}
        <div class="flex shrink-0 items-center gap-2">
          <Tooltip label="Create {newNoteName(needle)} in {where}" shortcut={keysFor('newFile')}>
            <Button
              variant="outline"
              size="sm"
              onmousedown={event => event.preventDefault()}
              onclick={() => void createFileIn(actionDir, newNoteName(needle))}
            >
              <FilePlus2 size={14} strokeWidth={2} />
              New note
            </Button>
          </Tooltip>

          <Tooltip
            label={inSidebar ? `${where} is already in the sidebar` : `Open ${where} in the sidebar`}
            shortcut="⌘⏎"
          >
            <Button
              size="sm"
              onmousedown={event => event.preventDefault()}
              onclick={() => void openFolderInSidebar(actionDir)}
            >
              {#if inSidebar}<Check size={14} strokeWidth={2} />
              {:else}<FolderOpen size={14} strokeWidth={2} />{/if}
              Open folder
            </Button>
          </Tooltip>
        </div>
      {/if}
    </header>

    {#if deep}
      <DeepResults
        {deep}
        {home}
        {index}
        onHover={i => moveIndex(() => i)}
        onOpen={path => void openByPath(path)}
        onBack={() => (deep = null)}
      />
    {:else if failed || !chain}
      <p class="p-8 text-center text-[12.5px]" style="color: var(--text-faint)">
        {atStart && !failed
          ? 'Pick a folder on the left, or keep typing a path'
          : pathEmptyMessage(completion, failed)}
      </p>
    {:else}
      {@const columns = chain}
      <!--
        `onNewNote` names the file after the typed fragment only in the column
        that fragment is filtering. In the columns behind it the text belongs to
        a different folder, so it would name a note after something that is not
        there — those get the plain untitled name instead.
      -->
      <div bind:this={strip} class="flex min-h-0 flex-1 overflow-x-auto">
        {#each columns.columns as column, columnIndex (column.dir)}
          {@const isLast = columnIndex === columns.columns.length - 1}
          <BrowseColumn
            dir={column.dir}
            entries={column.entries}
            selected={column.selected}
            {home}
            {isLast}
            cursorPath={isLast ? (cursor?.path ?? null) : null}
            noteCount={column.noteCount}
            inSidebar={roots.some(root => root.path === column.dir)}
            onHover={i => moveIndex(() => i)}
            onPick={entry => open(entry)}
            onOpenFolder={path => void openFolderInSidebar(path)}
            onCopyPath={path => void copyPath(path)}
            onNewNote={path => void createFileIn(path, newNoteName(isLast ? needle : ''))}
            onNewFolder={path => startNewFolder(path)}
          />
        {/each}
      </div>

      <!--
        The line under the columns: what is not being shown, what the keys do,
        and the way down into subfolders when this folder was the wrong one.
      -->
      <div
        class="flex shrink-0 items-center gap-3 border-t px-4 py-1.5 text-[11px]"
        style="border-color: var(--border); color: var(--text-faint)"
      >
        {#if needle.length >= 2}
          <button
            type="button"
            onclick={() => void runDeepSearch(columns.dir, needle)}
            class="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--bg-hover)]"
            style="color: var(--text-muted)"
          >
            <Search size={12} strokeWidth={2} />
            Search “{needle}” in every subfolder of {displayPath(columns.dir, home)}
          </button>
        {/if}
        {#if completion && completion.hiddenCount > 0}
          <span>
            {completion.hiddenCount} non-markdown
            {completion.hiddenCount === 1 ? 'file' : 'files'} hidden
          </span>
        {/if}
        <span class="ml-auto flex shrink-0 items-center gap-1">
          <CornerDownLeft size={11} strokeWidth={2} /> open · ⌘⏎ open folder · {keysFor('newFile')} new
          note · ← → move
        </span>
      </div>
    {/if}
  </div>

  <BrowsePreview path={cursor && !cursor.isDirectory ? cursor.path : null} />
</div>
