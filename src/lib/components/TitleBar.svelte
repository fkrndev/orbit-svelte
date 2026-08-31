<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import Lock from '@lucide/svelte/icons/lock'
  import Monitor from '@lucide/svelte/icons/monitor'
  import Moon from '@lucide/svelte/icons/moon'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import PanelRight from '@lucide/svelte/icons/panel-right'
  import Search from '@lucide/svelte/icons/search'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import Sun from '@lucide/svelte/icons/sun'
  import { getState } from '@/store.svelte'
  import { togglePanelSetting, toggleReadOnly } from '@/actions'
  import { canGoBack, canGoForward } from '@/navHistory'
  import { goBack, goForward } from '@/navigation'
  import { api } from '@/rpcClient'
  import { nextTheme, setThemePreference, type ThemePreference } from '@/theme.svelte'
  import { keysFor, labelWithKeys } from '$shared/shortcuts'
  import BarButton, { DRAG, NO_DRAG } from './BarButton.svelte'
  import Destinations from './Destinations.svelte'
  import Tooltip from './Tooltip.svelte'
  import EditorToolbar from './EditorToolbar.svelte'

  /**
   * The window uses `hiddenInset` chrome, so this strip both provides the drag
   * region and leaves room for the macOS traffic lights on the left.
   *
   * Laid out the way an editor's title bar is: panel toggles on the outside, and
   * one centred control in the middle that is simultaneously the window title and
   * the way you search. Naming the open file *inside* the search field is what
   * makes that work — the thing you are looking at and the way to look at
   * something else are the same target, so the bar needs no separate title.
   *
   * Movement lives to the left of that field, in browser order: back, forward,
   * then the two fixed places you can always return to.
   */
  let {
    onQuickOpen,
    onOpenByPath,
    onOpenSettings,
  }: { onQuickOpen: () => void; onOpenByPath: () => void; onOpenSettings: () => void } = $props()

  const activePath = $derived(getState().activePath)
  const surface = $derived(getState().surface)
  const sidebarOpen = $derived(getState().settings.sidebarOpen)
  const inspectorOpen = $derived(getState().settings.inspectorOpen)
  const theme = $derived(getState().settings.theme)
  const readOnly = $derived(getState().settings.readOnly)
  const nav = $derived(getState().nav)

  const name = $derived(activePath ? activePath.slice(activePath.lastIndexOf('/') + 1) : null)

  const THEME_LABEL: Record<ThemePreference, string> = {
    system: 'Following system',
    light: 'Light',
    dark: 'Dark',
  }

  /**
   * The bar's own double-click zooms the window, as every other macOS title bar
   * does. The event bubbles up from the controls too, so a double-click on a
   * toggle would otherwise fire the toggle twice *and* zoom.
   */
  function zoomOnDoubleClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest(`.${NO_DRAG}`)) return
    void api.toggleWindowZoom().catch(() => undefined)
  }
</script>

<!--
  The double-click zooms the window, as every macOS title bar does. It belongs to
  the drag strip rather than to a control — everything focusable in here is a
  real button — so there is no role that would make it reachable another way.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<header
  class="{DRAG} relative flex h-11 shrink-0 items-center gap-1 border-b pr-2"
  ondblclick={zoomOnDoubleClick}
  style="background: var(--bg-sunken); border-color: var(--border); padding-left: 82px"
>
  <BarButton
    label={labelWithKeys('toggleSidebar')}
    on={sidebarOpen}
    onclick={() => togglePanelSetting('sidebarOpen')}
  >
    {#snippet icon()}<PanelLeft size={16} strokeWidth={2} />{/snippet}
  </BarButton>

  <!--
    History, then every destination in the app.

    Back and forward move along the path you took; the group after the rule says
    where that path currently is. They sit together because they are the same
    job — getting somewhere without going through the file tree — and this is why
    the sidebar needs no nav section of its own.
  -->
  <div class="{NO_DRAG} flex shrink-0 items-center gap-0.5">
    <BarButton label={labelWithKeys('back')} disabled={!canGoBack(nav)} onclick={goBack}>
      {#snippet icon()}<ChevronLeft size={16} strokeWidth={2} />{/snippet}
    </BarButton>
    <BarButton label={labelWithKeys('forward')} disabled={!canGoForward(nav)} onclick={goForward}>
      {#snippet icon()}<ChevronRight size={16} strokeWidth={2} />{/snippet}
    </BarButton>
    <span class="mx-1 h-4 w-px shrink-0" style="background: var(--border)"></span>
    <Destinations {onOpenByPath} />
  </div>

  <!--
    The window title and the search box, as one control in the middle of the bar.

    It sits in the flex row and takes whatever the two clusters leave, capped at
    36rem so it does not sprawl on a wide screen. Centring it on the *window*
    instead was tried and is wrong: the left cluster is nearly twice the width of
    the right one, so a window-centred field slides underneath the destinations
    as soon as the window narrows. Centred in the space that is left over it can
    never overlap, and it narrows with the window rather than staying put.

    Sized to be read, not just clicked. At 26px it was a thin seam in a 44px bar
    and the filename inside it — the one piece of text that says which document
    you are in — was the smallest thing on screen. A 32px field with the name at
    the bar's own weight makes it legible as a title first and a search box
    second, which is the order you use it in.
  -->
  <button
    type="button"
    onclick={onQuickOpen}
    title={labelWithKeys('quickOpen')}
    class="{NO_DRAG} mx-auto flex h-8 max-w-[36rem] min-w-24 flex-1 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors hover:bg-[var(--bg-hover)]"
    style="border-color: var(--border); background: var(--bg)"
  >
    <Search size={16} strokeWidth={2} style="color: var(--text-faint)" class="shrink-0" />
    <span
      class="truncate {name ? 'font-medium' : ''}"
      style="color: {name ? 'var(--text)' : 'var(--text-faint)'}"
    >
      {name ? name.replace(/\.mdx?$/, '') : 'Search all folders'}
    </span>
    <!--
      Drawn as a keycap rather than set in the faintest grey available. It is
      the only place the app teaches this shortcut, and a hint nobody can read
      teaches nobody.
    -->
    <kbd
      class="ml-auto shrink-0 rounded border px-1.5 py-px font-sans text-[11px] leading-[1.4] max-[900px]:hidden"
      style="border-color: var(--border-strong); background: var(--bg-sunken); color: var(--text-muted)"
    >
      {keysFor('quickOpen')}
    </kbd>
  </button>

  <!--
    Two groups, split by what the button acts on: the note, then the window.
    Both are 16px glyphs in the same strip, so without the rule between them
    there is nothing to tell "do something to this file" apart from "change
    how the app looks" — they read as one undifferentiated row of eight.

    Inside the window group the panel toggle comes last, hard against the
    right edge — the mirror of the sidebar toggle sitting hard against the
    left. There is one of it because there is one pane: the outline and the
    todos are tabs inside it now, and a second button that opened the same
    panel on a different tab would be a toggle whose off state depended on
    which of the two you pressed. Theme and settings sit before it because
    they are the app's own state rather than this window's layout.
  -->
  <div class="{NO_DRAG} flex shrink-0 items-center gap-0.5">
    {#if surface === 'editor' && activePath}
      <EditorToolbar path={activePath} />
      <span class="mx-1 h-4 w-px shrink-0" style="background: var(--border)"></span>
    {/if}

    <!--
      Reading mode, with the app's own state rather than the file's — it is what
      the window will let you do, not something about the note. That is also why
      it outlived the editor toolbar it used to live in: read-only refuses writes
      everywhere, including the New note button on the Open surface, and a mode
      you cannot see is a mode you cannot turn off. Home and the path browser
      draw no toolbar, so the lock has to be here or it is nowhere.

      Filled rather than tinted when it is on, and that is the whole design of
      this button. Everything else in this strip is a grey glyph; this one says
      the app will refuse to write, and a mode that quietly swallows what you
      type is the one state that must be impossible to miss. It uses `--brand`
      as a *surface* with `--brand-on` over it — a contrast step, not a new hue,
      so it stays loud in both themes without inventing a colour.
    -->
    <Tooltip
      label={readOnly ? 'Read-only — files are protected' : 'Read-only mode'}
      shortcut={keysFor('readOnly')}
    >
      <button
        type="button"
        aria-label="Read-only mode"
        aria-pressed={readOnly}
        onclick={() => void toggleReadOnly()}
        class="{NO_DRAG} shrink-0 rounded p-1.5 transition-colors hover:bg-[var(--bg-hover)]"
        style={readOnly
          ? 'background: var(--brand); color: var(--brand-on)'
          : 'color: var(--text-faint)'}
      >
        <Lock size={16} strokeWidth={2} />
      </button>
    </Tooltip>

    <!--
      Cycles system → light → dark. A three-state cycle rather than a binary
      toggle, because "follow the OS" is a real preference and dropping it would
      mean the app stops changing with the rest of the desktop at sunset.
    -->
    <button
      type="button"
      onclick={() => setThemePreference(nextTheme(theme))}
      title="Theme: {THEME_LABEL[theme]} — click for {THEME_LABEL[
        nextTheme(theme)
      ].toLowerCase()}"
      aria-label="Theme: {THEME_LABEL[theme]}"
      class="{NO_DRAG} shrink-0 rounded p-1.5 transition-colors hover:bg-[var(--bg-hover)]"
      style="color: {theme === 'system' ? 'var(--text-faint)' : 'var(--text)'}"
    >
      {#if theme === 'system'}<Monitor size={16} strokeWidth={2} />
      {:else if theme === 'light'}<Sun size={16} strokeWidth={2} />
      {:else}<Moon size={16} strokeWidth={2} />{/if}
    </button>

    <BarButton label="Settings" onclick={onOpenSettings}>
      {#snippet icon()}<SettingsIcon size={16} strokeWidth={2} />{/snippet}
    </BarButton>

    <!--
      The pane only exists inside the editor, so its toggle does not come along
      to the dashboard. Leaving it visible there — as the info panel used to
      be — offers a button whose only possible effect is on a screen you are not
      looking at.
    -->
    {#if surface === 'editor'}
      <BarButton
        label={labelWithKeys('showInfo', 'Toggle inspector')}
        on={inspectorOpen}
        onclick={() => togglePanelSetting('inspectorOpen')}
      >
        {#snippet icon()}<PanelRight size={16} strokeWidth={2} />{/snippet}
      </BarButton>
    {/if}
  </div>
</header>
