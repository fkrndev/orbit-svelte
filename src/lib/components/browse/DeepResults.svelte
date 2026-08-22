<script lang="ts">
  import FileText from '@lucide/svelte/icons/file-text'
  import Search from '@lucide/svelte/icons/search'
  import type { QuickOpenHit } from '$shared/types'
  import { displayPath } from '@/quickOpenPath'
  import MatchedText from './MatchedText.svelte'

  /** Results from a walk are a flat list — they belong to no single column. */
  let {
    deep,
    home,
    index,
    onHover,
    onOpen,
    onBack,
  }: {
    deep: { dir: string; hits: QuickOpenHit[]; truncated: boolean }
    home: string
    index: number
    onHover: (index: number) => void
    onOpen: (path: string) => void
    onBack: () => void
  } = $props()
</script>

<div class="min-h-0 flex-1 overflow-y-auto">
  <div
    class="flex items-center gap-2 border-b px-4 py-1.5 text-[11.5px]"
    style="border-color: var(--border); color: var(--text-muted)"
  >
    <Search size={12} strokeWidth={2} />
    <span class="truncate font-mono">searched inside {displayPath(deep.dir, home)}</span>
    <button
      type="button"
      onclick={onBack}
      class="ml-auto shrink-0 rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--bg-hover)]"
    >
      back to columns
    </button>
  </div>

  {#if deep.hits.length === 0}
    <p class="p-8 text-center text-[12.5px]" style="color: var(--text-faint)">
      Nothing under that folder matches.
    </p>
  {:else}
    <div class="p-2">
      {#each deep.hits as hit, i (hit.path)}
        <button
          type="button"
          onmousedown={event => event.preventDefault()}
          onmouseenter={() => onHover(i)}
          onclick={() => onOpen(hit.path)}
          class="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[13px]"
          style="background: {i === index ? 'var(--bg-active)' : 'transparent'}"
        >
          <FileText size={14} strokeWidth={2} class="shrink-0" style="color: var(--text-faint)" />
          <span class="truncate"><MatchedText text={hit.name} matched={hit.matched} /></span>
          <span class="ml-auto shrink-0 truncate text-[11px]" style="color: var(--text-faint)">
            {displayPath(hit.path.slice(0, hit.path.lastIndexOf('/')), home)}
          </span>
        </button>
      {/each}
    </div>
  {/if}

  {#if deep.truncated}
    <p class="px-4 py-2 text-[11px]" style="color: var(--text-faint)">
      Stopped after the first 2000 files — narrow the folder to see the rest.
    </p>
  {/if}
</div>
