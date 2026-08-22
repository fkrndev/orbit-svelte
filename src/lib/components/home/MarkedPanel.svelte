<script lang="ts">
  import Bookmark from '@lucide/svelte/icons/bookmark'
  import Folder from '@lucide/svelte/icons/folder'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import Star from '@lucide/svelte/icons/star'
  import type { DashboardItem } from '$shared/types'
  import { browseTo, openPath, setSurface, togglePanelSetting } from '@/actions'
  import { setSidebarPanel } from '@/sidebar'
  import { getState } from '@/store.svelte'
  import MarkedRow from './MarkedRow.svelte'

  /**
   * The things you marked yourself, as opposed to the ones your own use ranked
   * for you.
   *
   * Two mechanisms, deliberately kept apart. A **pin** is a boolean on a file and
   * the app decides the order; a **bookmark** is a list you arrange, and it can
   * hold folders. Home shows both in one block because they answer one question —
   * *what did I say mattered?* — and on two lines because the answer is not the
   * same kind of thing twice.
   *
   * Nothing here edits either list. The pin lives in the editor toolbar and the
   * bookmark list has a whole panel; a third place to rearrange them would be a
   * third thing to keep in step.
   */
  let { pinned }: { pinned: DashboardItem[] } = $props()

  const bookmarks = $derived(getState().bookmarks)
  const top = $derived(bookmarks.filter(entry => entry.groupId === null))
  const groups = $derived(top.filter(entry => entry.kind === 'group'))
  const places = $derived(top.filter(entry => entry.kind !== 'group').slice(0, 6))
  const nothing = $derived(pinned.length === 0 && top.length === 0)

  function baseName(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1).replace(/\.mdx?$/, '')
  }

  /**
   * The bookmark list itself lives in the sidebar, and the sidebar is not drawn
   * on Home — so going to it means leaving Home as well as selecting the panel.
   * Sending someone to a hidden sidebar is sending them nowhere.
   */
  async function showBookmarksPanel() {
    if (!getState().settings.sidebarOpen) togglePanelSetting('sidebarOpen')
    await setSidebarPanel('bookmarks')
    setSurface('editor')
  }
</script>

<div>
  <!-- Plain small caps, like every other block on the page — the star is a row
       mark, not a title. -->
  <h2
    class="text-[11px] font-semibold tracking-[0.08em] uppercase"
    style="color: var(--text-faint)"
  >
    Marked
  </h2>

  {#if nothing}
    <p class="mt-2.5 text-[12.5px] leading-relaxed" style="color: var(--text-faint)">
      Pin a file from the editor toolbar, or bookmark one from its row in the sidebar.
    </p>
  {/if}

  <div class="mt-2.5 flex flex-col">
    {#each pinned.slice(0, 6) as item (item.meta.id)}
      <MarkedRow
        label={baseName(item.meta.path)}
        title={item.meta.path}
        onclick={() => void openPath(item.meta.path)}
      >
        {#snippet icon()}
          <!--
            Coloured here too: this block mixes pins with bookmarks, so the star
            is telling them apart rather than decorating the row.
          -->
          <Star size={16} fill="currentColor" style="color: var(--pinned)" />
        {/snippet}
      </MarkedRow>
    {/each}

    {#each places as entry (entry.id)}
      {@const path = entry.path ?? ''}
      <MarkedRow
        label={entry.title ?? baseName(path)}
        title={path}
        dim={!entry.exists}
        onclick={() => {
          if (!entry.exists) return
          // A bookmarked folder opens where folders are browsed: the path columns.
          if (entry.kind === 'folder') browseTo(`${path}/`)
          else void openPath(path)
        }}
      >
        {#snippet icon()}
          {#if entry.kind === 'folder'}<Folder size={16} strokeWidth={2} />
          {:else}<Bookmark size={16} strokeWidth={2} />{/if}
        {/snippet}
      </MarkedRow>
    {/each}

    {#each groups as group (group.id)}
      <MarkedRow
        label={group.title ?? 'Group'}
        detail="{bookmarks.filter(entry => entry.groupId === group.id).length} items"
        onclick={() => void showBookmarksPanel()}
      >
        {#snippet icon()}<FolderOpen size={16} strokeWidth={2} />{/snippet}
      </MarkedRow>
    {/each}
  </div>
</div>
