<script lang="ts">
  import { untrack } from 'svelte'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import type { PropertyEntry } from '$shared/frontmatter'
  import type { PropertyType } from '$shared/propertyTypes'
  import { Input } from '@/components/ui/input'

  const EM_DASH = '—'

  let {
    entry,
    type,
    onChange,
  }: { entry: PropertyEntry; type: PropertyType; onChange: (value: string) => void } = $props()

  let editing = $state(false)
  // A starting value; the effect below is what keeps it following the file.
  let draft = $state(untrack(() => entry.value))
  let field = $state<HTMLInputElement | null>(null)

  // The file can change under the panel — a save, a reload, an edit in source
  // mode — and the draft has to follow whenever it is not being typed into.
  $effect(() => {
    draft = entry.value
  })

  $effect(() => {
    if (editing) field?.focus()
  })

  function commit() {
    editing = false
    if (draft !== entry.value) onChange(draft)
  }
</script>

{#if editing}
  <Input
    bind:ref={field}
    bind:value={draft}
    onkeydown={event => {
      // The rich editor is a contenteditable that steals focus aggressively;
      // stopping propagation here keeps arrow keys inside the field.
      event.stopPropagation()
      if (event.key === 'Enter') commit()
      if (event.key === 'Escape') {
        draft = entry.value
        editing = false
      }
    }}
    inputmode={type === 'number' ? 'decimal' : undefined}
    onblur={commit}
    class="h-6 w-full px-1.5 py-0 text-[12px]"
  />
{:else}
  <span class="flex min-w-0 items-start">
    <button
      type="button"
      onclick={() => (editing = true)}
      class="min-w-0 flex-1 truncate rounded px-0.5 pt-[3px] text-left text-[12px] transition-colors hover:bg-[var(--bg-hover)]"
      style="color: {entry.value ? 'var(--text)' : 'var(--text-faint)'}"
      title={entry.value || 'Click to set'}
    >
      {entry.value || EM_DASH}
    </button>
    {#if type === 'url' && entry.value !== ''}
      <!--
        Editing a link and following it are different intentions, so they get
        different targets — clicking the text to edit it must never navigate.
      -->
      <a
        href={entry.value}
        target="_blank"
        rel="noreferrer noopener"
        title="Open {entry.value}"
        class="mt-[3px] shrink-0 rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-[var(--bg-hover)]"
        style="color: var(--text-faint)"
      >
        <ExternalLink size={14} strokeWidth={2} />
      </a>
    {/if}
  </span>
{/if}
