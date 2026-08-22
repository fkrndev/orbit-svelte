<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * The small marks that ride at the end of a row — a pin star, label dots.
   *
   * Pushed right with `ml-auto` so they sit against the actions rather than
   * against the name, which would move as names change length.
   */
  let { children }: { children: Snippet } = $props()
</script>

<span class="ml-auto flex shrink-0 items-center gap-1 pl-1.5">{@render children()}</span>
