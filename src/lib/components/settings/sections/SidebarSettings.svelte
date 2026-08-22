<script lang="ts">
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import type { RecentSort, RecentsPreview, SidebarPanel } from '$shared/types'
  import { getState } from '@/store.svelte'
  import { setSetting } from '@/actions'
  import SettingSection from '../SettingSection.svelte'
  import SettingRow from '../SettingRow.svelte'
  import { Switch } from '@/components/ui/switch'
  import * as Select from '@/components/ui/select'

  /**
   * The sidebar's preferences.
   *
   * Most of these are also in the panels' own filter menus, which stay: changing
   * a sort from where you can see the result is faster than coming here. This is
   * where you find out the option exists; there is where you use it.
   */
  const PANELS: Array<{ value: SidebarPanel; label: string }> = [
    { value: 'files', label: 'Files' },
    { value: 'recents', label: 'Recents' },
    { value: 'bookmarks', label: 'Bookmarks' },
  ]

  // Same words the Recents panel's own menu uses. They are duplicated rather than
  // imported because importing them would drag a panel full of file rows into the
  // settings bundle for three strings.
  const SORTS: Array<{ value: RecentSort; label: string }> = [
    { value: 'recent', label: 'Recently opened' },
    { value: 'opens', label: 'Most opened' },
    { value: 'frecency', label: 'Frecency' },
  ]

  const PREVIEWS: Array<{ value: RecentsPreview; label: string }> = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ]

  const settings = $derived(getState().settings)

  function labelOf<T extends string>(options: Array<{ value: T; label: string }>, value: T) {
    return options.find(option => option.value === value)?.label ?? ''
  }
</script>

<SettingSection title="Sidebar" description="What the sidebar shows, and how the Recents list is built.">
  {#snippet icon()}<PanelLeft size={16} strokeWidth={2} />{/snippet}

  <SettingRow title="Default panel" description="Which panel the sidebar opens on." control={panel} />
  <SettingRow
    title="Show pinned section"
    description="Keeps pinned notes above the file tree."
    control={pinned}
  />
  <SettingRow title="Recents sort" control={sort} />
  <SettingRow
    title="Group recents by day"
    description="Only applies to the Recently opened sort."
    control={grouped}
  />
  <SettingRow
    title="Recents preview size"
    description="How many lines of each note the list previews."
    control={preview}
  />
</SettingSection>

{#snippet panel()}
  <Select.Root
    type="single"
    value={settings.sidebarPanel}
    onValueChange={next => void setSetting('sidebarPanel', next as SidebarPanel)}
  >
    <Select.Trigger class="w-44" aria-label="Default panel">
      {labelOf(PANELS, settings.sidebarPanel)}
    </Select.Trigger>
    <Select.Content>
      {#each PANELS as option (option.value)}
        <Select.Item value={option.value}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}

{#snippet pinned()}
  <Switch
    aria-label="Show pinned section"
    checked={settings.sidebarShowPinned}
    onCheckedChange={checked => void setSetting('sidebarShowPinned', checked)}
  />
{/snippet}

{#snippet sort()}
  <Select.Root
    type="single"
    value={settings.recentsSort}
    onValueChange={next => void setSetting('recentsSort', next as RecentSort)}
  >
    <Select.Trigger class="w-44" aria-label="Recents sort">
      {labelOf(SORTS, settings.recentsSort)}
    </Select.Trigger>
    <Select.Content>
      {#each SORTS as option (option.value)}
        <Select.Item value={option.value}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}

{#snippet grouped()}
  <Switch
    aria-label="Group recents by day"
    checked={settings.recentsGrouped}
    onCheckedChange={checked => void setSetting('recentsGrouped', checked)}
  />
{/snippet}

{#snippet preview()}
  <Select.Root
    type="single"
    value={settings.recentsPreview}
    onValueChange={next => void setSetting('recentsPreview', next as RecentsPreview)}
  >
    <Select.Trigger class="w-44" aria-label="Recents preview size">
      {labelOf(PREVIEWS, settings.recentsPreview)}
    </Select.Trigger>
    <Select.Content>
      {#each PREVIEWS as option (option.value)}
        <Select.Item value={option.value}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}
