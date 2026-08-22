<script lang="ts">
  import { basename } from '$shared/rename'
  import { cancelDelete, deleteFile } from '@/actions'
  import { getState, isDirty } from '@/store.svelte'
  import { Button } from '@/components/ui/button/index.js'
  import * as Dialog from '@/components/ui/dialog/index.js'

  /**
   * Confirms a delete.
   *
   * One confirmation and no undo stack, because the backend only ever *moves* the
   * file to the OS trash — the real undo is the one already on the user's desktop.
   * Saying where it goes is what makes a single click enough.
   */
  let { path }: { path: string } = $props()

  let busy = $state(false)

  // Unsaved edits are the one thing the trash cannot give back, since they were
  // never on disk to begin with. Worth saying out loud before they go.
  const unsaved = $derived.by(() => {
    const tab = getState().tabs.find(t => t.path === path)
    return tab ? isDirty(tab) : false
  })

  async function confirm() {
    if (busy) return
    busy = true
    if (!(await deleteFile(path))) busy = false
  }
</script>

<Dialog.Root open onOpenChange={open => !open && cancelDelete()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="text-[15px]">Move to Trash?</Dialog.Title>
      <Dialog.Description class="break-all text-[12px]">
        <span style="color: var(--text)">{basename(path)}</span> goes to your Trash, so you can put
        it back from there.
      </Dialog.Description>
    </Dialog.Header>

    {#if unsaved}
      <p class="text-[12px]" style="color: var(--danger)">
        This file has unsaved edits. Those are not on disk, so the Trash cannot bring them back.
      </p>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={cancelDelete} disabled={busy}>Cancel</Button>
      <Button variant="destructive" onclick={() => void confirm()} disabled={busy}>
        Move to Trash
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
