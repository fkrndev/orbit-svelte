<script lang="ts" module>
  import type { Heading } from '$shared/outline'

  /** Fired at whichever editor is mounted; each one knows how to reach a heading. */
  export function gotoHeading(heading: Heading) {
    window.dispatchEvent(new CustomEvent('app:goto-heading', { detail: heading }))
  }
</script>

<script lang="ts">
  import { outline, outlineDepth } from '$shared/outline'

  /**
   * The document's headings, as a list.
   *
   * Built from the markdown rather than the rendered document, so it is identical
   * in the rich editor and the raw one — and it is there the moment a file opens,
   * before either editor has finished mounting.
   *
   * The pane around it is `InspectorPane`, which it shares with the info view and
   * the todo list.
   */
  let { content }: { content: string } = $props()

  const headings = $derived(outline(content))
</script>

{#if headings.length === 0}
  <p class="px-4 py-2 text-[12px] leading-relaxed" style="color: var(--text-faint)">
    No headings yet. Start a line with <code>#</code> and it will appear here.
  </p>
{:else}
  <nav class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
    {#each headings as heading (`${heading.line}:${heading.index}`)}
      {@const depth = outlineDepth(headings, heading)}
      <button
        type="button"
        onclick={() => gotoHeading(heading)}
        title={heading.text}
        class="flex w-full items-start gap-1.5 rounded py-1 pr-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
        style="padding-left: {8 + depth * 12}px"
      >
        <!--
          The level is shown rather than implied by indent alone. Indentation is
          relative to the shallowest heading present, so it says where a heading
          sits in *this* document; the badge says what it actually is.
        -->
        <span
          class="shrink-0 pt-[1px] font-mono text-[9.5px] tabular-nums"
          style="color: var(--text-faint)"
        >
          H{heading.level}
        </span>
        <span
          class="min-w-0 flex-1 truncate text-[12.5px]"
          style="color: {depth === 0 ? 'var(--text)' : 'var(--text-muted)'}"
        >
          {heading.text}
        </span>
      </button>
    {/each}
  </nav>
{/if}
