<script lang="ts">
  /** The matched characters, lit so the ranking is legible rather than magic. */
  let { text, matched }: { text: string; matched?: number[] } = $props()

  const parts = $derived.by(() => {
    if (!matched || matched.length === 0) return null
    const set = new Set(matched)
    return [...text].map((char, at) => ({ char, hit: set.has(at) }))
  })
</script>

{#if !parts}{text}{:else}{#each parts as part, at (at)}{#if part.hit}<b
      style="color: var(--brand); font-weight: 600">{part.char}</b>{:else}{part.char}{/if}{/each}{/if}
