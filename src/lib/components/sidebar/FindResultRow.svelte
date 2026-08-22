<script lang="ts">
  import { activateFindMatch } from '@/find'
  import type { FindResultRow } from '@/editor/findResultRows'

  let { row, active }: { row: FindResultRow; active: boolean } = $props()

  let element = $state<HTMLButtonElement | null>(null)

  // Stepping through hits with the arrow buttons moves the selection here too,
  // and a selected row below the fold is the same as no selection at all.
  $effect(() => {
    if (active) element?.scrollIntoView({ block: 'nearest' })
  })
</script>

<!--
  Not a shadcn Button: this is a list row, like `SidebarRow`, and the component's
  paddings and hover treatment are built for a control.
-->
<button
  bind:this={element}
  type="button"
  class="flex w-full items-baseline gap-2 px-2.5 py-[3px] text-left text-[12px] leading-[1.5]"
  style="background: {active ? 'var(--bg-active)' : 'transparent'}; color: var(--text-muted)"
  onmouseenter={event => {
    if (!active) (event.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
  }}
  onmouseleave={event => {
    if (!active) (event.currentTarget as HTMLElement).style.background = 'transparent'
  }}
  onclick={() => activateFindMatch(row.index, { focusEditor: true })}
>
  <span class="shrink-0 text-[10.5px] tabular-nums" style="color: var(--text-faint)">
    {row.line}
  </span>
  <span class="min-w-0 flex-1 truncate">
    {#if row.clipped}…{/if}{row.before}<mark
      class="rounded-[2px]"
      style="background: var(--brand-soft); color: var(--text)">{row.match}</mark
    >{row.after}
  </span>
</button>
