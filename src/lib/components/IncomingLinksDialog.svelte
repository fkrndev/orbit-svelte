<script lang="ts" module>
  import { setState } from '@/store.svelte'

  export function showIncomingLinks(path: string) {
    setState({ incomingLinks: { path } })
  }

  export function closeIncomingLinks() {
    setState({ incomingLinks: null })
  }
</script>

<script lang="ts">
  import CornerDownRight from '@lucide/svelte/icons/corner-down-right'
  import FileIcon from '@lucide/svelte/icons/file'
  import type { IncomingLinkScan } from '$shared/types'
  import { api } from '@/rpcClient'
  import { openPath } from '@/actions'
  import * as Dialog from '@/components/ui/dialog'

  /**
   * Which of the open folders link to this file.
   *
   * A dialog rather than a panel, and that is the whole design. A permanent
   * backlink panel would have to answer the question continuously, and its empty
   * state would be a lie by omission — it cannot see the folders you have not
   * opened, but an empty panel reads as "nothing links here". Asked as a question,
   * it is plainly a search, and a search that reports what it searched.
   *
   * Which is why the footer is not decoration: the file count is the caveat, and
   * it stays on screen next to the result rather than being something you have to
   * remember about the feature.
   */
  let { path }: { path: string } = $props()

  let scan = $state<IncomingLinkScan | null>(null)
  let failed = $state(false)
  let active = $state(0)

  $effect(() => {
    let cancelled = false
    api
      .findIncomingLinks({ path })
      .then(result => !cancelled && (scan = result))
      .catch(() => !cancelled && (failed = true))
    return () => {
      cancelled = true
    }
  })

  const hits = $derived(scan?.hits ?? [])

  function choose(target: string) {
    closeIncomingLinks()
    void openPath(target)
  }

  /**
   * Says what was searched, not just what was found.
   *
   * "No file links here" on its own would be a claim this cannot support: a note
   * in a folder that is not open can link here and never be seen. Naming the
   * searched set turns the same answer into one that is true.
   */
  const caption = $derived.by(() => {
    if (!scan) return ''
    const files = `${scan.scanned} file${scan.scanned === 1 ? '' : 's'}`
    if (scan.truncated) return `Stopped early — searched ${files} in your open folders so far.`
    return `Searched ${files} in your open folders. Notes elsewhere are not included.`
  })
</script>

<Dialog.Root open onOpenChange={open => !open && closeIncomingLinks()}>
  <Dialog.Content
    class="top-[18%] max-w-xl translate-y-0 gap-0 p-0"
    onkeydown={event => {
      // Arrow keys have to reach this dialog rather than the editor behind it,
      // and there is no input here to focus the way the palette has.
      event.stopPropagation()
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        active = Math.min(active + 1, hits.length - 1)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        active = Math.max(active - 1, 0)
      }
      if (event.key === 'Enter' && hits[active]) choose(hits[active].path)
    }}
  >
    <Dialog.Header class="border-b px-4 pt-4 pb-3" style="border-color: var(--border)">
      <Dialog.Title class="text-[14px]">Files linking here</Dialog.Title>
    </Dialog.Header>

    <div class="max-h-80 overflow-y-auto px-1.5 py-2">
      {#if failed}
        <p class="px-3 py-4 text-[12.5px]" style="color: var(--text-faint)">
          Could not search the open folders.
        </p>
      {:else if !scan}
        <p class="px-3 py-4 text-[12.5px]" style="color: var(--text-faint)">
          Searching the open folders…
        </p>
      {:else if hits.length === 0}
        <p class="px-3 py-4 text-[12.5px]" style="color: var(--text-faint)">No file links here.</p>
      {:else}
        {#each hits as hit, index (hit.path)}
          <button
            type="button"
            onmouseenter={() => (active = index)}
            onclick={() => choose(hit.path)}
            class="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left"
            style="background: {index === active ? 'var(--bg-hover)' : 'transparent'}"
          >
            <span class="flex w-full items-center gap-2">
              <FileIcon
                size={16}
                strokeWidth={2}
                style="color: var(--text-faint)"
                class="shrink-0"
              />
              <span class="truncate text-[13px]">{hit.name.replace(/\.mdx?$/i, '')}</span>
              <span class="ml-auto shrink-0 pl-3 text-[11px]" style="color: var(--text-faint)">
                <!--
                  The count only earns its place when it is not one — a row of
                  "1×" badges is noise on the common case.
                -->
                {hit.count > 1 ? `${hit.count} links · ` : ''}{hit.folder}
              </span>
            </span>
            <span
              class="flex items-start gap-1.5 pl-[24px] text-[11.5px] leading-snug"
              style="color: var(--text-faint)"
            >
              <CornerDownRight size={12} strokeWidth={2} class="mt-[2px] shrink-0" />
              <span class="truncate">{hit.excerpt}</span>
            </span>
          </button>
        {/each}
      {/if}
    </div>

    {#if scan}
      <p
        class="border-t px-4 py-2.5 text-[11.5px]"
        style="border-color: var(--border); color: var(--text-faint)"
      >
        {caption}
      </p>
    {/if}
  </Dialog.Content>
</Dialog.Root>
