<script lang="ts">
  import Star from '@lucide/svelte/icons/star'
  import type { DirEntry, FileMeta } from '$shared/types'
  import { getState } from '@/store.svelte'
  import { openPath, startRename } from '@/actions'
  import SidebarRow from './SidebarRow.svelte'
  import RowMarks from './RowMarks.svelte'
  import FileMenu from './FileMenu.svelte'
  import { fileIconFor } from './icons'
  import { displayName } from './names'
  import type { DecorRequest } from './rowMenus'

  let {
    entry,
    indent,
    active,
    meta,
    onDecor,
  }: {
    entry: DirEntry
    indent: number
    active: boolean
    meta: FileMeta | undefined
    onDecor: (request: DecorRequest) => void
  } = $props()

  const labels = $derived(getState().labels)
  const glyph = $derived(fileIconFor(entry.name, meta?.icon))
  const Icon = $derived(glyph.Icon)
  const hasMarks = $derived(Boolean(meta && (meta.pinned || meta.labels.length > 0)))
</script>

<SidebarRow
  {indent}
  icon={fileIcon}
  label={displayName(entry.name)}
  title={entry.path}
  {active}
  strong
  onclick={() => void openPath(entry.path)}
  ondblclick={() => startRename(entry.path)}
  trailing={hasMarks ? marks : undefined}
  menu={fileMenu}
/>

{#snippet fileIcon()}
  <Icon size={16} strokeWidth={2} style="color: {meta?.color ?? glyph.color}" />
{/snippet}

{#snippet marks()}
  <RowMarks>
    {#if meta?.pinned}
      <Star fill="currentColor" size={16} style="color: var(--pinned)" />
    {/if}
    {#each meta?.labels.slice(0, 3) ?? [] as name (name)}
      <span
        title={name}
        class="size-1.5 rounded-full"
        style="background: {labels.find(l => l.name === name)?.color ?? 'var(--brand)'}"
      ></span>
    {/each}
  </RowMarks>
{/snippet}

{#snippet fileMenu()}
  <FileMenu path={entry.path} {meta} {onDecor} />
{/snippet}
