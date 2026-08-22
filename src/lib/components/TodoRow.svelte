<script lang="ts">
  import Check from '@lucide/svelte/icons/check'
  import Circle from '@lucide/svelte/icons/circle'
  import type { TodoItem } from '$shared/todos'
  import { revealTodo, toggleTodo } from '@/todoEngine'
  import { cn } from '@/utils'

  let { item, number }: { item: TodoItem; number: number } = $props()
</script>

<div
  class="group/row flex items-start gap-1.5 rounded py-[3px] pr-1 transition-colors hover:bg-[var(--bg-hover)]"
  style="padding-left: {8 + item.depth * 14}px"
>
  <span
    class="w-4 shrink-0 pt-[2px] text-right text-[10px] tabular-nums"
    style="color: var(--text-faint)"
  >
    {number}
  </span>

  <button
    type="button"
    role="checkbox"
    aria-checked={item.checked}
    aria-label={item.text || 'Untitled task'}
    onclick={() => toggleTodo(item)}
    class="mt-[1px] shrink-0 rounded-full transition-transform active:scale-90"
    style="color: {item.checked ? 'var(--ok)' : 'var(--text-faint)'}"
  >
    {#if item.checked}
      <span
        class="flex size-[15px] items-center justify-center rounded-full"
        style="background: var(--ok); color: var(--brand-on)"
      >
        <Check size={11} strokeWidth={3} />
      </span>
    {:else}
      <Circle size={15} strokeWidth={1.75} />
    {/if}
  </button>

  <!--
    Clicking the label goes to the task rather than toggling it. Two different
    outcomes from one row need two different targets, and the
    destructive-feeling one — changing the document — gets the small deliberate
    target, not the whole width.
  -->
  <button
    type="button"
    onclick={() => revealTodo(item)}
    title={item.text || 'Untitled task'}
    class={cn('min-w-0 flex-1 text-left text-[12.5px] leading-[18px]', item.checked && 'line-through')}
    style="color: {item.checked ? 'var(--text-faint)' : 'var(--text)'}"
  >
    {#if item.text}{item.text}{:else}<span class="italic opacity-60">Untitled task</span>{/if}
  </button>
</div>
