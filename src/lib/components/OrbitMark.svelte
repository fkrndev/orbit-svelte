<script lang="ts">
  /**
   * The Orbit mark, drawn in `currentColor`.
   *
   * The app icon is a glossy squircle because a Dock needs one; inside the app
   * nothing else is glossy, so the mark here is the same geometry stripped to a
   * line: one orbit, the thing it turns around, and one satellite riding it.
   *
   * Line weight is set in user units against a 24-unit box rather than by
   * `stroke-width` at the call site, so the mark thickens with its size the way
   * the Lucide icons beside it do.
   *
   * The satellite sits just *clear* of the orbit rather than on it. On it —
   * where the app icon puts it, because there it has an ink gap around it — the
   * two shapes fuse into one blob by 16px. Off it, the mark still reads at 16px,
   * and it is also what stops a tilted ellipse around a filled dot from reading
   * as an eye, which is exactly what it does with the satellite removed.
   */
  let { size = 16, class: className }: { size?: number; class?: string } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  class={className}
  role="img"
  aria-label="Orbit"
>
  <ellipse cx="12" cy="12" rx="11" ry="4.6" stroke-width="1.6" transform="rotate(-24 12 12)" />
  <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
  <circle cx="20.6" cy="3.9" r="1.9" fill="currentColor" stroke="none" />
</svg>
