<script lang="ts">
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import FolderPlus from '@lucide/svelte/icons/folder-plus'
  import Pin from '@lucide/svelte/icons/pin'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import type { AddFolderOnPathOpen, Root } from '$shared/types'
  import { getState } from '@/store.svelte'
  import { openFolderDialog, setSetting } from '@/actions'
  import { toggleRootPinned } from '@/sidebar'
  import SettingSection from '../SettingSection.svelte'
  import SettingRow from '../SettingRow.svelte'
  import RemoveRootDialog from './RemoveRootDialog.svelte'
  import { Button } from '@/components/ui/button'
  import Tooltip from '../../Tooltip.svelte'
  import * as Select from '@/components/ui/select'

  /**
   * The folders the app reads from.
   *
   * The only section here that is not a preference — it is the one place every
   * root is visible at once, which the sidebar cannot be because it is showing
   * their contents.
   */
  const roots = $derived(getState().roots)
  const addFolder = $derived(getState().settings.addFolderOnPathOpen)

  let confirming = $state<Root | null>(null)

  /**
   * The same three answers the dialog offers, in the place you look when you want
   * to change your mind about one you ticked "make this the default" on.
   *
   * Both write `addFolderOnPathOpen`, so there is exactly one preference and no
   * way for the dialog and this row to disagree — see `resolveAddFolderPrompt`.
   */
  const ADD_FOLDER_CHOICES: Array<{ value: AddFolderOnPathOpen; label: string }> = [
    { value: 'ask', label: 'Ask each time' },
    { value: 'always', label: 'Always add it' },
    { value: 'never', label: 'Never add it' },
  ]

  const addFolderLabel = $derived(
    ADD_FOLDER_CHOICES.find(choice => choice.value === addFolder)?.label ?? '',
  )
</script>

<SettingSection
  title="Folders"
  description="Every folder the app reads. Notes are read in place — nothing is imported or copied."
>
  {#snippet icon()}<FolderOpen size={16} strokeWidth={2} />{/snippet}

  {#if roots.length === 0}
    <p class="px-4 py-6 text-[12.5px]" style="color: var(--text-faint)">
      No folders yet. Add one and its notes appear in the sidebar.
    </p>
  {:else}
    {#each roots as root (root.id)}
      <div
        class="flex items-center gap-3 px-4 py-3 [&+&]:border-t"
        style="border-color: var(--border)"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 text-[13px] font-medium">
            {root.name}
            {#if root.pinned}
              <Pin size={12} strokeWidth={2} fill="currentColor" style="color: var(--brand)" />
            {/if}
          </div>
          <div class="truncate text-[12px]" style="color: var(--text-muted)" title={root.path}>
            {root.path}
          </div>
        </div>

        <Tooltip label={root.pinned ? 'Unpin folder' : 'Pin to top of sidebar'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={root.pinned ? 'Unpin folder' : 'Pin folder'}
            onclick={() => void toggleRootPinned(root.id)}
            style="color: {root.pinned ? 'var(--text)' : 'var(--text-faint)'}"
          >
            <Pin size={16} strokeWidth={2} />
          </Button>
        </Tooltip>

        <Tooltip label="Remove from sidebar">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove {root.name}"
            onclick={() => (confirming = root)}
            style="color: var(--text-faint)"
          >
            <Trash2 size={16} strokeWidth={2} />
          </Button>
        </Tooltip>
      </div>
    {/each}
  {/if}

  <div class="px-4 py-3" style="border-top: 1px solid var(--border)">
    <Button variant="outline" onclick={() => void openFolderDialog()}>
      <FolderPlus size={16} strokeWidth={2} />
      Add folder…
    </Button>
  </div>

  <SettingRow
    title="Opening a file by path"
    description="What to do about its folder when it is not in this list yet. The file opens either way."
    control={addFolderPicker}
  />
</SettingSection>

{#if confirming}
  {#key confirming.id}
    <RemoveRootDialog root={confirming} onClose={() => (confirming = null)} />
  {/key}
{/if}

{#snippet addFolderPicker()}
  <Select.Root
    type="single"
    value={addFolder}
    onValueChange={next => void setSetting('addFolderOnPathOpen', next as AddFolderOnPathOpen)}
  >
    <Select.Trigger class="w-44">{addFolderLabel}</Select.Trigger>
    <Select.Content>
      {#each ADD_FOLDER_CHOICES as choice (choice.value)}
        <Select.Item value={choice.value}>{choice.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/snippet}
