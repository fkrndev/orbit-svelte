<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import type { BookmarkView } from '$shared/types'
  import { removeBookmark } from '@/sidebar'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import SidebarRow from './SidebarRow.svelte'
  import BookmarkRow from './BookmarkRow.svelte'
  import MoveItems from './MoveItems.svelte'
  import type { DecorRequest } from './rowMenus'

  /** A named bucket of bookmarks. A label over a list, not a folder on disk. */
  let {
    group,
    items,
    collapsed,
    onToggle,
    onRename,
    onDecor,
  }: {
    group: BookmarkView
    items: BookmarkView[]
    collapsed: boolean
    onToggle: () => void
    onRename: (entry: BookmarkView) => void
    onDecor: (request: DecorRequest) => void
  } = $props()
</script>

<div>
  <SidebarRow
    indent={4}
    icon={groupIcon}
    label={group.title ?? 'Group'}
    onclick={onToggle}
    menu={groupMenu}
  />
  {#if !collapsed}
    {#each items as entry (entry.id)}
      <BookmarkRow {entry} indent={20} {onRename} {onDecor} />
    {/each}
  {/if}
</div>

{#snippet groupIcon()}
  {#if collapsed}<ChevronRight size={16} strokeWidth={2} />
  {:else}<ChevronDown size={16} strokeWidth={2} />{/if}
{/snippet}

{#snippet groupMenu()}
  <DropdownMenu.Item onSelect={() => onRename(group)}>Rename…</DropdownMenu.Item>
  <MoveItems entry={group} />
  <DropdownMenu.Separator />
  <!--
    Says what it does: a group is a label, and removing it must not take the
    shortcuts inside it along.
  -->
  <DropdownMenu.Item variant="destructive" onSelect={() => void removeBookmark(group.id)}>
    Remove group (keeps items)
  </DropdownMenu.Item>
{/snippet}
