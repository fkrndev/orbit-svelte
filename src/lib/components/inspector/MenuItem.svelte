<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import type { Snippet } from 'svelte'
  import { cn } from '@/utils'

  /**
   * One line in a popover menu.
   *
   * A `<button>` rather than a menu-primitive item on purpose: these menus hold
   * live inputs (renaming a property, typing a new option) and a roving-focus
   * menu fights a text field for the arrow keys — see the note on the editor
   * popover.
   */
  let {
    icon,
    label,
    detail,
    chevron,
    danger,
    active,
    onclick,
  }: {
    icon?: Snippet
    /** A snippet rather than a string: a menu row often *is* a coloured chip. */
    label: Snippet
    detail?: Snippet
    chevron?: boolean
    danger?: boolean
    active?: boolean
    onclick: () => void
  } = $props()
</script>

<button
  type="button"
  {onclick}
  class={cn(
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors',
    'hover:bg-[var(--bg-hover)]',
    active && 'bg-[var(--bg-hover)]',
  )}
  style="color: {danger ? 'var(--danger)' : 'var(--text)'}"
>
  {#if icon}<span class="shrink-0 opacity-70">{@render icon()}</span>{/if}
  <span class="min-w-0 flex-1 truncate">{@render label()}</span>
  {#if detail}
    <span class="shrink-0 truncate text-[11px]" style="color: var(--text-muted)">
      {@render detail()}
    </span>
  {/if}
  {#if chevron}<ChevronRight size={14} strokeWidth={2} class="shrink-0 opacity-50" />{/if}
</button>
