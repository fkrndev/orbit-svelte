<script lang="ts">
  import Bookmark from '@lucide/svelte/icons/bookmark'
  import Clock from '@lucide/svelte/icons/clock'
  import Folder from '@lucide/svelte/icons/folder'
  import FolderSearch from '@lucide/svelte/icons/folder-search'
  import Hash from '@lucide/svelte/icons/hash'
  import House from '@lucide/svelte/icons/house'
  import type { Component } from 'svelte'
  import { getState } from '@/store.svelte'
  import { setSurface, togglePanelSetting } from '@/actions'
  import { setSidebarPanel } from '@/sidebar'
  import { ToggleGroup } from '@/components/ui/toggle-group'
  import type { ShortcutId } from '$shared/shortcuts'
  import PanelToggle, { type Destination } from './PanelToggle.svelte'

  /**
   * Every place in the app, as one row of five.
   *
   * Home and Open by path used to be plain buttons beside the group, which said
   * they were a different kind of thing — and they are not. All five are
   * destinations, exactly one of them is where you are, and going to any of them
   * leaves the one you were on. Home and the path browser hide the sidebar and
   * the three panel entries bring it back, so treating them as one exclusive
   * choice is what the app already does; the chrome now says so.
   *
   * Only the selected one is labelled. Five glyphs are not self-evident, but
   * naming all five would be wider than the search field they sit next to — so
   * the tab that is down spells itself out and the rest keep their name in a
   * tooltip.
   *
   * The group wears shadcn's `Tabs` default surface: a sunken track holding all
   * six, with the selected one raised out of it. It stays a `ToggleGroup` and
   * not `Tabs` because there are no tab panels underneath — two of these six
   * leave the editor entirely, and pressing the one already down has to reopen
   * a shut sidebar, which a tablist has no way to report.
   */
  let { onOpenByPath }: { onOpenByPath: () => void } = $props()

  const DESTINATIONS: Array<{
    value: Destination
    label: string
    icon: Component<{ size?: number | string; strokeWidth?: number | string }>
    shortcut?: ShortcutId
  }> = [
    { value: 'home', label: 'Home', icon: House, shortcut: 'home' },
    { value: 'browse', label: 'Open', icon: FolderSearch, shortcut: 'openByPath' },
    { value: 'files', label: 'Files', icon: Folder },
    { value: 'recents', label: 'Recents', icon: Clock },
    { value: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
    { value: 'tags', label: 'Tags', icon: Hash },
  ]

  const surface = $derived(getState().surface)
  const panel = $derived(getState().settings.sidebarPanel)
  const sidebarOpen = $derived(getState().settings.sidebarOpen)

  // Inside the editor the lit entry is the panel the sidebar is showing — and
  // nothing is lit when it is hidden, because then none of the three is on
  // screen to be the place you are.
  const active: Destination | '' = $derived(
    surface === 'dashboard' ? 'home' : surface === 'browse' ? 'browse' : sidebarOpen ? panel : '',
  )

  function revealSidebar() {
    if (!getState().settings.sidebarOpen) togglePanelSetting('sidebarOpen')
  }

  function go(value: Destination) {
    if (value === 'home') return setSurface('dashboard')
    if (value === 'browse') return onOpenByPath()
    void setSidebarPanel(value)
    // The panels live in the sidebar, and the sidebar only exists in the
    // editor — so choosing one is also choosing to be back in the document.
    revealSidebar()
    setSurface('editor')
  }
</script>

<!--
  `spacing` is 1 rather than the default 0 only to switch off the joined-segment
  rules the variant hangs on `data-[spacing=0]`: they square every entry's
  corners and round the outer two, and they win on specificity, so an item that
  asks for `rounded-md` does not get it. The gap they come with is taken back on
  the line below — tabs sit flush.
-->
<ToggleGroup
  type="single"
  spacing={1}
  value={active}
  onValueChange={value => value && go(value as Destination)}
  class="ml-1 h-8 items-center gap-0 rounded-lg bg-[var(--tab-track)] p-[3px]"
>
  {#each DESTINATIONS as item (item.value)}
    <!--
      Pressing the entry that is already down reports an empty value above, and
      that is exactly the case that has to open a shut sidebar — otherwise that
      one button does nothing. Closing stays with ⌘B, so `sidebarOpen` keeps a
      single owner. Hence `onPress` on the item as well as the group.
    -->
    <PanelToggle
      value={item.value}
      label={item.label}
      icon={item.icon}
      shortcut={item.shortcut}
      on={active === item.value}
      onPress={go}
    />
  {/each}
</ToggleGroup>
