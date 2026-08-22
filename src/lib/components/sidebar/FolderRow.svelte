<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import type { DirEntry } from '$shared/types'
  import { getState } from '@/store.svelte'
  import { toggleFolder } from '@/sidebar'
  import SidebarRow from './SidebarRow.svelte'
  import FolderMenu from './FolderMenu.svelte'
  import { iconFor } from './icons'
  import type { DecorRequest } from './rowMenus'

  let {
    entry,
    indent,
    open,
    locked,
    onDecor,
  }: {
    entry: DirEntry
    indent: number
    open: boolean
    locked: boolean
    onDecor: (request: DecorRequest) => void
  } = $props()

  const decor = $derived(getState().folderDecor[entry.path])
  const Icon = $derived(iconFor(decor?.icon, 'folder'))
</script>

<SidebarRow
  {indent}
  icon={folderIcon}
  label={entry.name}
  title={entry.path}
  onclick={() => !locked && toggleFolder(entry.path)}
  menu={folderMenu}
/>

{#snippet folderIcon()}
  {#if open}<ChevronDown size={16} strokeWidth={2} />
  {:else}<ChevronRight size={16} strokeWidth={2} />{/if}
  <Icon size={16} strokeWidth={2} style="color: {decor?.color ?? 'var(--text-faint)'}" />
{/snippet}

{#snippet folderMenu()}
  <FolderMenu path={entry.path} name={entry.name} {decor} {onDecor} />
{/snippet}
