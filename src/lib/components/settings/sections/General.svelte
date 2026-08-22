<script lang="ts">
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import type { AppSettings } from '$shared/types'
  import { getState } from '@/store.svelte'
  import { setSetting } from '@/actions'
  import SettingSection from '../SettingSection.svelte'
  import SettingRow from '../SettingRow.svelte'
  import * as Select from '@/components/ui/select'
  import { Switch } from '@/components/ui/switch'

  /*
   * Light/dark moved to Appearance, next to the base colour and the accent it
   * has to work with. It was here when the only thing to say about colour was
   * "which of the two", and it stopped belonging the moment there was more.
   */

  const EDITOR_MODES: Array<{ value: AppSettings['editorMode']; label: string }> = [
    { value: 'rich', label: 'Rich text' },
    { value: 'raw', label: 'Markdown source' },
  ]

  const settings = $derived(getState().settings)
  const editorMode = $derived(settings.editorMode)
  const editorModeLabel = $derived(
    EDITOR_MODES.find(mode => mode.value === editorMode)?.label ?? '',
  )
</script>

<SettingSection title="General" description="What the app opens a note into, and how it is formatted.">
  {#snippet icon()}<SlidersHorizontal size={16} strokeWidth={2} />{/snippet}

  <SettingRow
    title="Default editor mode"
    description="Which view a note opens in. ⌘/ switches the open note either way."
    control={modePicker}
  />
  <!--
    Both apply to the rich view only, and both are shown here whichever view you
    are in: settings is where you find out an option exists, and hiding a row
    because of an unrelated setting is how an option stays undiscovered.
  -->
  <SettingRow
    title="Formatting toolbar"
    description="A permanent row of formatting buttons above the note. Off by default — it costs a strip of the window on every note, and the same commands are on the keyboard and in the menu below."
    control={toolbarSwitch}
  />
  <SettingRow
    title="Formatting menu on selection"
    description="Shows the formatting buttons over text you select. Turn it off if you format by keyboard and would rather see the line underneath."
    control={bubbleSwitch}
  />
</SettingSection>

{#snippet toolbarSwitch()}
  <Switch
    aria-label="Formatting toolbar"
    checked={settings.editorToolbarOpen}
    onCheckedChange={checked => void setSetting('editorToolbarOpen', checked)}
  />
{/snippet}

{#snippet bubbleSwitch()}
  <Switch
    aria-label="Formatting menu on selection"
    checked={settings.editorBubbleMenuOpen}
    onCheckedChange={checked => void setSetting('editorBubbleMenuOpen', checked)}
  />
{/snippet}

{#snippet modePicker()}
  <Select.Root
    type="single"
    value={editorMode}
    onValueChange={value => void setSetting('editorMode', value as AppSettings['editorMode'])}
  >
    <Select.Trigger class="w-44">{editorModeLabel}</Select.Trigger>
    <Select.Content>
      {#each EDITOR_MODES as mode (mode.value)}
        <Select.Item value={mode.value}>{mode.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}
