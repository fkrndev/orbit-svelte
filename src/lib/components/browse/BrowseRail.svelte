<script lang="ts">
  import Clock from '@lucide/svelte/icons/clock'
  import Folder from '@lucide/svelte/icons/folder'
  import type { RecentFolder } from '$shared/types'
  import { displayPath } from '@/quickOpenPath'

  /**
   * The app's own Favourites: where you have been, what is already in the
   * sidebar, and the four places macOS puts everything.
   *
   * Recents first because it is the one list earned from use — the other two are
   * the same every day. It stands in for the file tree, which this page hides.
   */
  let {
    home,
    recentFolders,
    roots,
    places,
    currentDir,
    onGo,
  }: {
    home: string
    recentFolders: RecentFolder[]
    roots: Array<{ path: string; name: string }>
    places: Array<{ name: string; path: string }>
    currentDir: string | null
    onGo: (path: string) => void
  } = $props()

  const SECTION = 'px-4 pb-1 text-[10px] font-medium tracking-wide uppercase'
  const ROW =
    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-[var(--bg-hover)]'

  function rowStyle(current: boolean) {
    return `background: ${current ? 'var(--bg-active)' : 'transparent'}; color: ${
      current ? 'var(--text)' : 'var(--text-muted)'
    }`
  }
</script>

<nav
  class="flex w-52 shrink-0 flex-col overflow-y-auto border-r py-3"
  style="border-color: var(--border); background: var(--bg-sunken)"
>
  <h1 class="px-4 pb-3 text-[13px] font-semibold" style="color: var(--text)">Open by path</h1>

  {#if recentFolders.length > 0}
    <div class="mb-3">
      <p class={SECTION} style="color: var(--text-faint)">Recent folders</p>
      <div class="px-2">
        {#each recentFolders as folder (folder.path)}
          <button
            type="button"
            onmousedown={event => event.preventDefault()}
            onclick={() => onGo(folder.path)}
            title={displayPath(folder.path, home)}
            class={ROW}
            style={rowStyle(folder.path === currentDir)}
          >
            <span class="shrink-0" style="color: var(--text-faint)">
              <Clock size={13} strokeWidth={2} />
            </span>
            <span class="truncate">{folder.name}</span>
            <span class="ml-auto shrink-0 text-[10px]" style="color: var(--text-faint)">
              {folder.noteCount}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if roots.length > 0}
    <div class="mb-3">
      <p class={SECTION} style="color: var(--text-faint)">In the sidebar</p>
      <div class="px-2">
        {#each roots as root (root.path)}
          <button
            type="button"
            onmousedown={event => event.preventDefault()}
            onclick={() => onGo(root.path)}
            title={displayPath(root.path, home)}
            class={ROW}
            style={rowStyle(root.path === currentDir)}
          >
            <span class="shrink-0" style="color: var(--text-faint)">
              <Folder size={13} strokeWidth={2} />
            </span>
            <span class="truncate">{root.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="mb-3">
    <p class={SECTION} style="color: var(--text-faint)">Places</p>
    <div class="px-2">
      {#each places as place (place.path)}
        <button
          type="button"
          onmousedown={event => event.preventDefault()}
          onclick={() => onGo(place.path)}
          class={ROW}
          style={rowStyle(place.path === currentDir)}
        >
          <span class="shrink-0" style="color: var(--text-faint)">
            <Folder size={13} strokeWidth={2} />
          </span>
          <span class="truncate">{place.name}</span>
        </button>
      {/each}
    </div>
  </div>
</nav>
