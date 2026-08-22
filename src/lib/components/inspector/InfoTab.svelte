<script lang="ts">
  import Pencil from '@lucide/svelte/icons/pencil'
  import { getState } from '@/store.svelte'
  import { startRename } from '@/actions'
  import { relativeTime } from '@/format'
  import InfoPanel from './InfoPanel.svelte'
  import PropertiesPanel from './PropertiesPanel.svelte'

  /**
   * The inspector's first view: facts about the open file, then its properties.
   *
   * Info is first because it is the only part of this panel with a fixed shape.
   * Properties runs from empty to a dozen rows depending on the file, so with
   * that on top the word count sits somewhere different in every note and you
   * have to hunt for the same fact each time. Anchored at the top it is always in
   * the same place — and it is the half you read rather than edit, which is the
   * order you use them in anyway.
   *
   * It used to carry a second organisational layer as well — labels, sidecar
   * tags, and a private note, all kept in `files.json` and never written to the
   * file. That layer was built when properties could only hold a value; now that
   * a property can be a coloured multi-select, it was two ways to say the same
   * thing, and the frontmatter one is the one `grep`, Obsidian, and a diff can
   * also read. Only the panel went: the records are still in `files.json`, and
   * labels still mark rows in the sidebar and the dashboard.
   */
  const tab = $derived(getState().tabs.find(t => t.path === getState().activePath) ?? null)

  const TITLE = 'px-4 pb-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase'
</script>

{#if tab}
  <div class="min-h-0 flex-1 overflow-y-auto">
    <h3 class="{TITLE} pt-1" style="color: var(--text-faint)">Info</h3>
    <InfoPanel path={tab.path} content={tab.content} mtimeMs={tab.mtimeMs} />

    <!-- Only a bottom margin: the panel above already ends in its own `pb-4`. -->
    <div class="mx-4 mb-4 border-t" style="border-color: var(--border)"></div>

    <!--
      No pin control here. It lives in the editor toolbar, which is visible
      whether or not this panel is — two stars for one boolean, side by side,
      read as two different settings.
    -->
    <h3 class={TITLE} style="color: var(--text-faint)">Properties</h3>
    <PropertiesPanel path={tab.path} content={tab.content} />

    {#if tab.meta}
      <div
        class="mt-auto border-t px-4 py-3 text-[11px] leading-relaxed"
        style="border-color: var(--border); color: var(--text-faint)"
      >
        <div>Tracked since {relativeTime(tab.meta.createdAt)}</div>
        <button
          type="button"
          onclick={() => startRename(tab.path)}
          title="Rename this file"
          class="mt-0.5 flex w-full items-start gap-1 break-all text-left transition-colors hover:text-[var(--text-muted)]"
        >
          <Pencil size={16} strokeWidth={2} class="mt-[3px] shrink-0" />
          <span class="break-all">{tab.path}</span>
        </button>
      </div>
    {/if}
  </div>
{/if}
