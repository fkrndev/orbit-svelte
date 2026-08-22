<script lang="ts">
  import type { Root } from '$shared/types'
  import { api } from '@/rpcClient'
  import { refreshRoots } from '@/actions'
  import { Button } from '@/components/ui/button'
  import * as Dialog from '@/components/ui/dialog'

  /**
   * Removing a root does not touch a single file, and there is no way for the
   * user to know that from a button labelled with a bin.
   *
   * So the dialog's whole job is the sentence about the notes staying on disk —
   * without it the safe answer is "don't press it", and the folder list becomes
   * append-only.
   */
  let { root, onClose }: { root: Root; onClose: () => void } = $props()

  let busy = $state(false)

  async function confirm() {
    if (busy) return
    busy = true
    try {
      await api.removeRoot({ id: root.id })
      await refreshRoots()
      onClose()
    } catch {
      busy = false
    }
  }
</script>

<Dialog.Root open onOpenChange={open => !open && onClose()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="text-[15px]">Remove {root.name}?</Dialog.Title>
      <Dialog.Description class="text-[12px]">
        The folder is removed from the sidebar only.
        <span style="color: var(--text)">Your notes stay on disk</span>, exactly where they are — add
        the folder again any time to get it back.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={onClose} disabled={busy}>Cancel</Button>
      <Button variant="destructive" onclick={() => void confirm()} disabled={busy}>
        Remove folder
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
