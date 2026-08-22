<script lang="ts">
  import Type from '@lucide/svelte/icons/type'
  import { getState } from '@/store.svelte'
  import { setSetting } from '@/actions'
  import { PANES } from '@/layout'
  import {
    CODE_FONTS,
    PROSE_FONTS,
    TYPE_SCALES,
    TYPOGRAPHY_DEFAULTS,
    formatScale,
    type FontChoice,
    type TypeScaleKey,
  } from '@/typography'
  import SettingSection from '../SettingSection.svelte'
  import SettingRow from '../SettingRow.svelte'
  import SliderRow from '../SliderRow.svelte'
  import { Slider } from '@/components/ui/slider'
  import { Button } from '@/components/ui/button'
  import * as Select from '@/components/ui/select'

  const settings = $derived(getState().settings)

  const SCALES: Array<{ key: TypeScaleKey; title: string; description?: string }> = [
    { key: 'fontSize', title: 'Font size' },
    { key: 'lineHeight', title: 'Line height' },
    {
      key: 'paragraphSpacing',
      title: 'Paragraph spacing',
      description: 'The gap between paragraphs, in multiples of the text size.',
    },
  ]

  function fontLabel(fonts: FontChoice[], value: string) {
    return fonts.find(font => font.value === value)?.label ?? value
  }

  function restoreTypographyDefaults() {
    for (const [key, value] of Object.entries(TYPOGRAPHY_DEFAULTS)) {
      void setSetting(key as keyof typeof TYPOGRAPHY_DEFAULTS, value)
    }
  }
</script>

<SettingSection
  title="Typography"
  description="Applies to the rich editor, the markdown source view, and the outline."
>
  {#snippet icon()}<Type size={16} strokeWidth={2} />{/snippet}

  <SettingRow title="Text font" control={proseFont} />
  <SettingRow
    title="Code font"
    description="Code blocks, inline code, and the markdown source view."
    control={codeFont}
  />

  {#each SCALES as scale (scale.key)}
    {@const spec = TYPE_SCALES[scale.key]}
    <SliderRow
      title={scale.title}
      description={scale.description}
      readout={formatScale(scale.key, settings[scale.key])}
    >
      <Slider
        type="single"
        aria-label={scale.title}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={settings[scale.key]}
        onValueChange={next => void setSetting(scale.key, next)}
      />
    </SliderRow>
  {/each}

  <!--
    The measure belongs with the type it measures, not with the panes it happens
    to be stored beside. The range comes from `PANES` rather than being written
    again here — a slider and a drag handle that disagree about the maximum is a
    bug nobody would think to look for.
  -->
  <SliderRow
    title="Line width"
    description="How wide the text column runs. The editor's edge can also be dragged."
    readout="{settings.editorWidth} px"
  >
    <Slider
      type="single"
      aria-label="Line width"
      min={PANES.editorWidth.min}
      max={PANES.editorWidth.max}
      step={16}
      value={settings.editorWidth}
      onValueChange={value => void setSetting('editorWidth', value)}
    />
  </SliderRow>

  <SettingRow
    title="Restore editor defaults"
    description="Puts the fonts, sizes, spacing, and line width back the way they shipped."
    control={restore}
  />
</SettingSection>

{#snippet proseFont()}
  <Select.Root
    type="single"
    value={settings.proseFont}
    onValueChange={value => void setSetting('proseFont', value)}
  >
    <Select.Trigger class="w-52" aria-label="Text font">
      {fontLabel(PROSE_FONTS, settings.proseFont)}
    </Select.Trigger>
    <Select.Content>
      {#each PROSE_FONTS as font (font.value)}
        <!--
          Each option is set in the font it names, which is the only way to
          choose a typeface without applying it first to find out.
        -->
        <Select.Item value={font.value} style="font-family: {font.stack}">{font.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}

{#snippet codeFont()}
  <Select.Root
    type="single"
    value={settings.codeFont}
    onValueChange={value => void setSetting('codeFont', value)}
  >
    <Select.Trigger class="w-52" aria-label="Code font">
      {fontLabel(CODE_FONTS, settings.codeFont)}
    </Select.Trigger>
    <Select.Content>
      {#each CODE_FONTS as font (font.value)}
        <Select.Item value={font.value} style="font-family: {font.stack}">{font.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}

{#snippet restore()}
  <Button variant="outline" onclick={restoreTypographyDefaults}>Restore defaults</Button>
{/snippet}
