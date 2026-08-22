<script lang="ts">
  import CheckSquare from '@lucide/svelte/icons/square-check'
  import Info from '@lucide/svelte/icons/info'
  import List from '@lucide/svelte/icons/list'
  import type { Component } from 'svelte'
  import type { InspectorTab } from '$shared/types'
  import { showInspectorTab } from '@/actions'
  import { getState } from '@/store.svelte'
  import { countDone, todos } from '$shared/todos'
  import ResizeHandle from './ResizeHandle.svelte'
  import InfoTab from './inspector/InfoTab.svelte'
  import TableOfContents from './TableOfContents.svelte'
  import TodosPanel from './TodosPanel.svelte'
  import { cn } from '@/utils'

  /**
   * The pane to the right of the editor: three views of the open document.
   *
   * **Info** is what the file is — its properties and its facts; **Outline** is
   * where you are in it; **Todos** is what is left to do in it. All three are
   * derived from the one open file and all three want the same shape, a tall
   * narrow column beside the text, so they take turns in one pane rather than
   * each claiming a strip of width. Two panes side by side already left the
   * editor a slot; a third would have had nowhere to go.
   *
   * Which tab you left it on is remembered, so the pane opens as whatever you
   * actually use it for.
   */
  const content = $derived(
    getState().tabs.find(tab => tab.path === getState().activePath)?.content ?? '',
  )
  const active = $derived(getState().settings.inspectorTab)

  // Cheap enough to run for the badge alone — it is the same scan the panel
  // does, over a note-sized string, and it keeps the count honest as you type.
  const open = $derived(todos(content))
  const left = $derived(open.length - countDone(open))

  const tabs: Array<{
    tab: InspectorTab
    label: string
    icon: Component<{ size?: number; strokeWidth?: number }>
  }> = [
    { tab: 'info', label: 'Info', icon: Info },
    { tab: 'outline', label: 'Outline', icon: List },
    { tab: 'todos', label: 'Todos', icon: CheckSquare },
  ]
</script>

<aside
  class="relative flex h-full shrink-0 flex-col border-l"
  style="width: var(--inspector-width); background: var(--bg-sunken); border-color: var(--border)"
>
  <!--
    Outside the scroller: an absolute child of a scrolling box scrolls away with
    the content, and an edge that slides out of reach is worse than no edge at
    all.
  -->
  <ResizeHandle pane="inspectorWidth" edge="left" label="Inspector width" />

  <div class="flex shrink-0 gap-0.5 px-2 pt-3 pb-2">
    {#each tabs as item (item.tab)}
      {@const Icon = item.icon}
      {@const on = active === item.tab}
      {@const badge = item.tab === 'todos' && left > 0 ? left : undefined}
      <button
        type="button"
        onclick={() => void showInspectorTab(item.tab)}
        aria-pressed={on}
        title={item.label}
        class={cn(
          'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1 py-1 text-[12px] transition-colors',
          !on && 'hover:bg-[var(--bg-hover)]',
        )}
        style="background: {on ? 'var(--bg-active)' : 'transparent'}; color: {on
          ? 'var(--text)'
          : 'var(--text-muted)'}"
      >
        <span class="shrink-0 opacity-70"><Icon size={14} strokeWidth={2} /></span>
        <span class="truncate">{item.label}</span>
        {#if badge !== undefined}
          <span
            class="shrink-0 rounded-full px-1 text-[10px] tabular-nums"
            style="background: var(--bg-raised); color: var(--text-muted)"
          >
            {badge}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  {#if active === 'info'}
    <InfoTab />
  {:else if active === 'outline'}
    <TableOfContents {content} />
  {:else if active === 'todos'}
    <TodosPanel {content} />
  {/if}
</aside>
