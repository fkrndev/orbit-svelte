<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import FolderSearch from '@lucide/svelte/icons/folder-search'
  import type { PathCompletion, QuickOpenHit } from '$shared/types'
  import { api } from '@/rpcClient'
  import { browseTo, openByPath, openPath } from '@/actions'
  import { getState } from '@/store.svelte'
  import { rootLabels } from '@/components/sidebar/names'
  import { looksLikePath } from '$shared/pathInput'
  import { displayPath, typedPathAction } from '@/quickOpenPath'
  import { Input } from '@/components/ui/input'

  /**
   * The name switcher: one query across every folder the app knows.
   *
   * This is the "no single project folder" stance in one control — switching
   * projects costs a keystroke instead of a reopen. It is a modal because it is a
   * *detour*: you are in a note, you want another note, you are back in a note.
   * Nothing here is worth coming back to.
   *
   * Paths are the other half of that job, and they are not a detour — see
   * `FileBrowser`, which is a surface for exactly that reason. So a path typed or
   * pasted here is not completed in place; it is handed over. A complete path to
   * a file opens straight away, since that is unambiguous and instant, and
   * anything else takes you to the browser with the field already filled in.
   */
  let {
    /**
     * What the field starts with. A tag chip on Home opens the palette on
     * `#tag`, which is a query anyone could also type — the chip is a shortcut
     * to the search, not a private mechanism of its own.
     */
    initialQuery = '',
    onClose,
  }: { initialQuery?: string; onClose: () => void } = $props()

  // A starting value, not a mirror — hence `untrack`. The shell mounts this on
  // ⌘P and unmounts it on close, so a later change to the prop would only ever
  // be the palette reopening.
  let query = $state(untrack(() => initialQuery))
  let hits = $state<QuickOpenHit[]>([])
  let completion = $state<PathCompletion | null>(null)
  let home = $state('')
  let index = $state(0)
  let input = $state<HTMLInputElement | null>(null)

  const roots = $derived(getState().roots)
  const labels = $derived(rootLabels(roots))
  const rootNames = $derived(
    new Map(roots.map(root => [root.id, labels.get(root.path) ?? root.name])),
  )
  const pathMode = $derived(looksLikePath(query))

  onMount(() => {
    input?.focus()
    // Home is what expands `~` when there is no completion to expand it for us.
    api
      .listPlaces()
      .then(places => (home = places.home))
      .catch(() => undefined)
  })

  $effect(() => {
    const typed = query
    let cancelled = false
    // Short debounce: the walk is cached main-side, but typing fast should not
    // queue a request per character.
    const timer = setTimeout(() => {
      if (looksLikePath(typed)) {
        // Only to tell a finished path from a half-typed one. The listing is
        // the browser's job.
        api
          .completePath({ input: typed })
          .then(result => !cancelled && (completion = result))
          .catch(() => !cancelled && (completion = null))
        return
      }
      api
        .quickOpen({ query: typed, limit: 50 })
        .then(result => {
          if (cancelled) return
          hits = result
          index = 0
        })
        .catch(() => undefined)
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  })

  function handOverPath() {
    // A finished path to a note needs no browser: opening it is what was meant.
    const action = typedPathAction(query, home, completion)
    if (action.kind === 'open') void openByPath(action.path)
    else browseTo(query)
    onClose()
  }

  function choose(hit: QuickOpenHit | undefined) {
    if (pathMode) {
      handOverPath()
      return
    }
    if (!hit) return
    void openPath(hit.path)
    onClose()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose()
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      index = Math.min(index + 1, hits.length - 1)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      index = Math.max(index - 1, 0)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      choose(hits[index])
    }
  }

  /** The matched characters, lit so the ranking is legible rather than magic. */
  function segments(text: string, matched: number[]) {
    const set = new Set(matched)
    return [...text].map((char, at) => ({ char, hit: set.has(at) }))
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-40 flex items-start justify-center pt-[12vh]"
  style="background: rgb(0 0 0 / 28%)"
  onmousedown={onClose}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-[min(640px,90vw)] overflow-hidden rounded-xl border shadow-[var(--shadow)]"
    style="background: var(--bg-raised); border-color: var(--border-strong)"
    onmousedown={event => event.stopPropagation()}
  >
    <!--
      A palette field, not a form field: the surrounding panel already provides
      the frame, so the input's own chrome is removed.
    -->
    <Input
      bind:ref={input}
      value={query}
      spellcheck={false}
      autocomplete="off"
      placeholder="Search all folders, or paste a path"
      oninput={event => (query = (event.currentTarget as HTMLInputElement).value)}
      onkeydown={onKeyDown}
      class="h-auto rounded-none border-0 border-b border-[var(--border)] bg-transparent px-4 py-3.5 text-[15px] shadow-none focus-visible:border-[var(--border)] focus-visible:ring-0 md:text-[15px]"
    />

    <div class="max-h-[52vh] overflow-y-auto py-1">
      {#if pathMode}
        <button
          type="button"
          onclick={handOverPath}
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left"
          style="background: var(--bg-active)"
        >
          <FolderSearch size={15} strokeWidth={2} style="color: var(--brand)" />
          <span class="truncate text-[13px]" style="color: var(--text)">
            {completion?.openable
              ? `Open ${completion.resolved.slice(completion.resolved.lastIndexOf('/') + 1)}`
              : `Browse ${displayPath(completion?.dir ?? query, home)}`}
          </span>
          <span class="ml-auto shrink-0 text-[11px]" style="color: var(--text-faint)">⏎</span>
        </button>
      {:else if hits.length === 0}
        <p class="px-4 py-6 text-center text-[12.5px]" style="color: var(--text-faint)">
          {query ? 'No matches' : 'Type to search, or paste a path to open it'}
        </p>
      {:else}
        {#each hits as hit, at (hit.path)}
          <button
            type="button"
            onmouseenter={() => (index = at)}
            onclick={() => choose(hit)}
            class="flex w-full items-baseline gap-2 px-4 py-2 text-left"
            style="background: {at === index ? 'var(--bg-active)' : 'transparent'}"
          >
            <span class="truncate text-[13px]" style="color: var(--text)">
              {#each segments(hit.name.replace(/\.mdx?$/, ''), hit.matched) as part, charAt (charAt)}
                {#if part.hit}<b style="color: var(--brand); font-weight: 600">{part.char}</b>
                {:else}{part.char}{/if}
              {/each}
            </span>
            <span
              class="ml-auto shrink-0 truncate text-[11px]"
              style="color: var(--text-faint)"
            >
              {hit.rootId ? (rootNames.get(hit.rootId) ?? '') : ''}
            </span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>
