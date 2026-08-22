<script lang="ts">
  import { Tooltip as TooltipPrimitive } from 'bits-ui'
  import type { Snippet } from 'svelte'

  /**
   * The dark pill, with the shortcut spelled out on it.
   *
   * Naming the key next to the action is the whole reason this exists. An icon
   * bar teaches you what the buttons do; the chip is what teaches you to stop
   * using the bar.
   *
   * It stays dark in both themes, as the system's own tooltips do — a tooltip is
   * a temporary overlay, not part of the page, and inverting it with the theme
   * makes it read as a panel instead. That is why this is **ours** rather than
   * the registry's `tooltip`, whose content follows `--foreground`: never run
   * `shadcn-svelte add tooltip` over this file, because every toolbar in the app
   * calls the `label`/`shortcut` API below.
   */
  let {
    label,
    /** Rendered as a key chip. Pass the glyphs, e.g. `⌘D`. */
    shortcut,
    side = 'bottom',
    children,
  }: {
    label: string
    shortcut?: string
    side?: 'top' | 'bottom' | 'left' | 'right'
    children: Snippet
  } = $props()
</script>

<TooltipPrimitive.Root>
  <!--
    A real wrapper element rather than `display: contents`.

    The React build used `asChild`, which merges the trigger's props onto the
    single child — and that is exactly what clobbered `data-state` on a toggle
    it wrapped. A wrapper avoids that class of bug outright, but it has to be
    something the pointer can actually hit: `contents` generates no box, so the
    hover that opens the tooltip never lands on it and the pill never appears.
  -->
  <TooltipPrimitive.Trigger>
    {#snippet child({ props })}
      <span {...props} class="inline-flex shrink-0">{@render children()}</span>
    {/snippet}
  </TooltipPrimitive.Trigger>
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      {side}
      sideOffset={6}
      class="z-50 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] shadow-[var(--shadow)]
             data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
             data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95"
      style="background: var(--tooltip); color: var(--tooltip-on)"
    >
      {label}
      {#if shortcut}
        <!--
          Lightened from the pill itself rather than given its own token: the
          chip has to work on whatever the pill is.
        -->
        <kbd class="rounded px-1.5 py-0.5 font-sans text-[11px]" style="background: oklch(1 0 0 / 14%)">
          {shortcut}
        </kbd>
      {/if}
      <TooltipPrimitive.Arrow width={10} height={5}>
        {#snippet child({ props })}
          <div {...props} class="size-2 rotate-45 rounded-[2px]" style="background: var(--tooltip)"></div>
        {/snippet}
      </TooltipPrimitive.Arrow>
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
</TooltipPrimitive.Root>
