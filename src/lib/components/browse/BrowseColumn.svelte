<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import Copy from '@lucide/svelte/icons/copy'
  import FilePlus2 from '@lucide/svelte/icons/file-plus-2'
  import FileText from '@lucide/svelte/icons/file-text'
  import Folder from '@lucide/svelte/icons/folder'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import type { PathEntry } from '$shared/types'
  import ResizeHandle from '../ResizeHandle.svelte'
  import Tooltip from '../Tooltip.svelte'
  import MatchedText from './MatchedText.svelte'

  /**
   * One level of the chain.
   *
   * Two different highlights, because they answer two different questions. The
   * *selected* row is where the path continues — it stays lit in every column
   * behind you, which is what draws the trail. The *cursor* is where the keyboard
   * is, and only the last column has one.
   */
  let {
    dir,
    entries,
    selected,
    home,
    isLast,
    cursorPath,
    noteCount,
    inSidebar,
    onHover,
    onPick,
    onOpenFolder,
    onNewNote,
    onCopyPath,
  }: {
    dir: string
    entries: PathEntry[]
    selected: string | null
    home: string
    isLast: boolean
    cursorPath: string | null
    /** Markdown directly in this column's own folder — what the heading counts. */
    noteCount: number
    inSidebar: boolean
    onHover: (index: number) => void
    onPick: (entry: PathEntry) => void
    onOpenFolder: (path: string) => void
    onNewNote: (path: string) => void
    onCopyPath: (path: string) => void
  } = $props()

  const name = $derived(dir === home ? '~' : dir.slice(dir.lastIndexOf('/') + 1) || '/')

  let list = $state<HTMLDivElement | null>(null)

  // Walking back up a long chain would otherwise leave the row you came from
  // scrolled out of sight in a column you are looking straight at.
  $effect(() => {
    void selected
    list?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  })
</script>

<!-- `relative` so the resize handle can straddle this column's own border. -->
<div
  class="relative flex shrink-0 flex-col border-r"
  style="border-color: var(--border); width: var(--browse-column-width, 224px)"
>
  <!--
    The heading is also the folder's own row.

    Everything on this page acts on something *inside* a column — a row you click
    or a row the cursor is on — and the folder each column is made of had no
    handle at all: to open `project` in the sidebar you had to walk back up a
    level and find it as a row in its parent. The three actions here are the ones
    that belong to a folder rather than to its contents, and the count answers
    the question you ask before walking in: is there anything in there.

    Held back until the pointer is over the column, because four headings
    carrying three buttons each is a toolbar down the top of the page, and the
    heading's job the rest of the time is to say where you are. The row keeps
    their space either way, so nothing under it moves when they appear, and
    `focus-within` keeps them reachable by keyboard where hover cannot go.
  -->
  <div
    class="group/head flex shrink-0 items-center gap-1.5 border-b px-3 py-1"
    style="border-color: var(--border)"
  >
    <p
      class="truncate text-[10.5px] font-medium tracking-wide uppercase"
      style="color: var(--text-faint)"
      title={dir}
    >
      {name}
    </p>

    {#if noteCount > 0}
      <span
        class="shrink-0 text-[10px] tabular-nums"
        style="color: var(--text-faint)"
        title="{noteCount} markdown {noteCount === 1 ? 'file' : 'files'} in {name}"
      >
        {noteCount}
      </span>
    {/if}

    <div
      class="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity
             group-hover/head:opacity-100 focus-within:opacity-100"
    >
      <Tooltip label="New note in {name}">
        <button
          type="button"
          aria-label="New note in {name}"
          onmousedown={event => event.preventDefault()}
          onclick={() => onNewNote(dir)}
          class="rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
          style="color: var(--text-faint)"
        >
          <FilePlus2 size={12} strokeWidth={2} />
        </button>
      </Tooltip>

      <Tooltip label="Copy path to {name}">
        <button
          type="button"
          aria-label="Copy path to {name}"
          onmousedown={event => event.preventDefault()}
          onclick={() => onCopyPath(dir)}
          class="rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
          style="color: var(--text-faint)"
        >
          <Copy size={12} strokeWidth={2} />
        </button>
      </Tooltip>

      <Tooltip
        label={inSidebar ? `${name} is already in the sidebar` : `Open ${name} in the sidebar`}
      >
        <button
          type="button"
          aria-label={inSidebar
            ? `${name} is already in the sidebar`
            : `Open ${name} in the sidebar`}
          onmousedown={event => event.preventDefault()}
          onclick={() => onOpenFolder(dir)}
          class="rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
          style="color: {inSidebar ? 'var(--brand)' : 'var(--text-faint)'}"
        >
          <FolderOpen size={12} strokeWidth={2} />
        </button>
      </Tooltip>
    </div>
  </div>

  <div bind:this={list} class="min-h-0 flex-1 overflow-y-auto p-1">
    {#if entries.length === 0}
      <p class="px-2 py-3 text-[11.5px]" style="color: var(--text-faint)">Nothing here</p>
    {:else}
      {#each entries as entry, i (entry.path)}
        {@const onPath = entry.path === selected}
        {@const underCursor = entry.path === cursorPath}
        <!--
          Clicking a row must not take the caret out of the field: the keyboard
          is how this page is driven, and a click that ends keyboard control is a
          trap you fall into once and never trust again.
        -->
        <button
          type="button"
          data-selected={onPath}
          onmousedown={event => event.preventDefault()}
          onmouseenter={() => isLast && onHover(i)}
          onclick={() => onPick(entry)}
          ondblclick={() => entry.isDirectory && onOpenFolder(entry.path)}
          class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[12.5px]"
          style="background: {underCursor
            ? 'var(--bg-active)'
            : onPath
              ? 'var(--bg-hover)'
              : 'transparent'}; color: var(--text)"
        >
          {#if entry.isDirectory}
            <Folder size={13} strokeWidth={2} class="shrink-0" style="color: var(--brand)" />
          {:else}
            <FileText size={13} strokeWidth={2} class="shrink-0" style="color: var(--text-faint)" />
          {/if}
          <span class="truncate"><MatchedText text={entry.name} matched={entry.matched} /></span>
          {#if entry.isDirectory}
            <span
              class="ml-auto flex shrink-0 items-center gap-1 text-[10px]"
              style="color: var(--text-faint)"
            >
              {entry.noteCount ? entry.noteCount : ''}
              <ChevronRight size={12} strokeWidth={2} />
            </span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>

  <!--
    One handle per column, all moving the same width — a column here is a level
    of the same chain, so a per-column width would have to be keyed by position,
    and position is a different folder every time you navigate. Dragging any edge
    is therefore the same gesture, which also means the edge nearest your pointer
    is always the one that works.
  -->
  <ResizeHandle pane="browseColumnWidth" edge="right" label="Column width" />
</div>
