<script lang="ts">
  import { getState } from '@/store.svelte'
  import { setFolderDecor } from '@/sidebar'
  import { updateMeta } from '@/actions'
  import ResizeHandle from './ResizeHandle.svelte'
  import FilesPanel from './sidebar/FilesPanel.svelte'
  import RecentsPanel from './sidebar/RecentsPanel.svelte'
  import BookmarksPanel from './sidebar/BookmarksPanel.svelte'
  import TagsPanel from './sidebar/TagsPanel.svelte'
  import FindResultsPanel from './sidebar/FindResultsPanel.svelte'
  import IconPicker from './sidebar/IconPicker.svelte'
  import type { DecorRequest } from './sidebar/rowMenus'

  /**
   * The sidebar: three surfaces, one panel at a time.
   *
   * Stacking Files, Recents, and Bookmarks in one column was the obvious layout
   * and the wrong one — each has its own scroll area, and three of those inside
   * 260px means whichever sits at the bottom never gets any height. So only one
   * shows, and the toggles that choose between them live in the title bar
   * (`Destinations`), where they cost no width here at all.
   */
  const panel = $derived(getState().settings.sidebarPanel)

  // A running search borrows the sidebar rather than claiming a fourth toggle:
  // the results are gone the moment you close the bar, and a panel you can
  // select but never fill would be a dead entry three quarters of the time.
  const finding = $derived(getState().find.open)

  let decor = $state<DecorRequest | null>(null)

  function applyDecor(next: { icon?: string; color?: string }) {
    if (!decor) return
    // The picker stays open while you try things, so it reports the whole
    // decoration each time rather than a delta — and empty strings are how it
    // says "back to the default".
    if (decor.kind === 'folder') {
      void setFolderDecor(decor.path, {
        ...(next.icon ? { icon: next.icon } : {}),
        ...(next.color ? { color: next.color } : {}),
      })
    } else {
      void updateMeta(decor.path, { icon: next.icon ?? '', color: next.color ?? '' })
    }
    decor = { ...decor, icon: next.icon, color: next.color }
  }
</script>

<aside
  class="relative flex h-full shrink-0"
  style="width: var(--sidebar-width); background: var(--bg-sunken);
         border-right: 1px solid var(--border)"
>
  <ResizeHandle pane="sidebarWidth" edge="right" label="Sidebar width" />

  <div class="flex min-w-0 flex-1 flex-col">
    {#if finding}
      <FindResultsPanel />
    {:else if panel === 'files'}
      <FilesPanel onDecor={request => (decor = request)} />
    {:else if panel === 'recents'}
      <RecentsPanel onDecor={request => (decor = request)} />
    {:else if panel === 'bookmarks'}
      <BookmarksPanel onDecor={request => (decor = request)} />
    {:else if panel === 'tags'}
      <TagsPanel />
    {/if}
  </div>

  {#if decor}
    {#key decor.path}
      <IconPicker target={decor} onApply={applyDecor} onClose={() => (decor = null)} />
    {/key}
  {/if}
</aside>
