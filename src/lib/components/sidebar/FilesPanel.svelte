<script lang="ts">
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import FolderPlus from '@lucide/svelte/icons/folder-plus'
  import { getState } from '@/store.svelte'
  import { openFolderDialog } from '@/actions'
  import { collapseEverything, setTreeQuery } from '@/sidebar'
  import FilterField from './FilterField.svelte'
  import PinnedSection from './PinnedSection.svelte'
  import RootNode from './RootNode.svelte'
  import type { DecorRequest } from './rowMenus'

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

  <div class="flex-1 overflow-y-auto px-1.5 pb-3">
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
