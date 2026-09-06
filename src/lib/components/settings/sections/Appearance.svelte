<script lang="ts">
  import Check from '@lucide/svelte/icons/check'
  import Monitor from '@lucide/svelte/icons/monitor'
  import Moon from '@lucide/svelte/icons/moon'
  import Palette from '@lucide/svelte/icons/palette'
  import Sun from '@lucide/svelte/icons/sun'
  import { getState } from '@/store.svelte'
  import { setSetting } from '@/actions'
  import { resolvedTheme, setThemePreference, type ThemePreference } from '@/theme.svelte'
  import { ACCENTS, BASE_COLORS, RADII } from '@/themePresets'
  import { baseColorPreset } from '@/themeSkin'
  import SettingSection from '../SettingSection.svelte'
  import SettingRow from '../SettingRow.svelte'
  import SliderRow from '../SliderRow.svelte'
  import * as Select from '@/components/ui/select'
  import { Slider } from '@/components/ui/slider'
  import { Button } from '@/components/ui/button'
  import ValueCombobox from '@/components/ValueCombobox.svelte'
  import { DEFAULT_SETTINGS } from '$shared/types'
  import {
    currentTextColor,
    GOOGLE_SANS_FONTS,
    SYSTEM_SANS_FONTS,
    type TextColorKey,
  } from '@/appearance'

  /**
   * The look, in one place.
   *
   * Light/dark used to live under General, beside "which view a note opens in",
   * and that was the wrong neighbour: one is about colour, the other about
   * editing. Now the three questions that compose into a palette — the grey, the
   * hue on it, and how hard the corners are — are read together, which is the
   * only way to tell whether a combination works.
   *
   * The presets are shadcn-svelte's own, mapped onto this app's tokens in
   * `themePresets.ts`. Nothing here is previewed in a swatch box, because the
   * change lands on the whole window behind the sheet the moment it is clicked
   * — a preview would be a smaller, worse copy of what is already on screen.
   */

  const THEME_LABEL: Record<ThemePreference, string> = {
    light: 'Light',
    dark: 'Dark',
    system: 'Auto',
  }

  /*
   * Light, Dark, Auto — not the cycle order. The title-bar button cycles
   * system → light → dark because that is the order that keeps one press from
   * jumping between the two extremes; a row of three is read left to right, and
   * "follow the OS" is the one that belongs at the end as the opt-out.
   */
  const THEME_CHOICES: ThemePreference[] = ['light', 'dark', 'system']

  const settings = $derived(getState().settings)
  const theme = $derived(settings.theme)
  const base = $derived(baseColorPreset(settings.themeBaseColor))
  const accent = $derived(settings.themeAccent)
  const radius = $derived(settings.themeRadius)
  /*
   * The swatches are drawn from the theme actually on screen, not from the light
   * one. Every accent has two values — 0.45 in light, 0.83 in dark — so a fixed
   * dot would promise a colour the click does not deliver, and in dark mode it
   * would promise the darker half of every pair against a near-black sheet.
   *
   * `resolvedTheme()` rather than `settings.theme`, so this still tracks the OS
   * while the preference is Auto.
   */
  const mode = $derived(resolvedTheme())

  /*
   * Interface type and colour, beside the palette that decides everything else.
   *
   * Reading typography lives under Typography and stays there: that section is
   * about the document, this one is about the app around it. The two never write
   * the same variable — see `appearance.ts` and `typography.ts`.
   */
  const asOptions = (names: string[]) => names.map(name => ({ value: name, label: name }))
  const UI_FONTS = [
    ...asOptions(SYSTEM_SANS_FONTS),
    ...GOOGLE_SANS_FONTS.map(name => ({ value: name, label: `${name} · Google` })),
  ]
  const WEIGHTS = [
    { value: '300', label: 'Light (300)' },
    { value: '400', label: 'Normal (400)' },
    { value: '500', label: 'Medium (500)' },
    { value: '600', label: 'Semibold (600)' },
  ]
  const BOLD_WEIGHTS = [
    { value: '500', label: 'Medium (500)' },
    { value: '600', label: 'Semibold (600)' },
    { value: '700', label: 'Bold (700)' },
    { value: '800', label: 'Extrabold (800)' },
    { value: '900', label: 'Black (900)' },
  ]
  const COLOR_SLOTS: { key: TextColorKey; title: string; description: string }[] = [
    { key: 'textColor', title: 'Main text colour', description: 'Titles, note text and values.' },
    { key: 'mutedTextColor', title: 'Label text colour', description: 'Labels and descriptions like this one.' },
    { key: 'faintTextColor', title: 'Faint text colour', description: 'Hints, counts and timestamps.' },
  ]

  const APPEARANCE_DEFAULTS = {
    uiFontFamily: DEFAULT_SETTINGS.uiFontFamily,
    uiFontSize: DEFAULT_SETTINGS.uiFontSize,
    uiFontWeight: DEFAULT_SETTINGS.uiFontWeight,
    uiFontWeightBold: DEFAULT_SETTINGS.uiFontWeightBold,
    textColor: DEFAULT_SETTINGS.textColor,
    mutedTextColor: DEFAULT_SETTINGS.mutedTextColor,
    faintTextColor: DEFAULT_SETTINGS.faintTextColor,
  } as const

  /** A slot with no override still needs a swatch, so show what it renders with. */
  function swatch(key: TextColorKey): string {
    return settings[key] || currentTextColor(key)
  }

  function restoreAppearanceDefaults() {
    for (const [key, value] of Object.entries(APPEARANCE_DEFAULTS)) {
      void setSetting(key as keyof typeof APPEARANCE_DEFAULTS, value)
    }
  }
</script>

<SettingSection
  title="Appearance"
  description="The palette the whole app is drawn from. Presets are shadcn-svelte's."
>
  {#snippet icon()}<Palette size={16} strokeWidth={2} />{/snippet}

  <SettingRow
    title="Mode"
    description="Auto follows the system setting, including when it changes at sunset."
    control={modePicker}
  />
  <SettingRow
    title="Base colour"
    description="The grey everything else sits on — panels, borders, and text. Each one is a different cast rather than a different brightness."
    control={basePicker}
  />
  <SettingRow
    title="Accent colour"
    description="The one hue the chrome is allowed: selected rows, the caret, matched characters, the folder glyphs. None keeps the base colour's own grey."
    control={accentPicker}
    wide
  />
  <SettingRow title="Corner radius" description="How hard the corners are." control={radiusPicker} />
  <SettingRow
    title="Interface font"
    description="The chrome's own font — sidebar, menus, labels. Google families are downloaded the first time they are used."
    control={uiFontPicker}
  />
  <SliderRow
    title="Interface text size"
    description="Type only: borders and icons keep their size. Reading size is under Typography."
    readout="{settings.uiFontSize} px"
  >
    <Slider
      type="single"
      aria-label="Interface text size"
      min={11}
      max={22}
      step={1}
      value={settings.uiFontSize}
      onValueChange={next => void setSetting('uiFontSize', next)}
    />
  </SliderRow>
  <SettingRow
    title="Text weight"
    description="Ordinary text. Labels shift one step up with it."
    control={weightPicker}
  />
  <SettingRow
    title="Bold weight"
    description="Bold text. Headings shift one step down with it."
    control={boldWeightPicker}
  />
  {#each COLOR_SLOTS as slot (slot.key)}
    {#snippet colorPicker()}
      <div class="flex items-center gap-2">
        <input
          type="color"
          value={swatch(slot.key)}
          aria-label={slot.title}
          class="h-7 w-12 cursor-pointer rounded border bg-transparent"
          style="border-color: var(--border)"
          oninput={event => void setSetting(slot.key, event.currentTarget.value)}
        />
        <span class="w-16 font-mono text-[0.75rem]" style="color: var(--text-muted)">
          {swatch(slot.key)}
        </span>
      </div>
    {/snippet}
    <SettingRow title={slot.title} description={slot.description} control={colorPicker} />
  {/each}
  <SettingRow
    title="Restore appearance defaults"
    description="Interface font, size, weights and text colours only — the palette above is left alone."
    control={restoreAppearance}
  />
</SettingSection>

{#snippet uiFontPicker()}
  <ValueCombobox
    value={settings.uiFontFamily}
    options={UI_FONTS}
    placeholder="System default"
    searchPlaceholder="Search or type a font…"
    customLabel="Use"
    onCommit={next => void setSetting('uiFontFamily', next)}
  />
{/snippet}

{#snippet weightPicker()}
  <ValueCombobox
    value={String(settings.uiFontWeight)}
    options={WEIGHTS}
    onCommit={next => void setSetting('uiFontWeight', Number(next))}
  />
{/snippet}

{#snippet boldWeightPicker()}
  <ValueCombobox
    value={String(settings.uiFontWeightBold)}
    options={BOLD_WEIGHTS}
    onCommit={next => void setSetting('uiFontWeightBold', Number(next))}
  />
{/snippet}

{#snippet restoreAppearance()}
  <Button variant="outline" size="sm" onclick={restoreAppearanceDefaults}>Restore</Button>
{/snippet}

<!--
  Three states shown at once, rather than the title bar's one-button cycle.

  Both stay. The cycle is the shortcut you use while working; this is where you
  find out the third state exists at all, which a cycle can never tell you —
  `setThemePreference` is the single writer either way.
-->
{#snippet modePicker()}
  <div role="radiogroup" aria-label="Mode" class="flex items-center gap-1.5">
    {#each THEME_CHOICES as choice (choice)}
      {@const on = theme === choice}
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onclick={() => setThemePreference(choice)}
        class="flex h-[52px] w-[76px] flex-col items-center justify-center gap-1 rounded-lg border text-[0.75rem] transition-colors hover:bg-[var(--bg-hover)]"
        style="border-color: {on ? 'var(--text)' : 'var(--border)'}; color: {on
          ? 'var(--text)'
          : 'var(--text-muted)'}"
      >
        {#if choice === 'light'}<Sun size={16} strokeWidth={2} />
        {:else if choice === 'dark'}<Moon size={16} strokeWidth={2} />
        {:else}<Monitor size={16} strokeWidth={2} />{/if}
        {THEME_LABEL[choice]}
      </button>
    {/each}
  </div>
{/snippet}

<!--
  A dropdown for the base colour and a grid for the accent, which is not an
  inconsistency. Seven near-identical greys cannot be told apart as swatches —
  the name is what carries the difference — while eighteen hues are only
  distinguishable *as* colour, and reading their names would be slower.
-->
{#snippet basePicker()}
  <Select.Root
    type="single"
    value={base.name}
    onValueChange={value => void setSetting('themeBaseColor', value)}
  >
    <Select.Trigger class="w-44">
      <span class="flex items-center gap-2">
        <span
          class="size-3.5 shrink-0 rounded-full border"
          style="background: {base.swatch}; border-color: var(--border)"
        ></span>
        {base.title}
      </span>
    </Select.Trigger>
    <Select.Content>
      {#each BASE_COLORS as preset (preset.name)}
        <Select.Item value={preset.name} label={preset.title}>
          <span class="flex items-center gap-2">
            <span
              class="size-3.5 shrink-0 rounded-full border"
              style="background: {preset.swatch}; border-color: var(--border)"
            ></span>
            {preset.title}
          </span>
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}

{#snippet accentPicker()}
  <div role="radiogroup" aria-label="Accent colour" class="flex flex-wrap gap-1.5">
    <!--
      `none` is the base colour's own brand, which is what the app falls back to
      when no accent is set — so it is drawn from the same place the palette is,
      rather than as a grey placeholder that happens to look similar.
    -->
    {#each [{ ...base, name: 'none', title: 'None' }, ...ACCENTS] as preset (preset.name)}
      {@const on = accent === preset.name}
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={preset.title}
        title={preset.title}
        onclick={() => void setSetting('themeAccent', preset.name)}
        class="flex size-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
        style="background: {preset[mode]['--brand']}; border-color: {on
          ? 'var(--text)'
          : 'transparent'}"
      >
        {#if on}<Check size={14} strokeWidth={3} style="color: {preset[mode]['--brand-on']}" />{/if}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet radiusPicker()}
  <div role="radiogroup" aria-label="Corner radius" class="flex items-center gap-1.5">
    {#each RADII as preset (preset.name)}
      {@const on = radius === preset.name}
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onclick={() => void setSetting('themeRadius', preset.name)}
        class="flex h-11 w-14 flex-col items-center justify-center gap-1 rounded-lg border text-[0.6875rem] transition-colors hover:bg-[var(--bg-hover)]"
        style="border-color: {on ? 'var(--text)' : 'var(--border)'}; color: {on
          ? 'var(--text)'
          : 'var(--text-muted)'}"
      >
        <!-- The option drawn at its own radius: the label "0.45rem" means
             nothing, and the corner it produces means all of it. -->
        <span
          class="size-3.5 border-t-2 border-l-2"
          style="border-color: currentColor; border-top-left-radius: {preset.value}"
        ></span>
        {preset.title}
      </button>
    {/each}
  </div>
{/snippet}
