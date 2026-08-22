<script lang="ts">
  import Keyboard from '@lucide/svelte/icons/keyboard'
  import { SHORTCUTS, SHORTCUT_GROUPS } from '$shared/shortcuts'
  import SettingSection from '../SettingSection.svelte'

  /**
   * The keyboard, read-only.
   *
   * Read-only because rebinding is a much bigger feature than a list — it needs
   * keystroke capture, conflict detection against the native menu, and somewhere
   * to store the result. This is the half that is useful on its own: most people
   * asking about shortcuts want to know one exists, not to change it.
   *
   * Everything comes from `shared/shortcuts.ts`, which the tooltips also read, so
   * this table cannot drift out of step with what the buttons say.
   */
</script>

<SettingSection
  title="Keyboard shortcuts"
  description="Not editable yet. The same bindings appear in the menu bar and in tooltips."
>
  {#snippet icon()}<Keyboard size={16} strokeWidth={2} />{/snippet}

  {#each SHORTCUT_GROUPS as group (group)}
    {@const rows = SHORTCUTS.filter(shortcut => shortcut.group === group)}
    {#if rows.length > 0}
      <div class="[&+&]:border-t" style="border-color: var(--border)">
        <div
          class="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] uppercase"
          style="color: var(--text-faint)"
        >
          {group}
        </div>
        {#each rows as shortcut (shortcut.id)}
          <div class="flex items-center justify-between px-4 py-2">
            <span class="text-[13px]">{shortcut.label}</span>
            <kbd
              class="shrink-0 rounded border px-1.5 py-px font-sans text-[11px] leading-[1.4]"
              style="border-color: var(--border-strong); background: var(--bg-sunken); color: var(--text-muted)"
            >
              {shortcut.keys}
            </kbd>
          </div>
        {/each}
      </div>
    {/if}
  {/each}
</SettingSection>
