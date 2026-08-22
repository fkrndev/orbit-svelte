<script lang="ts">
  import FileText from '@lucide/svelte/icons/file-text'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import X from '@lucide/svelte/icons/x'
  import { isDirty, type Tab } from '@/store.svelte'
  import { closeTab, openPath, startRename } from '@/actions'
  import { RULE } from './TabBar.svelte'

  let { tab, active, divided }: { tab: Tab; active: boolean; divided: boolean } = $props()

  const dirty = $derived(isDirty(tab))

  let el = $state<HTMLDivElement | null>(null)

  // Tabs shrink before they scroll, so this only fires once the strip is full —
  // at which point opening a file off the right-hand end would otherwise leave
  // you looking at an editor whose tab you cannot see.
  $effect(() => {
    if (active) el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  /** Top corners of the active tab, as a browser draws them. */
  const RADIUS = '8px'

  /**
   * An outline on three sides rather than a border, so the tab keeps its exact
   * width whether or not it is the active one, and so the hairline follows the
   * corners round instead of stopping at them.
   */
  const ACTIVE_OUTLINE = [
    'inset 0 1px 0 var(--border)',
    'inset 1px 0 0 var(--border)',
    'inset -1px 0 0 var(--border)',
  ].join(', ')

  // Only the inactive ones light up: the active tab is already the brightest
  // thing on the strip, and its background is set inline, which a hover class
  // could not override anyway.
  const hover = $derived(active ? '' : 'hover:bg-[var(--bg-hover)]')

  /*
   * Rounded at the top, square at the foot: the two bottom corners are where the
   * tab meets the editor, and a curve there would put a notch of strip colour
   * between the tab and the page it names.
   */
  const style = $derived(
    active
      ? 'background: var(--bg); color: var(--text); border-bottom: 1px solid var(--bg);' +
          ` border-top-left-radius: ${RADIUS}; border-top-right-radius: ${RADIUS};` +
          ` box-shadow: ${ACTIVE_OUTLINE};`
      : `color: var(--text-muted); border-bottom: ${RULE};`,
  )
</script>

<div
  bind:this={el}
  data-active={active}
  class="group relative flex min-w-[5.5rem] max-w-[15rem] flex-1 basis-0 items-center gap-1.5 px-2.5 text-[12.5px] transition-colors {hover}"
  {style}
>
  {#if divided}
    <span
      aria-hidden="true"
      class="absolute inset-y-1.5 left-0 w-px"
      style="background: var(--border)"
    ></span>
  {/if}

  <!--
    The leading glyph, which a browser spends on a favicon. Here it carries the
    one piece of state a filename cannot: whether the file changed underneath us.
  -->
  {#if tab.conflict}
    <span title="Changed on disk" class="shrink-0" style="color: var(--danger)">
      <TriangleAlert size={14} strokeWidth={2} />
    </span>
  {:else}
    <FileText size={14} strokeWidth={2} class="shrink-0" style="opacity: {active ? 0.8 : 0.55}" />
  {/if}

  <button
    type="button"
    onclick={() => void openPath(tab.path, { record: false })}
    ondblclick={() => startRename(tab.path)}
    onauxclick={event => {
      // Middle-click closes, as it does in every browser tab strip.
      if (event.button === 1) closeTab(tab.path)
    }}
    class="min-w-0 flex-1 truncate text-left"
    title="{tab.path}&#10;Double-click to rename"
  >
    {tab.name.replace(/\.mdx?$/, '')}
  </button>

  <button
    type="button"
    onclick={() => closeTab(tab.path)}
    title={dirty ? 'Save and close' : 'Close'}
    class="grid size-5 shrink-0 place-items-center rounded transition-colors hover:bg-[var(--bg-hover)]"
  >
    <!-- An unsaved tab shows a dot until hovered, then the close affordance. -->
    {#if dirty}
      <span class="size-1.5 rounded-full group-hover:hidden" style="background: var(--brand)"></span>
      <X size={14} strokeWidth={2} class="hidden group-hover:block" />
    {:else}
      <X size={14} strokeWidth={2} class="opacity-45 transition group-hover:opacity-100" />
    {/if}
  </button>
</div>
