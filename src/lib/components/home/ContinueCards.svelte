<script lang="ts">
  import type { DashboardItem, TodoTally } from '$shared/types'
  import ContinueCard from './ContinueCard.svelte'
  import type { DecorRequest } from '@/components/sidebar/rowMenus'

  /**
   * The files you are most likely to carry on with, as cards rather than rows.
   *
   * Rows are what the sidebar already does, and it does them better — sortable,
   * eighty of them, in a column that is always on screen. A card earns the width
   * Home has by showing what a row cannot: the first line of the text, and how
   * much of the checklist inside it is left.
   */
  let {
    items,
    tallies,
    onDecor,
  }: {
    items: DashboardItem[]
    tallies: Record<string, TodoTally>
    onDecor: (request: DecorRequest) => void
  } = $props()
</script>

<div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
  {#each items as item (item.meta.id)}
    <ContinueCard {item} tally={tallies[item.meta.path]} {onDecor} />
  {/each}
</div>
