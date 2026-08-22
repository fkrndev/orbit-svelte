<script lang="ts">
  import type { PropertyColor } from '$shared/propertySchema'

  /** The colour a swatch shows in a picker — the chip's ground, with an outline. */
  let { color }: { color: PropertyColor } = $props()
</script>

<!--
  `inline-block`, not the default `inline`: an inline span ignores width and
  height, and the swatch collapses to a hairline.
-->
<span
  class="inline-block size-4 shrink-0 rounded border"
  style="background: var(--tint-{color}); border-color: {color === 'default'
    ? 'var(--border-strong)'
    : 'transparent'}"
></span>
