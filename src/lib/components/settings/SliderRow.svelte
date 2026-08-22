<script lang="ts">
  import type { Snippet } from 'svelte'
  import SettingRow from './SettingRow.svelte'

  /**
   * A row whose control is a slider, with the current value read out beside it.
   *
   * The readout is the whole reason this is not just `SettingRow wide`: a slider
   * with no number is a control you can only use by trial, and every one of these
   * settings has a value the user might want to match to something else.
   */
  let {
    title,
    description,
    readout,
    children,
  }: { title: string; description?: string; readout: string; children: Snippet } = $props()
</script>

{#snippet sliderAndReadout()}
  <div class="flex items-center gap-3">
    {@render children()}
    <span
      class="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums"
      style="color: var(--text-muted)"
    >
      {readout}
    </span>
  </div>
{/snippet}

<SettingRow {title} {description} wide control={sliderAndReadout} />
