<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import AtSign from '@lucide/svelte/icons/at-sign'
  import FileIcon from '@lucide/svelte/icons/file'
  import Hash from '@lucide/svelte/icons/hash'
  import type { InlineRefKind } from '$shared/inlineRefs'
  import type { RefHit } from '$shared/types'
  import { api, onFileChange } from '@/rpcClient'
  import { getState } from '@/store.svelte'
  import { openPathAtLine } from '@/actions'
  import FilterField from './FilterField.svelte'

  /**
   * Every `#tag` and `@mention` in the vault, and what is under them.
   *
   * The counts existed before this panel did — Home has drawn tag chips for a
   * while — but a chip can only hand you to a search box. This is the surface
   * for the other half of the question: not "find the notes tagged X" typed from
   * memory, but "what have I been tagging at all", which you cannot ask until
   * something lists them.
   *
   * Two levels rather than a tree. The column is 260px and a note row already
   * wants most of that; nesting the notes under an expanded tag would leave them
   * ellipsised into uselessness. So picking a ref replaces the list, and the
   * header walks back.
   */
  const activePath = $derived(getState().activePath)
  const focusRequest = $derived(getState().sidebar.focusFilter)

  interface Ref {
    kind: InlineRefKind
    label: string
    count: number
  }

  let refs = $state<Ref[]>([])
  let loading = $state(true)
  let query = $state('')

  /** The ref being looked into, or `null` while the list is showing. */
  let opened = $state<Ref | null>(null)
  let hits = $state<RefHit[]>([])
  let hitsLoading = $state(false)

  /**
   * A request that came back an error, kept apart from one that came back
   * nothing.
   *
   * They were the same thing here, and the panel said "Nothing carries this any
   * more" over a count of 1 — which reads as *your notes changed*, and sends you
   * looking at the wrong thing entirely. What it meant was that the request
   * never arrived: in this app that is usually a desktop build whose backend is
   * older than its webview, since the window loads the interface from the dev
   * server but keeps the bundled Bun process it started with.
   */
  let failed = $state(false)

  function load() {
    Promise.all([api.listTags(), api.listMentions()])
      .then(([tags, mentions]) => {
        failed = false
        refs = [
          ...tags.map(entry => ({ kind: 'tag' as const, label: entry.tag, count: entry.count })),
          ...mentions.map(entry => ({
            kind: 'mention' as const,
            label: entry.mention,
            count: entry.count,
          })),
        ]
      })
      .catch(() => {
        failed = true
        refs = []
      })
      .finally(() => (loading = false))
  }

  function loadHits(ref: Ref) {
    hitsLoading = true
    api
      .notesWithRef({ kind: ref.kind, label: ref.label })
      .then(next => {
        failed = false
        hits = next
      })
      .catch(() => {
        failed = true
        hits = []
      })
      .finally(() => (hitsLoading = false))
  }

  $effect(() => {
    load()
    const refresh = () => {
      load()
      // The open ref's notes are as stale as the counts are — a save is exactly
      // how a note joins or leaves a tag.
      const current = opened
      if (current) loadHits(current)
    }
    window.addEventListener('app:meta-changed', refresh)
    const stop = onFileChange(refresh)
    return () => {
      window.removeEventListener('app:meta-changed', refresh)
      stop()
    }
  })

  function open(ref: Ref) {
    opened = ref
    hits = []
    loadHits(ref)
  }

  const matches = $derived.by(() => {
    const term = query.trim().toLowerCase()
    // The sigil is part of what people type, and filtering `#dra` against a
    // label of `draft` would otherwise find nothing.
    const bare = term.replace(/^[#@]/, '')
    const kind: InlineRefKind | null = term.startsWith('#')
      ? 'tag'
      : term.startsWith('@')
        ? 'mention'
        : null
    return refs.filter(
      ref => (!kind || ref.kind === kind) && (bare === '' || ref.label.toLowerCase().includes(bare)),
    )
  })
</script>

<div class="flex min-h-0 flex-1 flex-col">
  {#if opened}
    {@const Icon = opened.kind === 'tag' ? Hash : AtSign}
    <div class="flex items-center gap-1 px-2 pt-2 pb-1">
      <button
        type="button"
        onclick={() => (opened = null)}
        title="All tags and mentions"
        class="rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
        style="color: var(--text-muted)"
      >
        <ArrowLeft size={16} strokeWidth={2} />
      </button>
      <Icon size={15} strokeWidth={2} style="color: var(--text-faint)" class="shrink-0" />
      <span class="min-w-0 flex-1 truncate text-[12.5px] font-medium">{opened.label}</span>
      <span class="shrink-0 pr-1 text-[11px]" style="color: var(--text-faint)">
        {opened.count}
        {opened.count === 1 ? 'note' : 'notes'}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-1.5 pb-3">
      {#if !hitsLoading && hits.length === 0}
        <p class="px-2.5 py-3 text-[12px] leading-relaxed" style="color: var(--text-faint)">
          {#if failed}
            Could not reach the index. If this is a desktop build, restart it — the window can be
            newer than the process behind it.
          {:else}
            Nothing carries this any more.
          {/if}
        </p>
      {/if}

      {#each hits as hit (hit.path)}
        <button
          type="button"
          onclick={() => void openPathAtLine(hit.path, hit.line)}
          title="{hit.path}:{hit.line + 1}"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
          style={hit.path === activePath ? 'background: var(--bg-hover)' : ''}
        >
          <FileIcon size={15} strokeWidth={2} style="color: var(--text-faint)" class="shrink-0" />
          <span
            class="min-w-0 flex-1 truncate text-[12.5px] font-semibold"
            style="color: var(--text)"
          >
            {hit.name.replace(/\.mdx?$/i, '')}
          </span>
          <!-- How often the note says it: the one that is *about* this tag is
               usually the one that repeats it. -->
          {#if hit.count > 1}
            <span class="shrink-0 text-[11px]" style="color: var(--text-faint)">{hit.count}</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <div class="flex items-center gap-1 px-2 pt-2 pb-1">
      <FilterField
        value={query}
        placeholder="Filter tags…"
        onChange={value => (query = value)}
        {focusRequest}
      />
    </div>

    <div
      class="px-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase"
      style="color: var(--text-faint)"
    >
      {query.trim() ? `${matches.length} of ${refs.length}` : 'Tags & mentions'}
    </div>

    <div class="flex-1 overflow-y-auto px-1.5 pb-3">
      {#if !loading && refs.length === 0}
        <p class="px-2.5 py-3 text-[12px] leading-relaxed" style="color: var(--text-faint)">
          {#if failed}
            Could not reach the index. If this is a desktop build, restart it — the window can be
            newer than the process behind it.
          {:else}
            No <code class="px-0.5">#tag</code> or <code class="px-0.5">@mention</code> in your notes
            yet. Type either one while writing and it turns up here.
          {/if}
        </p>
      {/if}

      {#if refs.length > 0 && matches.length === 0}
        <p class="px-2.5 py-3 text-[12px]" style="color: var(--text-faint)">
          Nothing matches “{query.trim()}”.
        </p>
      {/if}

      {#each matches as ref (`${ref.kind}:${ref.label}`)}
        {@const Icon = ref.kind === 'tag' ? Hash : AtSign}
        <button
          type="button"
          onclick={() => open(ref)}
          title={ref.kind === 'tag'
            ? `Notes tagged ${ref.label}`
            : `Notes mentioning ${ref.label}`}
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
        >
          <Icon size={15} strokeWidth={2} style="color: var(--text-faint)" class="shrink-0" />
          <span class="min-w-0 flex-1 truncate text-[12.5px]">{ref.label}</span>
          <span class="shrink-0 text-[11px]" style="color: var(--text-faint)">{ref.count}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
