<script lang="ts" module>
  /** The hairline under everything except the tab you are looking at. */
  export const RULE = '1px solid var(--border)'
</script>

<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import Plus from '@lucide/svelte/icons/plus'
  import { getState } from '@/store.svelte'
  import { createFileBesideActive, openPath } from '@/actions'
  import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js'
  import { keysFor } from '$shared/shortcuts'
  import Tooltip from './Tooltip.svelte'
  import TabButton from './TabButton.svelte'

  /**
   * Tabs only. The actions for the open file used to sit on this bar's right-hand
   * side, where they scrolled out of reach behind a long tab strip and sat a row
   * below the other controls that act on the same document. They live in the title
   * bar now, beside the theme toggle.
   *
   * Shaped like a browser's tab strip, because that is the strip everyone already
   * knows how to read: tabs share the width instead of queueing off-screen, the
   * open one is a block of the editor's own background so the tab and the page it
   * names are visibly one surface, and the two things a strip always needs — jump
   * to a tab, start a new one — sit at either end where a browser puts them.
   *
   * The bottom rule is drawn per element rather than on the strip, which is what
   * lets the active tab break it without negative margins.
   *
   * One exception, and it is deliberate: with the formatting toolbar on, that
   * bar draws its own rule along the top and closes the gap again. A band of
   * chrome sits between the tab and its page in that case anyway, so there is no
   * continuous surface left to preserve — see `editor/editor.css`.
   */
  const tabs = $derived(getState().tabs)
  const activePath = $derived(getState().activePath)
</script>

{#if tabs.length > 0}
  <div class="flex h-9 shrink-0 items-stretch" style="background: var(--bg-sunken)">
    <!--
      Every open file in one list. Tabs shrink as they multiply and eventually
      scroll, so the strip alone stops being a way to find anything.
    -->
    <DropdownMenu.Root>
      <Tooltip label="Open tabs" side="bottom">
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              type="button"
              class="grid w-8 shrink-0 place-items-center transition-colors hover:bg-[var(--bg-hover)]"
              style="border-bottom: {RULE}; border-right: {RULE}; color: var(--text-muted)"
              aria-label="Open tabs"
            >
              <ChevronDown size={15} strokeWidth={2} />
            </button>
          {/snippet}
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Content align="start" class="max-h-80 min-w-56 overflow-y-auto">
        <DropdownMenu.RadioGroup
          value={activePath ?? ''}
          onValueChange={path => void openPath(path, { record: false })}
        >
          {#each tabs as tab (tab.path)}
            <DropdownMenu.RadioItem value={tab.path} class="truncate">
              {tab.name.replace(/\.mdx?$/, '')}
            </DropdownMenu.RadioItem>
          {/each}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <div class="scrollbar-none flex min-w-0 flex-1 items-stretch overflow-x-auto">
      {#each tabs as tab, index (tab.path)}
        <!--
          A rule between two tabs only earns its place when neither of them is
          the open one — the open tab is already an edge.
        -->
        <TabButton
          {tab}
          active={tab.path === activePath}
          divided={index > 0 && tabs[index - 1]!.path !== activePath && tab.path !== activePath}
        />
      {/each}
    </div>

    <!-- Same file the ⌘N menu command creates, put where a browser puts the plus. -->
    <Tooltip label="New file" shortcut={keysFor('newFile')} side="bottom">
      <button
        type="button"
        onclick={() => void createFileBesideActive()}
        class="grid w-9 shrink-0 place-items-center transition-colors hover:bg-[var(--bg-hover)]"
        style="border-bottom: {RULE}; border-left: {RULE}; color: var(--text-muted)"
        aria-label="New file"
      >
        <Plus size={15} strokeWidth={2} />
      </button>
    </Tooltip>
  </div>
{/if}
