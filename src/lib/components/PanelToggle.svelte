<script lang="ts" module>
  import type { SidebarPanel } from '$shared/types'
  export type Destination = 'home' | 'browse' | SidebarPanel
</script>

<script lang="ts">
  import type { Component } from 'svelte'
  import { ToggleGroupItem } from '@/components/ui/toggle-group'
  import { labelWithKeys, type ShortcutId } from '$shared/shortcuts'
  import Tooltip from './Tooltip.svelte'

  /**
   * One destination, dressed as a tab: a bare glyph on the track while it is up,
   * a raised labelled tab once it is down.
   *
   * The surface is shadcn's `Tabs` default variant — a sunken track with the
   * selected entry lifted out of it — rather than the free-floating pill this
   * used to be. A row of six needs the track: without it the up entries are
   * glyphs on the title bar with nothing saying they belong to the same choice.
   * How the lift is drawn differs by theme, which is why it comes from
   * `--tab-on*` rather than from a colour named here.
   *
   * The tooltip is dropped in the down state because the label it would show is
   * already on screen an inch away.
   */
  let {
    value,
    label,
    icon: Icon,
    shortcut,
    on,
    onPress,
  }: {
    value: Destination
    label: string
    icon: Component<{ size?: number | string; strokeWidth?: number | string }>
    shortcut?: ShortcutId
    on: boolean
    onPress: (value: Destination) => void
  } = $props()

  /**
   * Driven from component state rather than Nova's `data-[state=on]:` class.
   * A tooltip that merges its own `data-state` onto the trigger would leave the
   * toggle's "on" arriving as "open"/"closed" and never getting styled — the
   * wrapper in `Tooltip.svelte` avoids that today, but the selected surface is
   * not something to leave depending on it.
   *
   * The `data-[state=on]:` and `aria-pressed:` copies are here to beat the
   * variant's own `bg-muted` in those states, which `cn` cannot merge away: it
   * only drops a conflicting class when both carry the same modifier.
   */
  const skin = $derived(
    on
      ? 'gap-1.5 px-2.5 text-[13px] font-medium border-[var(--tab-on-border)] [box-shadow:var(--tab-on-shadow)] bg-[var(--tab-on)] data-[state=on]:bg-[var(--tab-on)] aria-pressed:bg-[var(--tab-on)] text-[var(--text)]'
      : 'w-7 p-0 text-[var(--text-muted)] hover:bg-transparent hover:text-[var(--text)]',
  )
</script>

{#snippet item()}
  <ToggleGroupItem
    {value}
    size="sm"
    aria-label={label}
    onclick={() => onPress(value)}
    class="h-full min-w-0 shrink-0 rounded-md border border-transparent {skin}"
  >
    <Icon size={16} strokeWidth={2} />
    {#if on}<span class="whitespace-nowrap">{label}</span>{/if}
  </ToggleGroupItem>
{/snippet}

{#if on}
  {@render item()}
{:else}
  <Tooltip label={shortcut ? labelWithKeys(shortcut, label) : label}>
    {@render item()}
  </Tooltip>
{/if}
