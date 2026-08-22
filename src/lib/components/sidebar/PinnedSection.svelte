<script lang="ts">
  import Star from '@lucide/svelte/icons/star'
  import type { FileMeta } from '$shared/types'
  import { api } from '@/rpcClient'
  import { getState } from '@/store.svelte'
  import { openPath } from '@/actions'
  import SidebarRow from './SidebarRow.svelte'
  import RowMarks from './RowMarks.svelte'
  import FileMenu from './FileMenu.svelte'
  import { iconFor } from './icons'
  import { displayName } from './names'
  import type { DecorRequest } from './rowMenus'

  /**
   * Pinned files, above the tree.
   *
   * Reads `FileMeta.pinned` — the flag the star in the toolbar and ⌘D already
   * write. A second pin concept living only in the sidebar would give one boolean
   * two meanings, which this app has already had to undo once.
   */
  let { onDecor }: { onDecor: (request: DecorRequest) => void } = $props()

  let pinned = $state<FileMeta[]>([])

  const activePath = $derived(getState().activePath)

  function load() {
    api
      .getDashboard({ limit: 1 })
      .then(data => (pinned = data.pinned.map(item => item.meta)))
      .catch(() => (pinned = []))
  }

  $effect(() => {
    load()
    const onMeta = () => load()
    window.addEventListener('app:meta-changed', onMeta)
    return () => window.removeEventListener('app:meta-changed', onMeta)
  })
</script>

{#if pinned.length > 0}
  <div class="mb-1.5">
    <div
      class="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase"
      style="color: var(--text-faint)"
    >
      Pinned
    </div>
    {#each pinned as meta (meta.id)}
      {@const Icon = iconFor(meta.icon, 'file')}
      <SidebarRow
        indent={8}
        label={displayName(meta.path)}
        title={meta.path}
        active={meta.path === activePath}
        strong
        onclick={() => void openPath(meta.path)}
        icon={pinnedIcon}
        trailing={pinnedStar}
        menu={pinnedMenu}
      />
      {#snippet pinnedIcon()}
        <Icon size={16} strokeWidth={2} style="color: {meta.color ?? 'var(--text-faint)'}" />
      {/snippet}
      {#snippet pinnedStar()}
        <RowMarks>
          <Star fill="currentColor" size={16} style="color: var(--pinned)" />
        </RowMarks>
      {/snippet}
      {#snippet pinnedMenu()}
        <FileMenu path={meta.path} {meta} {onDecor} />
      {/snippet}
    {/each}
  </div>
{/if}
