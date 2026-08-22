<script lang="ts">
  import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical'
  import type { DashboardItem, TodoTally } from '$shared/types'
  import { api } from '@/rpcClient'
  import { openPath } from '@/actions'
  import { relativeTime } from '@/format'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import FileMenu from '@/components/sidebar/FileMenu.svelte'
  import type { DecorRequest } from '@/components/sidebar/rowMenus'

  let {
    item,
    tally,
    onDecor,
  }: {
    item: DashboardItem
    tally: TodoTally | undefined
    onDecor: (request: DecorRequest) => void
  } = $props()

  let menuOpen = $state(false)

  const path = $derived(item.meta.path)
  const name = $derived(path.slice(path.lastIndexOf('/') + 1).replace(/\.mdx?$/, ''))
  const folder = $derived(path.slice(0, path.lastIndexOf('/')))
  const stamp = $derived(item.lastEditedAt ?? item.lastOpenedAt)

  /**
   * The note's opening line, fetched rather than derived.
   *
   * Home has no buffer for a file it has not opened, and reading the whole file
   * to show two lines of it would be paying for the document to draw its cover.
   * `peekFile` already exists for exactly this — it is what Recents' large
   * preview uses.
   */
  let excerpt = $state('')

  $effect(() => {
    let live = true
    api
      .peekFile({ path })
      .then(result => live && (excerpt = result.excerpt))
      .catch(() => live && (excerpt = ''))
    return () => {
      live = false
    }
  })

  const done = $derived(tally ? tally.total - tally.open : 0)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group relative flex flex-col rounded-lg border transition-colors hover:bg-[var(--bg-hover)]"
  style="border-color: var(--border)"
  oncontextmenu={event => {
    event.preventDefault()
    menuOpen = true
  }}
>
  <button
    type="button"
    onclick={() => void openPath(path)}
    title={path}
    class="flex min-h-[104px] flex-1 flex-col gap-1.5 px-3.5 py-3 text-left"
  >
    <span class="truncate pr-6 text-[13.5px] font-medium">{name}</span>

    <!--
      Two lines, clamped: enough to recognise the note, never enough to read it
      here instead of opening it.
    -->
    <span class="line-clamp-2 text-[11.5px] leading-relaxed" style="color: var(--text-muted)">
      {excerpt}
    </span>

    <span
      class="mt-auto flex items-center gap-1.5 text-[11px]"
      style="color: var(--text-faint)"
    >
      <span class="truncate">{folder.slice(folder.lastIndexOf('/') + 1)}</span>
      {#if stamp > 0}
        <span>·</span>
        <span class="shrink-0">{relativeTime(stamp)}</span>
      {/if}
    </span>

    {#if tally && tally.total > 0}
      <span class="flex w-full items-center gap-2 pt-1.5">
        <span
          class="h-1 min-w-0 flex-1 overflow-hidden rounded-full"
          style="background: var(--bg-active)"
        >
          <span
            class="block h-full rounded-full"
            style="width: {(done / tally.total) * 100}%; background: var(--ok)"
          ></span>
        </span>
        <span class="shrink-0 text-[10.5px] tabular-nums" style="color: var(--text-faint)">
          {done}/{tally.total}
        </span>
      </span>
    {/if}
  </button>

  <DropdownMenu.Root bind:open={menuOpen}>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          title="More"
          class="absolute top-2 right-1.5 rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-[var(--bg-active)] data-[state=open]:opacity-100"
          style="color: var(--text-faint)"
        >
          <EllipsisVertical size={16} strokeWidth={2} />
        </button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="min-w-44">
      <FileMenu {path} meta={item.meta} {onDecor} />
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
