<script lang="ts">
  import { onMount } from 'svelte'
  import ArrowUp from '@lucide/svelte/icons/arrow-up'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import FileText from '@lucide/svelte/icons/file-text'
  import Folder from '@lucide/svelte/icons/folder'
  import House from '@lucide/svelte/icons/house'
  import type { DirEntry } from '$shared/types'
  import { api } from '@/rpcClient'
  import { closePicker, confirmPickedPath } from '@/actions'
  import { Button } from '@/components/ui/button'

  /**
   * A filesystem browser built out of the app's own `listDir`.
   *
   * The browser build has no system dialog, and this is the answer: the folder
   * listing already comes from the same service the sidebar uses, so anywhere the
   * app can read, the picker can reach.
   *
   * It also filters the way the rest of the app does — no `node_modules`, no
   * dotfiles, markdown only — which makes it noticeably less noisy than the
   * native dialog for this particular job.
   */
  let { mode }: { mode: 'file' | 'folder' } = $props()

  let dir = $state<string | null>(null)
  let entries = $state<DirEntry[]>([])
  let places = $state<Array<{ name: string; path: string }>>([])
  let error = $state<string | null>(null)
  let loading = $state(true)

  onMount(() => {
    api
      .listPlaces()
      .then(result => {
        places = result.places
        dir = result.home
      })
      .catch(err => {
        error = String(err)
        loading = false
      })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePicker()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  $effect(() => {
    const target = dir
    if (!target) return
    loading = true
    api
      .listDir({ path: target })
      .then(result => {
        entries = result
        error = null
      })
      .catch(err => {
        entries = []
        error = `Cannot read ${target}: ${String(err)}`
      })
      .finally(() => (loading = false))
  })

  const parent = $derived(dir && dir !== '/' ? dir.slice(0, dir.lastIndexOf('/')) || '/' : null)
  const folders = $derived(entries.filter(entry => entry.isDirectory))
  const files = $derived(mode === 'file' ? entries.filter(entry => !entry.isDirectory) : [])

  const ROW =
    'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)]'
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-40 flex items-center justify-center"
  style="background: rgb(0 0 0 / 32%)"
  onmousedown={closePicker}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex h-[min(560px,80vh)] w-[min(760px,92vw)] flex-col overflow-hidden rounded-xl border shadow-[var(--shadow)]"
    style="background: var(--bg-raised); border-color: var(--border-strong)"
    onmousedown={event => event.stopPropagation()}
  >
    <header
      class="flex shrink-0 items-center gap-2 border-b px-4 py-3"
      style="border-color: var(--border)"
    >
      <span class="text-[13.5px] font-medium">
        {mode === 'folder' ? 'Add a folder' : 'Open a file'}
      </span>
      <span class="ml-auto truncate text-[11.5px]" style="color: var(--text-faint)">{dir}</span>
    </header>

    <div class="flex min-h-0 flex-1">
      <nav
        class="w-40 shrink-0 overflow-y-auto border-r p-2"
        style="border-color: var(--border); background: var(--bg-sunken)"
      >
        {#each places as place (place.path)}
          <button
            type="button"
            onclick={() => (dir = place.path)}
            class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--bg-hover)]"
            style="color: {dir === place.path ? 'var(--text)' : 'var(--text-muted)'}"
          >
            <House size={16} strokeWidth={2} />
            {place.name}
          </button>
        {/each}
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        {#if parent}
          <button
            type="button"
            onclick={() => (dir = parent)}
            class={ROW}
            style="color: var(--text-muted)"
          >
            <ArrowUp size={16} strokeWidth={2} />
            ..
          </button>
        {/if}

        {#each folders as entry (entry.path)}
          <button
            type="button"
            onclick={() => (dir = entry.path)}
            ondblclick={() => mode === 'folder' && void confirmPickedPath('folder', entry.path)}
            class={ROW}
          >
            <Folder size={16} strokeWidth={2} style="color: var(--brand)" />
            <span class="truncate">{entry.name}</span>
            <ChevronRight
              size={16}
              strokeWidth={2}
              class="ml-auto"
              style="color: var(--text-faint)"
            />
          </button>
        {/each}

        {#each files as entry (entry.path)}
          <button
            type="button"
            onclick={() => void confirmPickedPath('file', entry.path)}
            class={ROW}
          >
            <FileText size={16} strokeWidth={2} style="color: var(--text-muted)" />
            <span class="truncate">{entry.name}</span>
          </button>
        {/each}

        {#if !loading && folders.length === 0 && files.length === 0 && !error}
          <p class="px-2.5 py-6 text-[12.5px]" style="color: var(--text-faint)">
            {mode === 'file' ? 'No markdown files or subfolders here.' : 'No subfolders here.'}
          </p>
        {/if}

        {#if error}
          <p class="px-2.5 py-6 text-[12.5px]" style="color: var(--danger)">{error}</p>
        {/if}
      </div>
    </div>

    <footer
      class="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3"
      style="border-color: var(--border)"
    >
      <Button variant="outline" size="sm" onclick={closePicker}>Cancel</Button>
      {#if mode === 'folder'}
        <Button size="sm" disabled={!dir} onclick={() => dir && void confirmPickedPath('folder', dir)}>
          Add this folder
        </Button>
      {/if}
    </footer>
  </div>
</div>
