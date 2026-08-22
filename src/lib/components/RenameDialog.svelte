<script lang="ts">
  import { untrack } from 'svelte'
  import { basename, nameWithoutExtension, planFolderRename, planRename } from '$shared/rename'
  import { cancelRename, renameFile, renameFolder } from '@/actions'
  import type { RenameTarget } from '@/store.svelte'
  import { Button } from '@/components/ui/button/index.js'
  import { Input } from '@/components/ui/input/index.js'
  import * as Dialog from '@/components/ui/dialog/index.js'

  /**
   * Renaming a file or a folder, always in place — the parent folder is shown but
   * not editable, so this can never turn into an accidental move.
   *
   * One dialog for both, because everything the user sees is the same. What
   * differs is which rules the typed name is held to, and that difference lives in
   * `shared/rename.ts` where the handler applies it as well.
   */
  let { target }: { target: RenameTarget } = $props()

  /*
   * A folder's whole name is editable; a file opens on the part without its
   * extension, which is the part people actually mean to change.
   *
   * `untrack` because this is a starting value, not a mirror: the caller keys
   * the dialog on the path, so a rename of something else remounts rather than
   * reaching in and overwriting what the user has half-typed.
   */
  let name = $state(
    untrack(() =>
      target.kind === 'folder' ? basename(target.path) : nameWithoutExtension(target.path),
    ),
  )
  let busy = $state(false)

  const parent = $derived(target.path.slice(0, target.path.lastIndexOf('/')))
  // The same rules the handler applies, run as you type — a bad name is caught
  // before a round trip rather than after it.
  const plan = $derived(
    target.kind === 'folder' ? planFolderRename(target.path, name) : planRename(target.path, name),
  )
  const problem = $derived(plan.kind === 'invalid' ? plan.reason : null)

  async function submit() {
    if (busy || problem) return
    busy = true
    // The dialog stays open on failure — the message names what went wrong
    // ("already exists in that folder"), and the typed name is still there to
    // correct rather than re-enter.
    const done =
      target.kind === 'folder'
        ? await renameFolder(target.path, name)
        : await renameFile(target.path, name)
    if (!done) busy = false
  }
</script>

<Dialog.Root open onOpenChange={open => !open && cancelRename()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="text-[15px]">
        {target.kind === 'folder' ? 'Rename folder' : 'Rename file'}
      </Dialog.Title>
      <Dialog.Description class="break-all text-[11.5px]">{parent}</Dialog.Description>
    </Dialog.Header>

    <!-- svelte-ignore a11y_autofocus -->
    <Input
      autofocus
      bind:value={name}
      disabled={busy}
      onkeydown={event => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        void submit()
      }}
      onfocus={event => (event.currentTarget as HTMLInputElement).select()}
      aria-label={target.kind === 'folder' ? 'New folder name' : 'New file name'}
    />

    <p class="-mt-2 text-[11.5px]" style="color: {problem ? 'var(--danger)' : 'var(--text-faint)'}">
      {problem ?? (plan.kind === 'ok' ? basename(plan.nextPath) : 'Unchanged')}
    </p>

    {#if target.kind === 'folder' && !problem}
      <p class="-mt-3 text-[11.5px] leading-snug" style="color: var(--text-faint)">
        Notes inside keep their tags, pins, and history.
      </p>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={cancelRename} disabled={busy}>Cancel</Button>
      <Button onclick={() => void submit()} disabled={busy || Boolean(problem)}>Rename</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
