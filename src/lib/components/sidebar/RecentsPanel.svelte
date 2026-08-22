<script lang="ts">
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import type { RecentItem, RecentSort, RecentsPreview } from '$shared/types'
  import { api, onFileChange } from '@/rpcClient'
  import { getState } from '@/store.svelte'
  import { setRecentsGrouped, setRecentsPreview, setRecentsSort } from '@/sidebar'
  import {
    canGroupByDay,
    filterRecents,
    groupByDay,
    previewLines,
    previewNeedsExcerpt,
  } from '$shared/recents'
  import { dayLabel } from '@/format'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import FilterField from './FilterField.svelte'
  import { folderLabels } from './names'
  import RecentRow from './RecentRow.svelte'
  import type { DecorRequest } from './rowMenus'

  /**
   * Files you have actually opened, one row each.
   *
   * The data was already here — `history.json` plus `frecency.ts` — but neither
   * existing consumer fit: the event log is event-shaped, so a file opened ten
   * times is ten rows, and the dashboard's version is built for a page four times
   * this wide.
   */
  let { onDecor }: { onDecor: (request: DecorRequest) => void } = $props()

  const SORT_LABEL: Record<RecentSort, string> = {
    recent: 'Recently opened',
    opens: 'Most opened',
    frecency: 'Frecency',
  }

  const PREVIEW_STYLES: Array<{ value: RecentsPreview; label: string }> = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ]

  const sort = $derived(getState().settings.recentsSort)
  const grouped = $derived(getState().settings.recentsGrouped)
  const preview = $derived(getState().settings.recentsPreview)
  const activePath = $derived(getState().activePath)
  const focusRequest = $derived(getState().sidebar.focusFilter)

  let items = $state<RecentItem[]>([])
  let loading = $state(true)

  /**
   * Local, not in the store like the tree's query: this narrows rows that are
   * already here rather than driving a backend call, and a filter on a list of
   * recent files is a momentary thing — coming back to the panel with an old
   * query still applied would hide files the panel exists to show.
   */
  let query = $state('')

  const lines = $derived(previewLines(preview))

  function load() {
    api
      .listRecents({ sort, limit: 80, withExcerpt: previewNeedsExcerpt(preview) })
      .then(next => (items = next))
      .catch(() => (items = []))
      .finally(() => (loading = false))
  }

  // Opening a file writes a history event, so the list this panel shows is
  // stale the moment the user acts on it — hence `activePath` as a dependency
  // alongside the two settings the query itself is built from.
  $effect(() => {
    void sort
    void preview
    void activePath
    load()
  })

  $effect(() => {
    const refresh = () => load()
    window.addEventListener('app:meta-changed', refresh)
    const stop = onFileChange(refresh)
    return () => {
      window.removeEventListener('app:meta-changed', refresh)
      stop()
    }
  })

  const matches = $derived(filterRecents(items, query))

  // Day buckets only describe a list that runs in time order — see
  // `shared/recents.ts`, which the backend's sort reads from too.
  const canGroup = $derived(canGroupByDay(sort))
  const groups = $derived(groupByDay(matches, dayLabel, grouped && canGroup))
  const folders = $derived(folderLabels(matches.map(item => item.path)))
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="flex items-center gap-1 px-2 pt-2 pb-1">
    <FilterField
      value={query}
      placeholder="Filter recents…"
      onChange={value => (query = value)}
      {focusRequest}
    />

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            type="button"
            title="Sort, grouping, and preview style"
            class="rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
            style="color: var(--text-muted)"
          >
            <Ellipsis size={16} strokeWidth={2} />
          </button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="min-w-48">
        <DropdownMenu.Label>Sort by</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={sort}
          onValueChange={value => void setRecentsSort(value as RecentSort)}
        >
          <DropdownMenu.RadioItem value="recent">Recently opened</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="opens">Most opened</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="frecency">Frecency</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Preview Style</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent class="min-w-32">
            <DropdownMenu.RadioGroup
              value={preview}
              onValueChange={value => void setRecentsPreview(value as RecentsPreview)}
            >
              {#each PREVIEW_STYLES as style (style.value)}
                <DropdownMenu.RadioItem value={style.value}>{style.label}</DropdownMenu.RadioItem>
              {/each}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
        <DropdownMenu.Separator />
        <!--
          Disabled rather than hidden, so it is clear the option exists and why
          it does not apply to the sort currently chosen.
        -->
        <DropdownMenu.CheckboxItem
          checked={grouped && canGroup}
          disabled={!canGroup}
          onCheckedChange={value => void setRecentsGrouped(Boolean(value))}
        >
          Group by day
        </DropdownMenu.CheckboxItem>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <!--
    The caption names the sort, which is otherwise only visible inside the
    menu — and gives way to a count while filtering, because then the question
    is how much of the list you are still looking at.
  -->
  <div
    class="px-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase"
    style="color: var(--text-faint)"
  >
    {query.trim() ? `${matches.length} of ${items.length}` : SORT_LABEL[sort]}
  </div>

  <div class="flex-1 overflow-y-auto px-1.5 pb-3">
    {#if !loading && items.length === 0}
      <p class="px-2.5 py-3 text-[12px]" style="color: var(--text-faint)">Nothing opened yet.</p>
    {/if}

    <!--
      Says what was searched, because this box only knows the files you have
      opened — the one that knows all of them is ⌘P.
    -->
    {#if items.length > 0 && matches.length === 0}
      <p class="px-2.5 py-3 text-[12px] leading-relaxed" style="color: var(--text-faint)">
        Nothing in recents matches “{query.trim()}”. ⌘P searches every folder.
      </p>
    {/if}

    {#each groups as group (group.label ?? 'all')}
      <div class="mb-1">
        {#if group.label}
          <div
            class="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase"
            style="color: var(--text-faint)"
          >
            {group.label}
          </div>
        {/if}
        {#each group.items as item (item.path)}
          <RecentRow
            {item}
            {sort}
            {lines}
            folder={folders.get(item.path.slice(0, item.path.lastIndexOf('/')))}
            active={item.path === activePath}
            {onDecor}
          />
        {/each}
      </div>
    {/each}
  </div>
</div>
