<script lang="ts">
  import { untrack } from 'svelte'
  import { Input } from '@/components/ui/input'

  /** An input that reports its value on Enter or blur and reverts if refused. */
  let {
    value,
    autofocus,
    placeholder,
    onCommit,
  }: {
    value: string
    autofocus?: boolean
    placeholder?: string
    /** Returns false when the value was refused, so the field can revert. */
    onCommit: (next: string) => boolean
  } = $props()

  let draft = $state(untrack(() => value))
  let field = $state<HTMLInputElement | null>(null)

  // Follows the source of truth whenever it moves underneath us — a rename
  // applied elsewhere must not leave this field showing the old name.
  $effect(() => {
    draft = value
  })

  function commit() {
    const next = draft.trim()
    if (next === value) return
    if (!onCommit(next)) draft = value
  }
</script>

<!-- svelte-ignore a11y_autofocus -->
<Input
  bind:ref={field}
  {autofocus}
  {placeholder}
  bind:value={draft}
  onkeydown={event => {
    // The rich editor is a contenteditable that grabs keys aggressively;
    // stopping propagation keeps typing and arrow keys inside this field.
    event.stopPropagation()
    if (event.key === 'Enter') {
      commit()
      field?.blur()
    }
    if (event.key === 'Escape') draft = value
  }}
  onblur={commit}
  class="h-7 text-[12px]"
/>
