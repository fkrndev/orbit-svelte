<script lang="ts">
  import Search from '@lucide/svelte/icons/search'
  import X from '@lucide/svelte/icons/x'
  import { Input } from '@/components/ui/input'

  /**
   * The filter box at the top of a sidebar panel.
   *
   * Shared by Files and Recents rather than written twice. The two filter
   * different things — one asks the backend to search every root, the other
   * narrows the rows already on screen — but the *control* is the same promise in
   * both: type to narrow, Escape to clear, a cross while there is something to
   * clear. Two hand-rolled copies would drift in height, padding, and whether
   * Escape works, which is exactly the kind of difference nobody decides on and
   * everybody notices.
   */
  let {
    value,
    placeholder,
    onChange,
    /**
     * A counter bumped by ⇧⌘F. Selects the text rather than only focusing, so the
     * shortcut can be pressed twice without appending to an old query.
     */
    focusRequest,
  }: {
    value: string
    placeholder: string
    onChange: (value: string) => void
    focusRequest: number
  } = $props()

  let input = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (focusRequest > 0) input?.select()
  })
</script>

<div class="relative min-w-0 flex-1">
  <Search
    size={16}
    strokeWidth={2}
    class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
    style="color: var(--text-faint)"
  />
  <Input
    bind:ref={input}
    {value}
    {placeholder}
    oninput={event => onChange((event.currentTarget as HTMLInputElement).value)}
    onkeydown={event => {
      if (event.key === 'Escape') onChange('')
    }}
    class="h-7 pr-6 pl-6 text-[12px]"
  />
  {#if value}
    <button
      type="button"
      title="Clear"
      onclick={() => onChange('')}
      class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 hover:bg-[var(--bg-hover)]"
      style="color: var(--text-faint)"
    >
      <X size={16} strokeWidth={2} />
    </button>
  {/if}
</div>
