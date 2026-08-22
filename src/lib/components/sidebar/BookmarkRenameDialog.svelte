<script lang="ts">
  import { untrack } from 'svelte'
  import type { BookmarkView } from '$shared/types'
  import { renameBookmark } from '@/sidebar'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import * as Dialog from '@/components/ui/dialog'
  import { displayName } from './names'

  /**
   * Renaming a bookmark changes the label, never the file.
   *
   * A shadcn dialog rather than `window.prompt`: the native prompt is the one
   * control in this app that would look like a web page instead of the operating
   * system, and in WKWebView it is not reliably available at all.
   */
  let { entry, onClose }: { entry: BookmarkView; onClose: () => void } = $props()

  /*
   * A starting value, not a mirror — hence `untrack`. The panel keys this dialog
   * on the entry id, so renaming something else remounts rather than reaching in
   * and overwriting what the user has half-typed.
   */
  let value = $state(untrack(() => entry.title ?? displayName(entry.path ?? '')))

  function submit() {
    void renameBookmark(entry.id, value)
    onClose()
  }
</script>

<Dialog.Root open onOpenChange={open => !open && onClose()}>
  <Dialog.Content class="sm:max-w-[360px]">
    <Dialog.Header>
      <Dialog.Title class="text-[15px]">Rename bookmark</Dialog.Title>
    </Dialog.Header>
    <!-- svelte-ignore a11y_autofocus -->
    <Input
      autofocus
      bind:value
      onkeydown={event => {
        if (event.key === 'Enter') submit()
      }}
    />
    <Dialog.Footer>
      <Button variant="outline" size="sm" onclick={onClose}>Cancel</Button>
      <Button size="sm" onclick={submit}>Rename</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
