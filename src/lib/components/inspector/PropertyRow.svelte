<script lang="ts">
  import GripVertical from '@lucide/svelte/icons/grip-vertical'
  import type { Snippet } from 'svelte'
  import type { PropertyType } from '$shared/propertyTypes'
  import * as Popover from '@/components/ui/popover'
  import { TYPE_ICON } from './propertyChrome'
  import { cn } from '@/utils'

  /**
   * One row of the properties panel: what the property is called, and what it
   * holds.
   *
   * Two things changed the feel of this panel more than anything else.
   *
   * The **name is now a button**. It used to be a label with a delete cross that
   * appeared on hover, and nothing else about a property could be reached at all.
   * Clicking the name opens the editor, which is where rename, type, options,
   * order, and delete now live — one target instead of a hidden one plus four
   * missing ones.
   *
   * The **value is still the value**. Reading and editing are the same element
   * wherever possible: click the text and it becomes an input. The exceptions are
   * the types where a text box is a worse instrument than the value deserves — a
   * checkbox is a switch, a date is a calendar, choices are a picker.
   *
   * Two columns that stay aligned across real rows and placeholder rows alike,
   * plus a drag handle that lives in the panel's left padding rather than in a
   * column of its own — at the panel's 220px minimum there is no third column to
   * spare, and a handle that stole width from the value would cost something on
   * every row to serve the rare one being moved.
   */
  let {
    type,
    label,
    muted,
    dragging,
    draggedOver,
    /** The editor popover's contents. Absent for rows that cannot be configured. */
    editor,
    onArmDrag,
    children,
  }: {
    type: PropertyType
    label: string
    muted?: boolean
    dragging?: boolean
    draggedOver?: boolean
    editor?: Snippet<[() => void]>
    onArmDrag?: (armed: boolean) => void
    children: Snippet
  } = $props()

  let open = $state(false)

  const Icon = $derived(TYPE_ICON[type])
</script>

{#snippet name()}
  <span class="flex min-w-0 items-center gap-1.5">
    <span class="shrink-0 opacity-70"><Icon size={14} strokeWidth={2} /></span>
    <span class="truncate">{label}</span>
  </span>
{/snippet}

<div
  class={cn(
    'group relative grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] items-start gap-2 rounded py-[3px]',
    dragging && 'opacity-40',
    draggedOver && 'shadow-[inset_0_1px_0_0_var(--brand)]',
  )}
>
  {#if onArmDrag}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      aria-hidden="true"
      onpointerdown={() => onArmDrag(true)}
      onpointerup={() => onArmDrag(false)}
      class="absolute -left-3.5 top-[5px] cursor-grab opacity-0 transition-opacity group-hover:opacity-60"
      style="color: var(--text-faint)"
    >
      <GripVertical size={14} strokeWidth={2} />
    </span>
  {/if}

  <div
    class="min-w-0 pt-[3px] text-[12px]"
    style="color: {muted ? 'var(--text-faint)' : 'var(--text-muted)'}"
  >
    {#if editor}
      <Popover.Root bind:open>
        <Popover.Trigger
          title="{label} — click to edit this property"
          class="w-full rounded px-0.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
        >
          {@render name()}
        </Popover.Trigger>
        <Popover.Content align="start" side="left" class="w-64 p-1">
          {@render editor(() => (open = false))}
        </Popover.Content>
      </Popover.Root>
    {:else}
      <span class="block px-0.5" title={label}>{@render name()}</span>
    {/if}
  </div>

  <div class="min-w-0">{@render children()}</div>
</div>
