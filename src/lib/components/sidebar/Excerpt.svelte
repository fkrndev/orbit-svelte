<script lang="ts">
  /**
   * The preview text under a name, clamped to the chosen number of lines.
   *
   * An empty file still draws the line, greyed and named as such: the rows would
   * otherwise change height from one to the next for a reason the user cannot
   * see, which reads as a rendering fault rather than as an empty note.
   *
   * `undefined` is a different state — the list is showing rows fetched before
   * the style changed, and their text is still in flight. That one holds the
   * space blank rather than claiming the files are empty.
   */
  let { text, lines }: { text: string | undefined; lines: number } = $props()

  const empty = $derived(text === '')
</script>

{#if text === undefined}
  <span class="w-full text-[11px] leading-[1.45]">&nbsp;</span>
{:else}
  <span
    class="w-full text-[11px] leading-[1.45]"
    style="color: {empty ? 'var(--text-faint)' : 'var(--text-muted)'};
           {empty ? 'font-style: italic;' : ''}
           display: -webkit-box;
           -webkit-box-orient: vertical;
           -webkit-line-clamp: {lines};
           overflow: hidden"
  >
    {empty ? 'Empty' : text}
  </span>
{/if}
