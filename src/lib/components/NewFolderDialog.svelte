<script lang="ts">
  import { folderNameProblem } from '$shared/rename'
  import { cancelNewFolder, createFolderIn } from '@/actions'
  import { Button } from '@/components/ui/button/index.js'
  import { Input } from '@/components/ui/input/index.js'
  import * as Dialog from '@/components/ui/dialog/index.js'

  /**
   * Naming a folder into existence.
   *
   * Deliberately not `RenameDialog` with a flag: that one starts from a path
   * and asks what to call it *instead*, and every line of it — the extension it
   * keeps, the "unchanged" case, the note about tags surviving — is about a
   * thing that already exists. What the two genuinely share is the rules the
   * typed name is held to, and those live in `shared/rename.ts` where the
   * handler applies them again.
   */
  let { dir }: { dir: string } = $props()

  let name = $state('')
  let busy = $state(false)

  // Checked as you type, by the same function the handler calls — a bad name is
  // caught before a round trip rather than after it.
  const problem = $derived(name.trim() ? folderNameProblem(name.trim()) : null)

  async function submit() {
    if (busy || problem || !name.trim()) return
    busy = true
    // The dialog stays open on failure, with the name still in the field to
    // correct: "already exists in that folder" is answered by editing one word.
    if (!(await createFolderIn(dir, name.trim()))) busy = false
  }
</script>

<Dialog.Root open onOpenChange={open => !open && cancelNewFolder()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="text-[15px]">New folder</Dialog.Title>
      <Dialog.Description class="break-all text-[11.5px]">{dir}</Dialog.Description>
    </Dialog.Header>

    <!-- svelte-ignore a11y_autofocus -->
    <Input
      autofocus
      bind:value={name}
      disabled={busy}
      placeholder="Folder name"
      onkeydown={event => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        void submit()
      }}
      aria-label="New folder name"
    />

    <p class="-mt-2 text-[11.5px]" style="color: {problem ? 'var(--danger)' : 'var(--text-faint)'}">
      {problem ?? 'Created empty, inside the folder above.'}
    </p>

    <Dialog.Footer>
      <Button variant="outline" onclick={cancelNewFolder} disabled={busy}>Cancel</Button>
      <Button onclick={() => void submit()} disabled={busy || !name.trim() || Boolean(problem)}>
        Create
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
