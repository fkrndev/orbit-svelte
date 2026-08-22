<script lang="ts">
  import { onMount } from 'svelte'
  import FolderPlus from '@lucide/svelte/icons/folder-plus'
  import { SvelteSet } from 'svelte/reactivity'
  import type { BookmarkView } from '$shared/types'
  import { filterBookmarks } from '$shared/bookmarks'
  import { getState } from '@/store.svelte'
  import { addBookmark, refreshBookmarks } from '@/sidebar'
  import FilterField from './FilterField.svelte'
  import BookmarkGroupNode from './BookmarkGroupNode.svelte'
  import BookmarkRow from './BookmarkRow.svelte'
  import BookmarkRenameDialog from './BookmarkRenameDialog.svelte'
  import type { DecorRequest } from './rowMenus'

  /**
   * The bookmark list.
   *
   * Deliberately not the same thing as a pin. A pin is a boolean on a file,
   * ordered for you; this is a list you arrange, and it can hold folders. If that
   * distinction ever stops being explainable in one sentence, one of the two
   * should go.
   */
  let { onDecor }: { onDecor: (request: DecorRequest) => void } = $props()

  const bookmarks = $derived(getState().bookmarks)
  const focusRequest = $derived(getState().sidebar.focusFilter)

  let collapsedGroups = $state(new SvelteSet<string>())
  let renaming = $state<BookmarkView | null>(null)

  // Local, like the Recents filter: this narrows rows already on screen rather
  // than driving a backend call, and a list you arranged by hand should not
  // still be hiding half of itself when you come back to it.
  let query = $state('')

  // `onMount`, not `$effect`: `refreshBookmarks` writes the store, and an
  // effect that both reads and writes it re-runs itself forever.
  onMount(() => {
    void refreshBookmarks()
  })

  const matches = $derived(filterBookmarks(bookmarks, query))

  const partitioned = $derived.by(() => {
    const topLevel: BookmarkView[] = []
    const byGroup = new Map<string, BookmarkView[]>()
    for (const entry of matches) {
      if (entry.groupId === null) {
        topLevel.push(entry)
        continue
      }
      const bucket = byGroup.get(entry.groupId)
      if (bucket) bucket.push(entry)
      else byGroup.set(entry.groupId, [entry])
    }
    return { topLevel, byGroup }
  })

  function toggleGroup(id: string) {
    if (collapsedGroups.has(id)) collapsedGroups.delete(id)
    else collapsedGroups.add(id)
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="flex items-center gap-1 px-2 pt-2 pb-1.5">
    <FilterField
      value={query}
      placeholder="Filter bookmarks…"
      onChange={value => (query = value)}
      {focusRequest}
    />
    <button
      type="button"
      title="New group"
      onclick={() => void addBookmark({ kind: 'group', title: 'New group' })}
      class="shrink-0 rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
      style="color: var(--text-muted)"
    >
      <FolderPlus size={16} strokeWidth={2} />
    </button>
  </div>

  <div class="flex-1 overflow-y-auto px-1.5 pb-3">
    {#if bookmarks.length > 0 && matches.length === 0}
      <p class="px-2.5 py-3 text-[12px] leading-relaxed" style="color: var(--text-faint)">
        No bookmark matches “{query.trim()}”.
      </p>
    {/if}

    {#if bookmarks.length === 0}
      <p class="px-2.5 py-3 text-[12px] leading-relaxed" style="color: var(--text-faint)">
        Nothing bookmarked yet. Right-click a file or folder in Files, or press ⇧⌘D on the file you
        have open.
      </p>
    {/if}

    {#each partitioned.topLevel as entry (entry.id)}
      {#if entry.kind === 'group'}
        <BookmarkGroupNode
          group={entry}
          items={partitioned.byGroup.get(entry.id) ?? []}
          collapsed={collapsedGroups.has(entry.id)}
          onToggle={() => toggleGroup(entry.id)}
          onRename={value => (renaming = value)}
          {onDecor}
        />
      {:else}
        <BookmarkRow {entry} indent={8} onRename={value => (renaming = value)} {onDecor} />
      {/if}
    {/each}
  </div>

  {#if renaming}
    {#key renaming.id}
      <BookmarkRenameDialog entry={renaming} onClose={() => (renaming = null)} />
    {/key}
  {/if}
</div>
