<script lang="ts" module>
  import { setState } from '@/store.svelte'

  export function closeLinkFile() {
    setState({ linkFile: null })
  }

  /** Fired at the mounted editor, which knows how to insert at the cursor. */
  export function insertLink(href: string, text: string) {
    window.dispatchEvent(new CustomEvent('app:insert-link', { detail: { href, text } }))
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import FileIcon from '@lucide/svelte/icons/file'
  import { fuzzyMatch } from '$shared/fuzzy'
  import { api } from '@/rpcClient'
  import { relativePathBetween } from '$shared/relativePath'
  import * as Dialog from '@/components/ui/dialog'
  import { Input } from '@/components/ui/input'

  /**
   * Pick another note and link to it.
   *
   * The link is written **relative to the note being edited**, not absolute:
   * there is no vault root to resolve against here, and an absolute path breaks
   * the moment the folder is moved or opened on another machine. A relative link
   * is also what every other markdown tool will follow.
   */
  let { fromPath }: { fromPath: string } = $props()

  let query = $state('')
  let files = $state<Array<{ path: string; name: string }>>([])
  let active = $state(0)

  onMount(() => {
    api
      .listMarkdownFiles({})
      .then(all => (files = all.filter(file => file.path !== fromPath)))
      .catch(() => (files = []))
  })

  const hits = $derived.by(() => {
    const term = query.trim()
    if (!term) return files.slice(0, 40)
    return files
      .map(file => ({ file, match: fuzzyMatch(term, file.name) }))
      .filter(hit => hit.match.match)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 40)
      .map(hit => hit.file)
  })

  // A new query is a new list, so the highlight starts at the top of it.
  $effect(() => {
    void query
    active = 0
  })

  function choose(file: { path: string; name: string }) {
    insertLink(relativePathBetween(fromPath, file.path), file.name.replace(/\.mdx?$/i, ''))
    closeLinkFile()
  }
</script>

<Dialog.Root open onOpenChange={open => !open && closeLinkFile()}>
  <Dialog.Content class="top-[18%] max-w-xl translate-y-0 gap-3 p-0" showCloseButton={false}>
    <Dialog.Header class="sr-only">
      <Dialog.Title>Link to a note</Dialog.Title>
    </Dialog.Header>
    <div class="border-b px-3 pt-3 pb-2" style="border-color: var(--border)">
      <!-- svelte-ignore a11y_autofocus -->
      <Input
        autofocus
        bind:value={query}
        onkeydown={event => {
          // The editor behind this is a contenteditable that grabs keys
          // aggressively; stopping propagation keeps them here.
          event.stopPropagation()
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            active = Math.min(active + 1, hits.length - 1)
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            active = Math.max(active - 1, 0)
          }
          if (event.key === 'Enter' && hits[active]) choose(hits[active])
        }}
        placeholder="Link to a note…"
        class="border-0 bg-transparent text-[14px] shadow-none focus-visible:ring-0"
      />
    </div>
    <div class="max-h-80 overflow-y-auto px-1.5 pb-2">
      {#if hits.length === 0}
        <p class="px-3 py-4 text-[12.5px]" style="color: var(--text-faint)">
          No other notes match.
        </p>
      {:else}
        {#each hits as file, index (file.path)}
          <button
            type="button"
            onmouseenter={() => (active = index)}
            onclick={() => choose(file)}
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left"
            style="background: {index === active ? 'var(--bg-hover)' : 'transparent'}"
          >
            <FileIcon size={16} strokeWidth={2} style="color: var(--text-faint)" class="shrink-0" />
            <span class="truncate text-[13px]">{file.name.replace(/\.mdx?$/i, '')}</span>
            <span class="ml-auto truncate pl-3 text-[11px]" style="color: var(--text-faint)">
              {relativePathBetween(fromPath, file.path)}
            </span>
          </button>
        {/each}
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
