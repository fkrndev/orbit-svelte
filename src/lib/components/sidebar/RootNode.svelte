<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical'
  import FilePlus from '@lucide/svelte/icons/file-plus'
  import Star from '@lucide/svelte/icons/star'
  import type { Root, TreeFilterResult } from '$shared/types'
  import { api } from '@/rpcClient'
  import { getState } from '@/store.svelte'
  import { createFileIn, refreshRoots } from '@/actions'
  import { setRootCollapsed, toggleRootPinned } from '@/sidebar'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import RowMarks from './RowMarks.svelte'
  import FolderMenu from './FolderMenu.svelte'
  import DirNode from './DirNode.svelte'
  import { iconFor } from './icons'
  import { rootLabels } from './names'
  import { ROW_ACTION, ROW_ACTIONS, type DecorRequest } from './rowMenus'

  let {
    root,
    filter,
    onDecor,
  }: { root: Root; filter: TreeFilterResult | null; onDecor: (request: DecorRequest) => void } =
    $props()

  const decor = $derived(getState().folderDecor[root.path])
  // A filter is a temporary view; it opens what it needs without touching the
  // folder's own collapsed flag, so clearing it restores exactly what was open.
  const collapsed = $derived(filter ? false : (root.collapsed ?? false))
  const Icon = $derived(iconFor(decor?.icon, 'folder'))
  // Display only: `root.name` stays the bare basename, which is what rename edits.
  const label = $derived(rootLabels(getState().roots).get(root.path) ?? root.name)
</script>

<div class="mb-0.5">
  <!-- The highlight moved to the row so the floated actions can inherit it. -->
  <div
    class="group relative flex items-center rounded transition-colors hover:bg-[var(--bg-hover)]"
  >
    <button
      type="button"
      onclick={() => void setRootCollapsed(root.id, !collapsed)}
      disabled={Boolean(filter)}
      class="flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 py-1 text-left disabled:cursor-default"
    >
      {#if collapsed}<ChevronRight size={16} strokeWidth={2} />
      {:else}<ChevronDown size={16} strokeWidth={2} />{/if}
      <Icon size={16} strokeWidth={2} style="color: {decor?.color ?? 'var(--text-muted)'}" />
      <span class="truncate text-[12.5px] font-medium" title={root.path}>{label}</span>
      {#if root.pinned}
        <RowMarks>
          <Star fill="currentColor" size={16} style="color: var(--pinned)" />
        </RowMarks>
      {/if}
    </button>

    <div class="{ROW_ACTIONS} pr-1">
      <!--
        Named after the folder: with several roots open, a column of buttons all
        called "New file here" says nothing about where.
      -->
      <button
        type="button"
        title="New file in {label}"
        onclick={() => void createFileIn(root.path)}
        class="{ROW_ACTION} hover:bg-[var(--bg-active)]"
        style="color: var(--text-muted)"
      >
        <FilePlus size={16} strokeWidth={2} />
      </button>

      <!--
        The root row's own menu.

        A plain dropdown rather than a `SidebarRow` with an empty label: that row's
        button is `flex-1`, so an invisible one sitting beside the root would
        quietly claim half the width.
      -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              type="button"
              title="Actions for {label}"
              class="{ROW_ACTION} hover:bg-[var(--bg-active)]"
              style="color: var(--text-muted)"
            >
              <EllipsisVertical size={16} strokeWidth={2} />
            </button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="min-w-44">
          <FolderMenu path={root.path} name={root.name} {decor} {onDecor} />
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={() => void toggleRootPinned(root.id)}>
            {root.pinned ? 'Unpin folder' : 'Pin folder'}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            variant="destructive"
            onSelect={async () => {
              await api.removeRoot({ id: root.id })
              void refreshRoots()
            }}
          >
            Remove from sidebar
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>

  {#if !collapsed}
    <DirNode path={root.path} depth={1} {filter} {onDecor} />
  {/if}
</div>
