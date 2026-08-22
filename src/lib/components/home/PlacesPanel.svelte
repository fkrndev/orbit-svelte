<script lang="ts">
  import AtSign from '@lucide/svelte/icons/at-sign'
  import Folder from '@lucide/svelte/icons/folder'
  import Hash from '@lucide/svelte/icons/hash'
  import type { Dashboard } from '$shared/types'
  import { browseTo } from '@/actions'
  import { getState } from '@/store.svelte'
  import { relativeTime } from '@/format'
  import { rootLabels } from '@/components/sidebar/names'

  /**
   * Where the notes live: the folders, and the tags across them.
   *
   * Both counts were already computed and both were thrown away — `rootCounts`
   * and `tagCounts` came down the wire on every load and nothing drew them. That
   * is the whole reason this block exists: Home was paying for the answer to
   * "where is everything" and not showing it.
   *
   * It is not a second file tree. A root row hands you to the path browser, which
   * is the surface built for walking folders; a tag chip runs the search that
   * finds its files. Nothing here is a list you can only look at.
   */
  let {
    data,
    /** From `listTags` — the `tags:` property and `#tag` in the prose, as one. */
    tags,
    /** From `listMentions`. Prose only; there is no `mentions:` property. */
    mentions,
    onSearch,
  }: {
    data: Dashboard
    tags: Array<{ tag: string; count: number }>
    mentions: Array<{ mention: string; count: number }>
    onSearch: (query: string) => void
  } = $props()

  const roots = $derived(getState().roots)
  const labels = $derived(rootLabels(roots))

  /**
   * Tags first, then mentions, both by count — one row rather than two.
   *
   * They answer the same question here ("what is this vault about"), and two
   * headed sections for what is usually a dozen chips is chrome outweighing
   * content. The sigil on each chip says which kind it is.
   */
  const chips = $derived([
    ...tags.map(entry => ({ kind: 'tag' as const, label: entry.tag, count: entry.count })),
    ...mentions.map(entry => ({
      kind: 'mention' as const,
      label: entry.mention,
      count: entry.count,
    })),
  ])
</script>

<div>
  <h2
    class="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase"
    style="color: var(--text-faint)"
  >
    Places
  </h2>

  <div class="mt-2.5 flex flex-col">
    {#each roots as root (root.id)}
      {@const count = data.rootCounts.find(entry => entry.rootId === root.id)?.count ?? 0}
      <button
        type="button"
        onclick={() => browseTo(`${root.path}/`)}
        title={root.path}
        class="flex items-center gap-2 rounded px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
      >
        <Folder size={16} strokeWidth={2} class="shrink-0" style="color: var(--text-faint)" />
        <span class="min-w-0 flex-1 truncate text-[12.5px]">
          {labels.get(root.path) ?? root.name}
        </span>
        <span class="shrink-0 text-[11px]" style="color: var(--text-faint)">
          <!--
            Tracked files, not files on disk: this is the count Home can answer
            without a walk, and it says how much of the folder you have actually
            worked in.
          -->
          {count > 0 ? `${count} tracked` : 'none opened'}{root.lastOpenedAt > 0
            ? ` · ${relativeTime(root.lastOpenedAt)}`
            : ''}
        </span>
      </button>
    {/each}
  </div>

  {#if chips.length > 0}
    <div class="mt-3 flex flex-wrap gap-1.5">
      {#each chips.slice(0, 18) as chip (`${chip.kind}:${chip.label}`)}
        {@const sigil = chip.kind === 'tag' ? '#' : '@'}
        {@const Icon = chip.kind === 'tag' ? Hash : AtSign}
        <!--
          `#tag` and `@name` are real queries the palette understands, so the
          chip is a shortcut to something you could also type — not a private
          mechanism only Home knows about. See `parseRefQuery`.
        -->
        <button
          type="button"
          onclick={() => onSearch(`${sigil}${chip.label}`)}
          title={chip.kind === 'tag'
            ? `Find notes tagged ${chip.label}`
            : `Find notes mentioning ${chip.label}`}
          class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors hover:bg-[var(--bg-hover)]"
          style="border-color: var(--border); color: var(--text-muted)"
        >
          <Icon size={16} strokeWidth={2} style="color: var(--text-faint)" />
          {chip.label}
          <span style="color: var(--text-faint)">{chip.count}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
