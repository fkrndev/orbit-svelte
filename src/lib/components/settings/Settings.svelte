<script lang="ts">
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import Info from '@lucide/svelte/icons/info'
  import Keyboard from '@lucide/svelte/icons/keyboard'
  import Palette from '@lucide/svelte/icons/palette'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import Type from '@lucide/svelte/icons/type'
  import type { Component } from 'svelte'
  import * as Dialog from '@/components/ui/dialog'
  import General from './sections/General.svelte'
  import Appearance from './sections/Appearance.svelte'
  import Typography from './sections/Typography.svelte'
  import SidebarSettings from './sections/SidebarSettings.svelte'
  import Folders from './sections/Folders.svelte'
  import Shortcuts from './sections/Shortcuts.svelte'
  import About from './sections/About.svelte'

  /**
   * Settings, as a modal over whatever you were doing.
   *
   * A modal rather than a surface, which matters more than it sounds: settings is
   * a detour, not a destination. Coming here does not mean you have stopped
   * working on a note — the note is still behind the sheet, and closing puts you
   * back on it without needing Back, without a history entry, and without the
   * editor unmounting and losing its scroll position.
   *
   * Sections switch rather than scroll. Anchor-scrolling a page this long means
   * either a scroll-spy that fights the user's own scrolling, or a nav that
   * highlights nothing — and neither is worth it for seven destinations.
   */
  let { onClose }: { onClose: () => void } = $props()

  const SECTIONS: Array<{
    id: string
    label: string
    icon: Component<{ size?: number; strokeWidth?: number; class?: string }>
    render: Component
  }> = [
    { id: 'general', label: 'General', icon: SlidersHorizontal, render: General },
    { id: 'appearance', label: 'Appearance', icon: Palette, render: Appearance },
    { id: 'typography', label: 'Typography', icon: Type, render: Typography },
    { id: 'sidebar', label: 'Sidebar', icon: PanelLeft, render: SidebarSettings },
    { id: 'folders', label: 'Folders', icon: FolderOpen, render: Folders },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, render: Shortcuts },
    { id: 'about', label: 'About', icon: Info, render: About },
  ]

  let active = $state('general')

  const current = $derived(SECTIONS.find(section => section.id === active) ?? SECTIONS[0]!)
  const Section = $derived(current.render)
</script>

<Dialog.Root open onOpenChange={open => !open && onClose()}>
  <!--
    `p-0` and the explicit height because the sheet is two columns, not a
    message: the nav has to reach both edges and the content has to be the only
    thing that scrolls. The height is fixed rather than fitted to the section so
    switching sections does not resize the window under the pointer — Shortcuts
    is three times the height of General.
  -->
  <Dialog.Content
    class="h-[min(38rem,calc(100dvh-4rem))] grid-cols-[13rem_1fr] gap-0 overflow-hidden p-0 sm:max-w-[54rem]"
  >
    <!--
      The sheet has its own visible heading in the nav, but the accessible name
      has to come from the dialog itself or screen readers announce an unnamed
      dialog.
    -->
    <Dialog.Title class="sr-only">Settings</Dialog.Title>

    <nav
      aria-label="Settings sections"
      class="overflow-y-auto border-r px-3 py-5"
      style="border-color: var(--border); background: var(--bg-sunken)"
    >
      <h2 class="px-2 pb-3 text-[15px] font-semibold tracking-tight">Settings</h2>
      <ul class="flex flex-col gap-0.5">
        {#each SECTIONS as section (section.id)}
          {@const on = section.id === active}
          {@const Icon = section.icon}
          <li>
            <button
              type="button"
              aria-current={on ? 'page' : undefined}
              onclick={() => (active = section.id)}
              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)]"
              style="background: {on ? 'var(--bg-active)' : 'transparent'}; color: {on
                ? 'var(--text)'
                : 'var(--text-muted)'}; font-weight: {on ? 500 : 400}"
            >
              <Icon size={16} strokeWidth={2} class="shrink-0" />
              {section.label}
            </button>
          </li>
        {/each}
      </ul>
    </nav>

    <!--
      Keyed on the section so switching remounts rather than reconciles. These
      panels hold their own local state — the folder-removal dialog most of
      all — and carrying that across a nav click would mean landing on a section
      with a stale dialog open.
    -->
    <div class="min-w-0 overflow-y-auto">
      <div class="px-8 py-7 pr-12">
        {#key current.id}
          <Section />
        {/key}
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
