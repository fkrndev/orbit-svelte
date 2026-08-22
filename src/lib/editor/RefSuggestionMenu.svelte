<script lang="ts">
  import AtSign from '@lucide/svelte/icons/at-sign'
  import FileIcon from '@lucide/svelte/icons/file'
  import Hash from '@lucide/svelte/icons/hash'
  import Plus from '@lucide/svelte/icons/plus'
  import type { InlineRefKind } from '$shared/inlineRefs'
  import type { RefItem } from './refSuggestionItems'

  /**
   * The list under a `#` or `@`.
   *
   * Keyboard handling is exported rather than bound to the window, the way the
   * slash menu does it: the Suggestion plugin already owns the keys while it is
   * open, and a second global listener would fight it for Enter.
   */
  let {
    items = [],
    command,
    kind,
  }: {
    items: RefItem[]
    command: (item: RefItem) => void
    kind: InlineRefKind
  } = $props()

  let active = $state(0)

  // A new query is a new list, so the highlight starts at the top of it.
  $effect(() => {
    void items
    active = 0
  })

  $effect(() => {
    document.getElementById(`ref-item-${active}`)?.scrollIntoView({ block: 'nearest' })
  })

  const icon = (item: RefItem) =>
    item.kind === 'note' ? FileIcon : item.kind === 'new' ? Plus : kind === 'tag' ? Hash : AtSign

  export function handleKeyDown(event: KeyboardEvent): boolean {
    if (items.length === 0) return false

    if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault()
      active = (active + 1) % items.length
      return true
    }
    if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
      event.preventDefault()
      active = (active - 1 + items.length) % items.length
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const item = items[active]
      if (item) command(item)
      return true
    }
    return false
  }
</script>

<div
  class="max-h-64 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
  class:hidden={items.length === 0}
>
  {#each items as item, index (`${item.kind}:${item.label}`)}
    {@const Icon = icon(item)}
    <button
      id={`ref-item-${index}`}
      type="button"
      onpointerenter={() => (active = index)}
      onclick={() => command(item)}
      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors
        {index === active ? 'bg-accent text-accent-foreground' : 'text-popover-foreground'}"
    >
      <Icon size={15} strokeWidth={2} class="shrink-0 text-muted-foreground" />
      <span class="min-w-0 flex-1 truncate">{item.label}</span>
      <!--
        Both halves truncate, and the name is the one that keeps its width. A
        note's detail is its relative path, which in a vault of nested folders is
        routinely longer than the row — left to itself it pushed the name out of
        the popup entirely, so every row read as a path and none as a note.
      -->
      <span class="min-w-0 max-w-[50%] shrink truncate pl-2 text-xs text-muted-foreground">
        {item.detail}
      </span>
    </button>
  {/each}
</div>
