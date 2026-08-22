<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * One setting.
   *
   * `control` is a slot rather than a set of props for every control type — a row
   * that knew about switches and selects and sliders would have to grow a branch
   * for each new one, and the row's job is spacing, not widgets.
   *
   * `wide` is for controls that cannot share a line with the label: a slider needs
   * the full width to be draggable at any useful precision.
   */
  let {
    title,
    description,
    control,
    wide,
  }: { title: string; description?: string; control: Snippet; wide?: boolean } = $props()
</script>

<div
  class="flex gap-4 px-4 py-3 [&+&]:border-t {wide ? 'flex-col' : 'items-center justify-between'}"
  style="border-color: var(--border)"
>
  <div class="min-w-0">
    <div class="text-[13px] font-medium">{title}</div>
    {#if description}
      <div class="mt-0.5 text-[12px] leading-snug" style="color: var(--text-muted)">
        {description}
      </div>
    {/if}
  </div>
  <div class={wide ? '' : 'shrink-0'}>{@render control()}</div>
</div>
