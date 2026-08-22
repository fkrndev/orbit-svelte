<script lang="ts" module>
  /**
   * Electrobun's preload resolves drag regions by class name, so these are load
   * bearing rather than styling hooks — see the note in `app.css`.
   */
  export const DRAG = 'electrobun-webkit-app-region-drag'
  export const NO_DRAG = 'electrobun-webkit-app-region-no-drag'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * Every control in the title bar. `on` is for the toggles and the two
   * destinations — omitted where the button has no state of its own, so nothing
   * announces a pressed state it does not have.
   */
  let {
    label,
    icon,
    on,
    disabled,
    onclick,
  }: {
    label: string
    icon: Snippet
    on?: boolean
    disabled?: boolean
    onclick?: () => void
  } = $props()
</script>

<button
  type="button"
  {onclick}
  {disabled}
  title={label}
  aria-label={label}
  aria-pressed={on}
  class="{NO_DRAG} shrink-0 rounded p-1.5 transition-colors enabled:hover:bg-[var(--bg-hover)] disabled:opacity-35"
  style="color: {on ? 'var(--text)' : 'var(--text-faint)'}"
>
  {@render icon()}
</button>
