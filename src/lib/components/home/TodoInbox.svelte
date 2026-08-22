<script lang="ts">
  import Circle from '@lucide/svelte/icons/circle'
  import ListFilter from '@lucide/svelte/icons/list-filter'
  import type { Root, TodoScan } from '$shared/types'
  import { openPathAtLine } from '@/actions'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import { rootLabels } from '@/components/sidebar/names'

  /**
   * Every unchecked task across the roots, which is the one thing Home can say
   * that no panel beside it can.
   *
   * The inspector's Todos tab reads the file you have open; the task you have
   * forgotten is by definition in a file you have not. So this list is built from
   * a disk scan (`todosIndex.ts`), ordered by how much you use each file, and
   * grouped by nothing — a flat list is the point, because the question is "what
   * is left", not "what is left in this document".
   *
   * Clicking a row opens the file and lands on the line. It deliberately does not
   * tick the box: a task lives in the body of a document, and the body belongs to
   * whichever editor is mounted (see `todoEngine.ts`). Ticking here would write
   * behind the editor's back.
   */
  let {
    scan,
    loading,
    scope,
    roots,
    onScope,
  }: {
    scan: TodoScan | null
    loading: boolean
    scope: string
    roots: Root[]
    onScope: (scope: string) => void
  } = $props()

  /** Enough to be a to-do list, few enough that the blocks under it stay visible. */
  const VISIBLE = 12

  let expanded = $state(false)

  const items = $derived(scan?.items ?? [])
  const shown = $derived(expanded ? items : items.slice(0, VISIBLE))
  const hidden = $derived(items.length - shown.length)
  const labels = $derived(rootLabels(roots))
  const label = (root: Root) => labels.get(root.path) ?? root.name
  const scopeName = $derived(roots.filter(root => root.id === scope).map(label)[0])

  /**
   * Arrow keys walk the list, Enter opens — the same two keys the sidebar and
   * the palette answer to. Focus is moved rather than tracked in state: the rows
   * are real buttons, so the browser already knows which one is current, and a
   * second copy of that in component state could disagree.
   */
  function moveFocus(event: KeyboardEvent) {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return

    const container = event.currentTarget as HTMLElement
    const rows = [...container.querySelectorAll<HTMLButtonElement>('[data-todo-row]')]
    const at = rows.indexOf(document.activeElement as HTMLButtonElement)
    const next = rows[at + step]
    if (!next) return

    // Only once there is somewhere to go: at the ends the key belongs to the
    // page, which is how you scroll out of a list you have reached the bottom of.
    event.preventDefault()
    next.focus()
  }
</script>

<div>
  <div class="flex items-center gap-2">
    <h2
      class="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase"
      style="color: var(--text-faint)"
    >
      Open tasks
    </h2>
    {#if scan && scan.total > 0}
      <span
        class="rounded-full px-1.5 text-[10.5px] tabular-nums"
        style="background: var(--bg-active); color: var(--text-muted)"
      >
        {scan.total}
      </span>
    {/if}

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            type="button"
            class="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] transition-colors hover:bg-[var(--bg-hover)]"
            style="color: var(--text-muted)"
          >
            <ListFilter size={16} strokeWidth={2} />
            {scopeName ?? 'All folders'}
          </button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="min-w-44">
        <DropdownMenu.RadioGroup value={scope} onValueChange={onScope}>
          <DropdownMenu.RadioItem value="all">All folders</DropdownMenu.RadioItem>
          {#each roots as root (root.id)}
            <DropdownMenu.RadioItem value={root.id}>{label(root)}</DropdownMenu.RadioItem>
          {/each}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  {#if loading && !scan}
    <p class="mt-2.5 text-[12.5px] leading-relaxed" style="color: var(--text-faint)">
      Reading your folders…
    </p>
  {/if}

  {#if scan && items.length === 0}
    <!--
      Naming the scope matters: "nothing found" and "nothing found *here*" are
      different answers, and only one of them suggests what to do next.
    -->
    <p class="mt-2.5 text-[12.5px] leading-relaxed" style="color: var(--text-faint)">
      No unchecked tasks in {scopeName ?? 'any folder'}. Write a
      <code class="px-1">- [ ]</code> line in a note and it turns up here.
    </p>
  {/if}

  {#if shown.length > 0}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mt-2.5 flex flex-col" onkeydown={moveFocus}>
      {#each shown as hit (`${hit.path}:${hit.line}`)}
        <button
          type="button"
          data-todo-row
          onclick={() => void openPathAtLine(hit.path, hit.line)}
          title="{hit.path}:{hit.line + 1}"
          class="flex items-start gap-2 rounded px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
        >
          <Circle
            size={16}
            strokeWidth={2}
            class="mt-[1px] shrink-0"
            style="color: var(--text-faint)"
          />
          <span class="min-w-0 flex-1 truncate text-[12.5px]">{hit.text}</span>
          <span
            class="shrink-0 truncate text-[11px]"
            style="color: var(--text-faint); max-width: 38%"
          >
            {hit.name.replace(/\.mdx?$/, '')}{hit.section ? ` · ${hit.section}` : ''}
          </span>
        </button>
      {/each}
    </div>
  {/if}

  {#if hidden > 0}
    <button
      type="button"
      onclick={() => (expanded = true)}
      class="mt-1.5 rounded px-1.5 py-1 text-[11.5px] transition-colors hover:bg-[var(--bg-hover)]"
      style="color: var(--text-muted)"
    >
      Show {hidden} more
    </button>
  {/if}

  <!-- A silently shortened list reads as "this is all of it". -->
  {#if scan?.truncated}
    <p class="mt-2.5 text-[12.5px] leading-relaxed" style="color: var(--text-faint)">
      Showing the first {items.length} of {scan.total} — there are more than this page can rank.
    </p>
  {/if}
</div>
