<script lang="ts">
  import type { BookmarkView } from '$shared/types'
  import { openPath } from '@/actions'
  import { getState } from '@/store.svelte'
  import { moveBookmark, removeBookmark, revealInTree } from '@/sidebar'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import SidebarRow from './SidebarRow.svelte'
  import MoveItems from './MoveItems.svelte'
  import FileMenu from './FileMenu.svelte'
  import FolderMenu from './FolderMenu.svelte'
  import { iconFor } from './icons'
  import { displayName } from './names'
  import type { DecorRequest } from './rowMenus'

  let {
    entry,
    indent,
    onRename,
    onDecor,
  }: {
    entry: BookmarkView
    indent: number
    onRename: (entry: BookmarkView) => void
    onDecor: (request: DecorRequest) => void
  } = $props()

  const activePath = $derived(getState().activePath)
  const folderDecor = $derived(entry.path ? getState().folderDecor[entry.path] : undefined)
  // Filtered here rather than inside a store selector. In the React build that
  // was a hard rule — a fresh array from a `useSyncExternalStore` selector never
  // settled — and with runes it is merely the obvious place to put it.
  const groups = $derived(getState().bookmarks.filter(candidate => candidate.kind === 'group'))

  const path = $derived(entry.path ?? '')
  const isFolder = $derived(entry.kind === 'folder')
  const Icon = $derived(
    iconFor(isFolder ? folderDecor?.icon : undefined, isFolder ? 'folder' : 'file'),
  )
</script>

<SidebarRow
  {indent}
  icon={rowIcon}
  label={entry.title ?? displayName(path)}
  title={path}
  active={!isFolder && path === activePath}
  strong
  dim={!entry.exists}
  onclick={() => (isFolder ? revealInTree(path) : void openPath(path))}
  trailing={entry.exists ? undefined : missing}
  menu={rowMenu}
/>

{#snippet rowIcon()}
  <Icon size={16} strokeWidth={2} style="color: {folderDecor?.color ?? 'var(--text-faint)'}" />
{/snippet}

<!--
  Missing targets stay listed and unreachable. An unmounted volume or a branch
  not checked out yet would otherwise erase shortcuts the user built by hand, at
  the moment they are least able to notice.
-->
{#snippet missing()}
  <span class="ml-auto shrink-0 pl-1.5 text-[10.5px]" style="color: var(--text-faint)">
    missing
  </span>
{/snippet}

{#snippet rowMenu()}
  <DropdownMenu.Item onSelect={() => onRename(entry)}>Rename…</DropdownMenu.Item>
  <MoveItems {entry} />
  {#if groups.length > 0}
    <DropdownMenu.Separator />
    {#if entry.groupId !== null}
      <DropdownMenu.Item onSelect={() => void moveBookmark(entry.id, null, 0)}>
        Move out of group
      </DropdownMenu.Item>
    {/if}
    {#each groups.filter(group => group.id !== entry.groupId) as group (group.id)}
      <DropdownMenu.Item onSelect={() => void moveBookmark(entry.id, group.id, 0)}>
        Move to “{group.title ?? 'Group'}”
      </DropdownMenu.Item>
    {/each}
  {/if}
  <DropdownMenu.Separator />
  <DropdownMenu.Item variant="destructive" onSelect={() => void removeBookmark(entry.id)}>
    Remove bookmark
  </DropdownMenu.Item>
  {#if entry.exists}
    <DropdownMenu.Separator />
    {#if isFolder}
      <FolderMenu
        {path}
        name={entry.title ?? displayName(path)}
        decor={folderDecor}
        {onDecor}
      />
    {:else}
      <FileMenu {path} meta={undefined} {onDecor} />
    {/if}
  {/if}
{/snippet}
