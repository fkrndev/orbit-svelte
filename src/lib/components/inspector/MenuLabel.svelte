<script lang="ts">
  import type { Snippet } from 'svelte'

  /** The heading strip above a group of menu items. */
  let { children }: { children: Snippet } = $props()
</script>

<div
  class="px-2 pt-1.5 pb-1 text-[10px] font-medium tracking-wide uppercase"
  style="color: var(--text-faint)"
>
  {@render children()}
</div>
