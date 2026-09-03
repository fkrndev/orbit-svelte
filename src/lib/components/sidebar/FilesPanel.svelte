<script lang="ts">
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import FolderPlus from '@lucide/svelte/icons/folder-plus'
  import { getState } from '@/store.svelte'
  import { openFolderDialog, startRename } from '@/actions'
  import { collapseEverything, setTreeQuery } from '@/sidebar'
  import FilterField from './FilterField.svelte'
  import PinnedSection from './PinnedSection.svelte'
  import RootNode from './RootNode.svelte'
  import { copyPath, type DecorRequest } from './rowMenus'

  /**
   * The file tree.
   *
   * Two things changed shape here relative to the original sidebar. Which folders
   * are open now lives in `tree.ts` rather than inside each node, so expand-all,
   * reveal, and the filter can reach it — and so closing a parent no longer
   * throws away everything below it. And the filter runs in the main process,
   * because the tree is lazy and a client-side filter would silently miss files
   * it has never listed.
   */
  let { onDecor }: { onDecor: (request: DecorRequest) => void } = $props()

  const roots = $derived(getState().roots)
  const query = $derived(getState().sidebar.query)
  const filter = $derived(getState().sidebar.filter)
  const filtering = $derived(getState().sidebar.filtering)
  const focusRequest = $derived(getState().sidebar.focusFilter)
  const showPinned = $derived(getState().settings.sidebarShowPinned)

  const visibleRoots = $derived(
    filter
      ? roots.filter(root => filter.files.some(path => path.startsWith(`${root.path}/`)))
      : roots,
  )

  const HEADER_BUTTON =
    'shrink-0 rounded p-1 transition-colors hover:bg-[var(--bg-hover)]'

  /**
   * The keyboard for the whole tree, held here rather than on each row.
   *
   * ↑/↓ move between rows, ⇧↵ renames, ⌃↵ copies the path. Plain ↵ is missing
   * on purpose: every row's label *is* a button, so the browser already
   * activates it — opening a file, expanding a folder — and a handler here
   * would only be a second way to do the same thing, out of step the first time
   * a row's click changes.
   *
   * One listener on the container because the tree is drawn by three different
   * components and the rows below any folder do not exist until it is opened;
   * anything holding an index into them would be stale by the next expand.
   */
  function onTreeKey(event: KeyboardEvent) {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-row-path]')
    const path = row?.dataset.rowPath
    if (!row || !path) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const container = event.currentTarget as HTMLElement
      // The row's own label button, which is its only direct button child — the
      // action cluster's buttons sit one div deeper. Disabled ones are the root
      // rows during a filter, and focus would silently refuse them.
      const buttons = [
        ...container.querySelectorAll<HTMLElement>(':scope [data-row-path] > button:not(:disabled)'),
      ]
      // Located from the row rather than from `event.target`, so an arrow
      // pressed with the row's ⋮ button focused still moves by one row.
      const here = buttons.indexOf(row.querySelector(':scope > button')!)
      const next = buttons[here + (event.key === 'ArrowDown' ? 1 : -1)]
      if (!next) return
      event.preventDefault()
      next.focus()
      return
    }

    if (event.key !== 'Enter') return
    if (event.shiftKey) {
      // Suppresses the button's own activation, which would otherwise open the
      // file *and* put a rename dialog over it.
      event.preventDefault()
      startRename(path, row.dataset.rowKind === 'folder' ? 'folder' : 'file')
    } else if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      void copyPath(path)
    }
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="flex items-center gap-1 px-2 pt-2 pb-1.5">
    <FilterField
      value={query}
      placeholder="Filter files…"
      onChange={setTreeQuery}
      {focusRequest}
    />
    <button
      type="button"
      title="Collapse all folders"
      onclick={() => void collapseEverything()}
      class={HEADER_BUTTON}
      style="color: var(--text-muted)"
    >
      <ChevronsUpDown size={16} strokeWidth={2} />
    </button>
    <button
      type="button"
      title="Add folder"
      onclick={() => void openFolderDialog()}
      class={HEADER_BUTTON}
      style="color: var(--text-muted)"
    >
      <FolderPlus size={16} strokeWidth={2} />
    </button>
  </div>

  <!--
    The handler belongs to the container, not to a control in it: the rows are
    the controls, and they are drawn several components down.
  -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="flex-1 overflow-y-auto px-1.5 pb-3" onkeydown={onTreeKey}>
    {#if roots.length === 0}
      <!--
        Opening a file through the system dialog still adopts its folder;
        opening one by path asks first, so the promise here is the weaker of the
        two rather than the one that stops being true the moment someone answers
        "never".
      -->
      <p class="px-2.5 py-3 text-[12px] leading-relaxed" style="color: var(--text-faint)">
        No folders yet. Add one — or open a file by its path (⇧⌘P) and decide about its folder
        afterwards.
      </p>
    {/if}

    {#if filter && filter.files.length === 0 && !filtering}
      <p class="px-2.5 py-3 text-[12px]" style="color: var(--text-faint)">
        Nothing matches “{query}”.
      </p>
    {/if}

    {#if !filter && showPinned}
      <PinnedSection {onDecor} />
    {/if}

    {#each visibleRoots as root (root.id)}
      <RootNode {root} {filter} {onDecor} />
    {/each}
  </div>
</div>
