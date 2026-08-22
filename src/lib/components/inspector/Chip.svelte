<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { PropertyColor } from '$shared/propertySchema'
  import { cn } from '@/utils'

  /**
   * A coloured value.
   *
   * The tint is a pair of CSS variables rather than a class per colour, so the
   * ten palettes are declared once in `app.css` and both themes are decided
   * there — see the note above `--tint-default`.
   */
  let {
    name,
    color,
    class: className,
    children,
  }: { name: string; color: PropertyColor; class?: string; children?: Snippet } = $props()
</script>

<span
  class={cn(
    'inline-flex max-w-full items-center gap-1 rounded px-1.5 py-[1px] text-[12px] leading-[18px]',
    className,
  )}
  style="background: var(--tint-{color}); color: var(--tint-{color}-fg)"
>
  <span class="truncate">{name}</span>
  {@render children?.()}
</span>
