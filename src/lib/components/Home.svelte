<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import FilePlus2 from '@lucide/svelte/icons/file-plus-2'
  import FolderPlus from '@lucide/svelte/icons/folder-plus'
  import type { Dashboard, TodoScan } from '$shared/types'
  import { continueList, lastWriteAt } from '$shared/home'
  import { loadHome, loadRefs, loadTodos, watchHome } from '@/homeData'
  import { createFileBesideActive, openFolderDialog, setSetting, updateMeta } from '@/actions'
  import { setFolderDecor } from '@/sidebar'
  import { getState } from '@/store.svelte'
  import { relativeTime } from '@/format'
  import ContinueCards from './home/ContinueCards.svelte'
  import TodoInbox from './home/TodoInbox.svelte'
  import MarkedPanel from './home/MarkedPanel.svelte'
  import PlacesPanel from './home/PlacesPanel.svelte'
  import IconPicker from './sidebar/IconPicker.svelte'
  import type { DecorRequest } from './sidebar/rowMenus'

  /**
   * The landing surface: a desk rather than a leaderboard.
   *
   * It used to be three ranked lists of files in the same row shape, standing
   * next to a sidebar that lists the same files with more control. So the lists
   * went, and Home now answers the three questions the panels beside it cannot:
   *
   * - **Continue** — what would you carry on with? Cards, because the width is
   *   only worth having if it shows what a row cannot: the opening line, and how
   *   much of the checklist is left.
   * - **Open tasks** — what is unfinished *anywhere*? The inspector's Todos tab
   *   reads the open file; the task you forgot is in the file you did not open.
   * - **Marked** and **Places** — what did you say mattered, and where does it
   *   live? Both are built from counts the app already computed and threw away.
   *
   * Everything reloads on file and metadata events. This is the one screen people
   * leave open, and a screen that goes quietly stale is a bug that looks like a
   * design.
   */
  let { onSearch }: { onSearch: (query: string) => void } = $props()

  let data = $state<Dashboard | null>(null)
  let todos = $state<TodoScan | null>(null)
  let tags = $state<Array<{ tag: string; count: number }>>([])
  let mentions = $state<Array<{ mention: string; count: number }>>([])
  let scanning = $state(true)
  let decor = $state<DecorRequest | null>(null)

  const roots = $derived(getState().roots)
  const scope = $derived(getState().settings.homeTodoScope)

  function reload() {
    const at = untrack(() => scope)
    void loadHome().then(next => (data = next))
    void loadRefs().then(next => {
      tags = next.tags
      mentions = next.mentions
    })
    // The scan walks the disk, so it is kept apart from the dashboard fetch and
    // allowed to arrive late — Home draws the rest of itself without waiting.
    void loadTodos(at).then(next => {
      todos = next
      scanning = false
    })
  }

  // Reloads when the scope changes, and whenever a file or its metadata does.
  // `reload` reads the store, so the subscription itself goes through `onMount`
  // — an effect that both reads and writes the store re-runs itself forever.
  $effect(() => {
    void scope
    reload()
  })

  onMount(() => watchHome(reload))

  const carryOn = $derived(data ? continueList(data, 3) : [])
  const wroteAt = $derived(data ? lastWriteAt(data) : null)

  const nothingTracked = $derived(
    data !== null &&
      data.pinned.length === 0 &&
      data.frequent.length === 0 &&
      data.recentlyEdited.length === 0,
  )

  /** One line of facts, in the order you would ask for them. */
  const summary = $derived.by(() => {
    if (roots.length === 0) return 'Add a folder to get started — you can add as many as you like.'

    const openTasks = todos?.total ?? 0
    const parts = [`${roots.length} folder${roots.length === 1 ? '' : 's'}`]
    if (openTasks > 0) parts.push(`${openTasks} open task${openTasks === 1 ? '' : 's'}`)
    if (wroteAt) parts.push(`last wrote ${relativeTime(wroteAt)}`)
    return parts.join(' · ')
  })

  function applyDecor(next: { icon?: string; color?: string }) {
    if (!decor) return
    if (decor.kind === 'folder') {
      void setFolderDecor(decor.path, {
        ...(next.icon ? { icon: next.icon } : {}),
        ...(next.color ? { color: next.color } : {}),
      })
    } else {
      void updateMeta(decor.path, { icon: next.icon ?? '', color: next.color ?? '' })
    }
    decor = { ...decor, icon: next.icon, color: next.color }
  }

  const ACTION =
    'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--bg-hover)]'
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-5xl px-12 py-10">
    <header class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-[22px] font-semibold tracking-tight">Home</h1>
        <p class="mt-1 text-[13px]" style="color: var(--text-muted)">{summary}</p>
      </div>

      {#if roots.length > 0}
        <button
          type="button"
          onclick={() => void createFileBesideActive()}
          class={ACTION}
          style="border-color: var(--border)"
        >
          <FilePlus2 size={16} strokeWidth={2} />
          New note
        </button>
      {/if}
      <button
        type="button"
        onclick={() => void openFolderDialog()}
        class={ACTION}
        style="border-color: {roots.length === 0 ? 'var(--border-strong)' : 'var(--border)'}"
      >
        <FolderPlus size={16} strokeWidth={2} />
        Add folder
      </button>
    </header>

    {#if data}
      <div class="mt-8 flex flex-col gap-8">
        {#if carryOn.length > 0}
          <section>
            <h2
              class="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style="color: var(--text-faint)"
            >
              Continue
            </h2>
            <div class="mt-3">
              <ContinueCards
                items={carryOn}
                tallies={todos?.byFile ?? {}}
                onDecor={request => (decor = request)}
              />
            </div>
          </section>
        {/if}

        {#if nothingTracked && roots.length > 0}
          <p class="text-[13px]" style="color: var(--text-faint)">
            Nothing opened yet. Open a note and this page fills in on its own.
          </p>
        {/if}

        <section>
          <TodoInbox
            scan={todos}
            loading={scanning}
            {scope}
            {roots}
            onScope={next => void setSetting('homeTodoScope', next)}
          />
        </section>

        <div class="grid gap-8 sm:grid-cols-2">
          <MarkedPanel pinned={data.pinned} />
          <PlacesPanel {data} {tags} {mentions} {onSearch} />
        </div>
      </div>
    {/if}
  </div>

  <!--
    Hosted here rather than in the card, so the picker survives the list
    reordering under it — a refresh mid-edit would otherwise unmount it.
  -->
  {#if decor}
    {#key decor.path}
      <IconPicker target={decor} onApply={applyDecor} onClose={() => (decor = null)} />
    {/key}
  {/if}
</div>
