<script lang="ts">
  import { untrack } from 'svelte'
  import { getState, notify, setState } from '@/store.svelte'
  import {
    markEditing,
    reloadTab,
    forceSave,
    reopenActivePath,
    saveTab,
    setTabContent,
  } from '@/actions'
  import { api } from '@/rpcClient'
  import ConflictBanner from './ConflictBanner.svelte'
  import ResizeHandle from './ResizeHandle.svelte'
  import FindBar from './FindBar.svelte'
  import RawEditor from '@/editor/RawEditor.svelte'
  import RichEditor from '@/editor/RichEditor.svelte'
  import { closeFind, openFind } from '@/find'
  import { startTodoReveal } from '@/revealPending'
  import { editorModeFor } from '@/editor/editorMode'
  import { isMarkdownName } from '$shared/rename'

  const AUTOSAVE_IDLE_MS = 900

  const setTabContentFor = (markdown: string, path: string) => setTabContent(path, markdown)

  const tab = $derived(getState().tabs.find(t => t.path === getState().activePath) ?? null)
  // Not the raw setting: a code file is always shown as source. See `editorMode.ts`.
  const mode = $derived(
    tab ? editorModeFor(tab.path, getState().settings.editorMode) : getState().settings.editorMode,
  )

  function setMode(next: 'rich' | 'raw') {
    setState(prev => ({ settings: { ...prev.settings, editorMode: next } }))
    void api.saveSettings({ patch: { editorMode: next } })
  }

  $effect(() => {
    const handler = (event: Event) => {
      const command = (event as CustomEvent<string>).detail
      if (command === 'toggle-raw-mode') {
        // Said rather than silently ignored: a shortcut that does nothing reads
        // as a broken app, and the reason is not guessable from the screen.
        if (tab && !isMarkdownName(tab.path)) {
          notify('info', 'Code files only open as source')
          return
        }
        setMode(mode === 'rich' ? 'raw' : 'rich')
        return
      }
      // Both editors can be searched, each on its own terms — markdown source
      // in one, rendered prose in the other — so ⌘F no longer drags you out of
      // the view you chose. See `find.ts`.
      if (command === 'find-in-file' && tab) openFind()
    }
    window.addEventListener('app:menu', handler)
    return () => window.removeEventListener('app:menu', handler)
  })

  // A search belongs to the file it was run against; carrying its hits to the
  // next tab would point them at offsets in someone else's text.
  $effect(() => {
    void tab?.path
    return closeFind
  })

  // A task clicked on Home parks a jump; this is where it is claimed, because
  // this is the first place that knows an editor is about to exist for the file.
  // Keyed on the path alone: re-running it per keystroke would re-scroll the
  // document while it is being typed in.
  $effect(() => {
    const path = tab?.path ?? ''
    const content = untrack(() => tab?.content ?? '')
    return startTodoReveal(path, content)
  })

  /*
   * The surface that would draw the dead end is the one that repairs it — see
   * `reopenActivePath`. Attempted once per path: a file that could not be read
   * has already said so through a notice, and retrying on every store write
   * would turn one failed open into a stream of them.
   */
  let repaired = ''
  $effect(() => {
    const path = getState().activePath
    if (!path || tab || repaired === path) return
    repaired = path
    void reopenActivePath(path)
  })

  const dirty = $derived(tab ? tab.content !== tab.savedContent : false)

  // Autosave on idle. A short pause in typing is a much better save trigger
  // than a timer, and it means ⌘S is a convenience rather than a duty.
  $effect(() => {
    const path = tab?.path
    // Read so a further keystroke restarts the timer.
    void tab?.content
    if (!path || !dirty) return
    const timer = setTimeout(() => void saveTab(path), AUTOSAVE_IDLE_MS)
    return () => clearTimeout(timer)
  })
</script>

{#if !tab}
  <div class="grid h-full place-items-center text-[13px]" style="color: var(--text-faint)">
    No file open
  </div>
{:else}
  <div class="flex h-full min-h-0 flex-col">
    {#if tab.conflict}
      <ConflictBanner
        name={tab.name}
        onReload={() => void reloadTab(tab.path)}
        onOverwrite={() => void forceSave(tab.path)}
      />
    {/if}
    {#if tab.missing}
      <div
        class="shrink-0 border-b px-4 py-2 text-[12.5px]"
        style="background: var(--brand-soft); border-color: var(--border)"
      >
        This file no longer exists on disk. Saving will recreate it.
      </div>
    {/if}

    <FindBar />

    <div class="relative min-h-0 flex-1">
      <!--
        The right-hand edge of the text column itself.

        The other three handles move a panel; this one moves the *measure* — how
        wide the prose is allowed to run before it wraps. It is the only
        dimension the editor owns, since its outer width is whatever the panels
        leave behind.

        `min()` keeps the handle on the real edge: once the window is narrower
        than the measure, the column is capped by the container and the edge
        stops moving out with the setting.
      -->
      <div
        class="pointer-events-none absolute inset-y-0 left-1/2 z-10"
        style="transform: translateX(calc(min(var(--editor-measure), 100%) / 2))"
      >
        <div class="pointer-events-auto relative h-full">
          <ResizeHandle pane="editorWidth" edge="right" label="Text width" />
        </div>
      </div>

      <!--
        Keyed by path *and* mode so each file gets a clean editor lifecycle
        rather than one view whose document is swapped underneath it — and so
        switching to source tears the rich editor down rather than leaving two
        engines registered for the same file.
      -->
      {#key tab.path + mode}
        {#if mode === 'rich'}
          <!--
            The editors report which file they are speaking for rather than
            being asked. `tab` is live, and during a switch it names the file
            being opened while the editor still holds the one being left — see
            `ownPath` in either editor.
          -->
          <RichEditor
            path={tab.path}
            content={tab.content}
            onChange={setTabContentFor}
            onEditIntent={markEditing}
          />
        {:else}
          <RawEditor
            path={tab.path}
            content={tab.content}
            onChange={setTabContentFor}
            onEditIntent={markEditing}
            onSave={path => void saveTab(path)}
          />
        {/if}
      {/key}
    </div>
  </div>
{/if}
