<script lang="ts">
  import { getState } from '@/store.svelte'
  import { resolveAddFolderPrompt } from '@/actions'
  import { Button } from '@/components/ui/button/index.js'
  import { Checkbox } from '@/components/ui/checkbox/index.js'
  import * as Dialog from '@/components/ui/dialog/index.js'

  /**
   * Asked once, after a note has been opened from a folder the sidebar has never
   * heard of: should the folder come along?
   *
   * It comes *after* the file is on screen, deliberately. Opening by path is the
   * fast way in, and a modal between the Enter key and the note would spend that
   * speed on bookkeeping. By the time this appears the thing you asked for has
   * already happened, so "Not now" costs nothing.
   *
   * The checkbox is the escape hatch from the dialog itself. Anyone who opens
   * paths all day wants one answer forever, and the honest place to put that is
   * next to the answer — where it turns into the preference the Settings page
   * shows, rather than a hidden fourth state.
   */
  const prompt = $derived(getState().addFolderPrompt)

  let remember = $state(false)
  let busy = $state(false)

  // A second prompt can replace the first without the {#if} ever going false,
  // so the same instance is reused — reset per prompt or its buttons stay dead.
  $effect(() => {
    prompt
    busy = false
    remember = false
  })

  function answer(add: boolean) {
    if (busy) return
    busy = true
    void resolveAddFolderPrompt(add, remember)
  }

  const name = $derived(
    prompt ? prompt.folder.slice(prompt.folder.lastIndexOf('/') + 1) || prompt.folder : '',
  )
</script>

{#if prompt}
  <Dialog.Root open onOpenChange={open => !open && answer(false)}>
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title class="text-[15px]">Add {name} to the sidebar?</Dialog.Title>
        <Dialog.Description class="text-[12px]">
          The note is open either way. Adding the folder puts its files in the sidebar and in ⌘P
          search — nothing is imported, copied or moved.
        </Dialog.Description>
      </Dialog.Header>

      <p
        class="truncate rounded-md border px-2.5 py-1.5 font-mono text-[11.5px]"
        style="border-color: var(--border); background: var(--bg-sunken); color: var(--text-muted)"
        title={prompt.folder}
      >
        {prompt.folder}
      </p>

      <label class="flex items-center gap-2 text-[12.5px]" style="color: var(--text-muted)">
        <Checkbox bind:checked={remember} aria-label="Make this the default" />
        Make this the default — stop asking
      </label>

      <Dialog.Footer>
        <Button variant="outline" onclick={() => answer(false)} disabled={busy}>Not now</Button>
        <Button onclick={() => answer(true)} disabled={busy}>Add folder</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
