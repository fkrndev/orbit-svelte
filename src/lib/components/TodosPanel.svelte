<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import Eye from '@lucide/svelte/icons/eye'
  import EyeOff from '@lucide/svelte/icons/eye-off'
  import Plus from '@lucide/svelte/icons/plus'
  import { anchorForGroup, countDone, groupTodos, todos, type TodoGroup } from '$shared/todos'
  import { addTodo } from '@/todoEngine'
  import { setSetting } from '@/actions'
  import { getState } from '@/store.svelte'
  import { gotoHeading } from './TableOfContents.svelte'
  import TodoRow from './TodoRow.svelte'
  import AddTask from './AddTask.svelte'

  /**
   * Every task in the open file, gathered under its heading.
   *
   * The list is *derived*, never stored: it is read from the markdown on each
   * update, the way the outline is. So it is right before either editor has
   * mounted, it stays right while you type, and there is no second copy of your
   * tasks that could disagree with the document.
   *
   * Ticking a box here is the one thing that is not free. A task lives in the
   * body of the document, which the rich editor owns — see `todoEngine.ts` for
   * why that means going through the editor rather than rewriting the markdown.
   */
  let { content }: { content: string } = $props()

  const hideDone = $derived(getState().settings.todosHideDone)

  let collapsed = $state(new SvelteSet<string>())
  let adding = $state<string | null>(null)

  const items = $derived(todos(content))
  const groups = $derived(groupTodos(items))
  const done = $derived(countDone(items))

  /** Identifies a group across updates. A heading's line moves only when it does. */
  function groupKey(group: TodoGroup): string {
    return group.section ? `h${group.section.index}` : 'none'
  }

  function toggleGroup(key: string) {
    if (collapsed.has(key)) collapsed.delete(key)
    else collapsed.add(key)
  }
</script>

{#if items.length === 0}
  <p class="px-4 py-2 text-[12px] leading-relaxed" style="color: var(--text-faint)">
    No tasks yet. Type <code>- [ ]</code> on a line and it will appear here.
  </p>
{:else}
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex items-center gap-2 px-4 pb-2 text-[11px]" style="color: var(--text-muted)">
      <span class="shrink-0 tabular-nums">{done}/{items.length} done</span>
      <!--
        A bar as well as the count: the number says how many, the bar says how
        far, and "17/23" takes a moment to read as "nearly there".
      -->
      <span
        class="h-1 min-w-0 flex-1 overflow-hidden rounded-full"
        style="background: var(--bg-active)"
      >
        <span
          class="block h-full rounded-full transition-[width]"
          style="width: {items.length === 0 ? 0 : (done / items.length) * 100}%; background: var(--ok)"
        ></span>
      </span>
      <button
        type="button"
        onclick={() => void setSetting('todosHideDone', !hideDone)}
        title={hideDone ? 'Show finished tasks' : 'Hide finished tasks'}
        class="ml-auto shrink-0 rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
        style="color: {hideDone ? 'var(--text)' : 'var(--text-faint)'}"
      >
        {#if hideDone}<EyeOff size={14} strokeWidth={2} />
        {:else}<Eye size={14} strokeWidth={2} />{/if}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      {#each groups as group (groupKey(group))}
        {@const key = groupKey(group)}
        {@const open = !collapsed.has(key)}
        {@const shown = hideDone ? group.items.filter(item => !item.checked) : group.items}
        <section class="pb-2">
          {#if group.section}
            <div class="group/head flex items-center gap-1 pt-1">
              <button
                type="button"
                onclick={() => toggleGroup(key)}
                aria-expanded={open}
                class="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span class="shrink-0" style="color: var(--text-faint)">
                  {#if open}<ChevronDown size={14} strokeWidth={2} />
                  {:else}<ChevronRight size={14} strokeWidth={2} />{/if}
                </span>
                <span class="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                  {group.section.text}
                </span>
                <span
                  class="shrink-0 text-[11px] tabular-nums"
                  style="color: var(--text-faint)"
                >
                  {group.done}/{group.items.length}
                </span>
              </button>
              <!--
                Separate target: the chevron folds the group, the heading takes
                you to it in the document. One control cannot mean both.
              -->
              <button
                type="button"
                onclick={() => gotoHeading(group.section!)}
                title="Go to “{group.section.text}”"
                class="shrink-0 rounded p-1 opacity-0 transition group-hover/head:opacity-60 hover:bg-[var(--bg-hover)] focus-visible:opacity-100"
                style="color: var(--text-faint)"
              >
                <ChevronRight size={13} strokeWidth={2} />
              </button>
            </div>
          {/if}

          {#if open}
            {#each shown as item, at (`${item.index}:${item.line}`)}
              <TodoRow {item} number={at + 1} />
            {/each}

            {#if hideDone && shown.length === 0}
              <p class="px-2 py-1 text-[11px]" style="color: var(--text-faint)">
                All {group.items.length} done
              </p>
            {/if}

            {#if adding === key}
              <AddTask
                onCancel={() => (adding = null)}
                onAdd={text => addTodo(anchorForGroup(group), text)}
              />
            {:else}
              <button
                type="button"
                onclick={() => (adding = key)}
                class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[12px] transition-colors hover:bg-[var(--bg-hover)]"
                style="color: var(--text-faint)"
              >
                <Plus size={14} strokeWidth={2} />
                Add task…
              </button>
            {/if}
          {/if}
        </section>
      {/each}
    </div>
  </div>
{/if}
