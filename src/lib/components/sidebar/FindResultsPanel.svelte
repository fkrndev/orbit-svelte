<script lang="ts">
  import { getState } from '@/store.svelte'
  import { buildFindResultRows } from '@/editor/findResultRows'
  import FindResultRow from './FindResultRow.svelte'

  /**
   * Every hit in the open file, as a list.
   *
   * The bar over the editor answers "how many, and where is this one"; this
   * answers "what did I actually match", which is the question you have when the
   * query is broad. Selecting a row is the same action as the next/previous
   * arrows, so the two views can never disagree about which hit is current.
   *
   * It takes the sidebar over while a search is running and hands it straight
   * back when the search ends — a results list with nothing to list is just a
   * panel you now have to close.
   */
  const find = $derived(getState().find)

  // Building a fresh array here is free in Svelte. The React build had to hoist
  // this into a `useMemo` because a new array from a store selector never
  // settled — a hazard runes simply do not have.
  const rows = $derived(buildFindResultRows(find.text, find.matches))
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="flex items-center justify-between px-2.5 pt-2.5 pb-1.5">
    <span
      class="text-[10.5px] font-semibold tracking-[0.08em] uppercase"
      style="color: var(--text-faint)"
    >
      Results
    </span>
    <span class="text-[10.5px] tabular-nums" style="color: var(--text-faint)">
      {find.error ? '' : `${find.matches.length}`}
    </span>
  </div>

  {#if rows.length === 0}
    <p class="px-2.5 py-1 text-[12px]" style="color: var(--text-faint)">
      {find.error ?? (find.query.length === 0 ? 'Type to search this file.' : 'No results.')}
    </p>
  {:else}
    <div class="min-h-0 flex-1 overflow-y-auto pb-2" data-testid="find-results">
      {#each rows as row (row.index)}
        <FindResultRow {row} active={row.index === find.activeIndex} />
      {/each}
    </div>
  {/if}
</div>
