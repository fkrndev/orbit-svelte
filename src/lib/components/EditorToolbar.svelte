<script lang="ts">
  import Check from '@lucide/svelte/icons/check'
  import Circle from '@lucide/svelte/icons/circle'
  import Clipboard from '@lucide/svelte/icons/clipboard'
  import Code from '@lucide/svelte/icons/code'
  import CopyX from '@lucide/svelte/icons/copy-x'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import Folder from '@lucide/svelte/icons/folder'
  import FolderTree from '@lucide/svelte/icons/folder-tree'
  import Link from '@lucide/svelte/icons/link'
  import ListX from '@lucide/svelte/icons/list-x'
    import PanelTopClose from '@lucide/svelte/icons/panel-top-close'
  import PanelTopOpen from '@lucide/svelte/icons/panel-top-open'
  import Pencil from '@lucide/svelte/icons/pencil'
  import Star from '@lucide/svelte/icons/star'
  import Trash from '@lucide/svelte/icons/trash'
  import Waypoints from '@lucide/svelte/icons/waypoints'
  import X from '@lucide/svelte/icons/x'
  import { api } from '@/rpcClient'
  import { getState, isDirty, notify, setState } from '@/store.svelte'
  import {
    closeAllTabs,
    closeOtherTabs,
    closeTab,
    setSetting,
    startDelete,
    startRename,
    togglePanelSetting,
    updateMeta,
  } from '@/actions'
  import { revealActiveFile } from '@/sidebar'
  import { keysFor } from '$shared/shortcuts'
  import { isMarkdownName } from '$shared/rename'
  import { cn } from '@/utils'
  import Tooltip from './Tooltip.svelte'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'

  /**
   * Actions on the open file, in the title bar beside the app's own controls.
   *
   * They sat on the tab bar until the tab strip grew long enough to scroll them
   * off the end. Up here they are always in the same place, and they share a row
   * with the other controls that act on the whole window rather than on the text.
   *
   * What stays visible is what you press *while writing*: is it saved, is it
   * pinned, am I looking at the prose or the markdown. Everything else — the
   * things you do once, when you are finished with a file rather than in the
   * middle of it — is behind the dots. Reveal in Finder moved down there for that
   * reason; Move to Trash is down there for the opposite one, because the one
   * action you cannot undo should cost a deliberate extra click.
   *
   * The panel toggles are deliberately *not* here. Opening the outline or the info
   * panel changes the window, not the note, so they live with the sidebar toggle —
   * see `TitleBar`. The tab strip is the exception, and only because of where it
   * is: its toggle cannot sit on the strip it hides, and it would be the fourth
   * identical panel glyph in a row of them up there.
   *
   * Every button names its shortcut in the tooltip, which is the point of having
   * tooltips at all: the bar should teach you to stop needing it.
   */
  let { path }: { path: string } = $props()

  const tab = $derived(getState().tabs.find(t => t.path === path))
  const pinned = $derived(tab?.meta?.pinned ?? false)
  const dirty = $derived(tab ? isDirty(tab) : false)
  // A code file has no rich view to switch to — see `editorMode.ts`. The button
  // stays in place rather than disappearing: a toolbar that changes shape per
  // file is harder to learn than one control that says why it is off.
  const codeFile = $derived(!isMarkdownName(path))
  const mode = $derived(codeFile ? 'raw' : getState().settings.editorMode)
  const tabBarOpen = $derived(getState().settings.tabBarOpen)
  const tabCount = $derived(getState().tabs.length)
  const readOnly = $derived(getState().settings.readOnly)

  const toggleMode = () => {
    if (codeFile) return
    void setSetting('editorMode', mode === 'rich' ? 'raw' : 'rich')
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      notify('info', `Copied ${what}`)
    } catch {
      notify('error', `Could not copy ${what}`)
    }
  }

  /**
   * Copies what is on disk rather than the buffer, so an unsaved draft cannot be
   * pasted somewhere as if it were the file.
   */
  async function copyDocument() {
    const doc = await api.readFile({ path })
    await copy(doc.content, 'note')
  }

  const BUTTON =
    'rounded-md p-1.5 transition-colors hover:bg-[var(--bg-hover)]'
</script>

<div class="flex shrink-0 items-center gap-0.5">
  <!--
    Whether the buffer is on disk yet — a status, not a control.

    It used to be the word "Saved" in a status bar along the bottom, next to a
    Rich/Source toggle that the toolbar above already offered. A whole bar for
    one duplicated button and one word is a lot of window to spend, so the bar is
    gone and the word became a glyph up here where the file's other affordances
    already are.

    Dirty is the same small brand dot the tab shows, because it is the same fact;
    inventing a second vocabulary for it would just be something else to learn.
    The fixed-size box keeps the toolbar from shifting as the state flips — a row
    of buttons that twitches while you type reads as a glitch.
  -->
  <Tooltip
    label={dirty ? 'Unsaved changes' : 'Saved'}
    shortcut={dirty ? keysFor('save') : undefined}
  >
    <span
      role="status"
      aria-label={dirty ? 'Unsaved changes' : 'Saved'}
      class="mr-0.5 grid size-[15px] shrink-0 place-items-center"
      style="color: {dirty ? 'var(--brand)' : 'var(--text-faint)'}"
    >
      <!--
        The unsaved mark is a dot, not an icon: it stays small next to the 16px
        check it swaps with.
      -->
      {#if dirty}<Circle fill="currentColor" size={8} />
      {:else}<Check size={16} strokeWidth={2} />{/if}
    </span>
  </Tooltip>

  <Tooltip
    label={pinned ? 'Remove from pinned' : 'Pin to dashboard'}
    shortcut={keysFor('pinToDashboard')}
  >
    <button
      type="button"
      aria-label="Pin to dashboard"
      aria-pressed={pinned}
      onclick={() => void updateMeta(path, { pinned: !pinned })}
      class={BUTTON}
      style="color: {pinned ? 'var(--pinned)' : 'var(--text-faint)'}"
    >
      <!-- Lucide has no filled variant; the same icon takes `fill` instead. -->
      {#if pinned}<Star fill="currentColor" size={16} />
      {:else}<Star size={16} strokeWidth={2} />{/if}
    </button>
  </Tooltip>

  <Tooltip
    label={codeFile ? 'Code files only open as source' : 'Markdown source'}
    shortcut={codeFile ? undefined : keysFor('markdownSource')}
  >
    <button
      type="button"
      aria-label="Toggle markdown source"
      aria-pressed={mode === 'raw'}
      disabled={codeFile}
      onclick={toggleMode}
      class={cn(BUTTON, codeFile && 'cursor-default hover:bg-transparent')}
      style="color: {mode === 'raw' ? 'var(--text)' : 'var(--text-faint)'}; opacity: {codeFile
        ? 0.5
        : 1}"
    >
      <Code size={16} strokeWidth={2} />
    </button>
  </Tooltip>

  <DropdownMenu.Root>
    <Tooltip label="More actions">
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <button {...props} type="button" aria-label="More actions" class={BUTTON} style="color: var(--text-faint)">
            <Ellipsis size={16} strokeWidth={2} />
          </button>
        {/snippet}
      </DropdownMenu.Trigger>
    </Tooltip>
    <DropdownMenu.Content align="end" class="min-w-52">
      <!--
        The one item here that acts on the window rather than the file. It is in
        this menu because the menu is the only control that stays put when the
        strip goes: a toggle that lived on the tab bar would disappear along with
        the thing it toggles.
      -->
      <DropdownMenu.Item onSelect={() => togglePanelSetting('tabBarOpen')}>
        {#if tabBarOpen}<PanelTopClose size={16} strokeWidth={2} />
        {:else}<PanelTopOpen size={16} strokeWidth={2} />{/if}
        {tabBarOpen ? 'Hide tabs' : 'Show tabs'}
      </DropdownMenu.Item>
      <!--
        The rest of the strip's housekeeping, kept with the toggle above because
        all four act on which files are open rather than on the open file.
        Closing a tab saves it first, exactly as the tab's own × does — nothing
        here is a way to lose an edit.

        "Close other tabs" is dimmed rather than hidden when this is the only
        tab: a menu whose items move around between openings is a menu you have
        to read every time.
      -->
      <DropdownMenu.Item onSelect={() => closeTab(path)}>
        <X size={16} strokeWidth={2} />
        Close tab
      </DropdownMenu.Item>
      <DropdownMenu.Item disabled={tabCount < 2} onSelect={() => closeOtherTabs(path)}>
        <CopyX size={16} strokeWidth={2} />
        Close other tabs
      </DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => closeAllTabs()}>
        <ListX size={16} strokeWidth={2} />
        Close all tabs
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <!--
        A question about the file rather than a change to it, so it sits on its
        own: it neither closes anything nor hands the note outside the app the
        way the group below does.
      -->
      <DropdownMenu.Item onSelect={() => setState({ incomingLinks: { path } })}>
        <Waypoints size={16} strokeWidth={2} />
        Files linking here…
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item onSelect={() => void copyDocument()}>
        <Clipboard size={16} strokeWidth={2} />
        Copy note as markdown
      </DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => void copy(path, 'path')}>
        <Link size={16} strokeWidth={2} />
        Copy file path
      </DropdownMenu.Item>
      <!--
        Grouped with the copies rather than the edits: all three hand the file to
        something outside the app and none of them change it.
      -->
      <DropdownMenu.Item onSelect={() => void api.revealInFinder({ path })}>
        <Folder size={16} strokeWidth={2} />
        Reveal in Finder
      </DropdownMenu.Item>
      <!--
        The in-app twin of the line above, and the only one of this group that
        does not leave the app — so it sits last, where "where is this file?"
        gets answered without a detour through Finder.
      -->
      <DropdownMenu.Item onSelect={() => revealActiveFile()}>
        <FolderTree size={16} strokeWidth={2} />
        Reveal in Sidebar
        <DropdownMenu.Shortcut>{keysFor('revealInSidebar')}</DropdownMenu.Shortcut>
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <!--
        Dimmed rather than hidden while reading, for the same reason "Close other
        tabs" is: a menu whose items move between openings is one you have to
        read every time. Both would be refused anyway — the point of disabling
        them is to say so before the click, not to enforce it.
      -->
      <DropdownMenu.Item disabled={readOnly} onSelect={() => startRename(path)}>
        <Pencil size={16} strokeWidth={2} />
        Rename…
        <DropdownMenu.Shortcut>{keysFor('rename')}</DropdownMenu.Shortcut>
      </DropdownMenu.Item>
      <DropdownMenu.Item
        variant="destructive"
        disabled={readOnly}
        onSelect={() => startDelete(path)}
      >
        <Trash size={16} strokeWidth={2} />
        Move to Trash…
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
