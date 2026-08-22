<script lang="ts">
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import { Button } from '@/components/ui/button/index.js'

  /**
   * Shown when a file changed on disk while the editor had unsaved edits.
   *
   * Neither side wins automatically: silently reloading loses the user's typing,
   * silently overwriting loses whatever the other tool wrote.
   */
  let {
    name,
    onReload,
    onOverwrite,
  }: { name: string; onReload: () => void; onOverwrite: () => void } = $props()
</script>

<div
  class="flex shrink-0 items-center gap-3 border-b px-4 py-2.5 text-[12.5px]"
  style="background: var(--brand-soft); border-color: var(--border)"
>
  <TriangleAlert size={16} strokeWidth={2} style="color: var(--danger)" />
  <span style="color: var(--text)">
    <b>{name}</b> changed on disk while you were editing.
  </span>
  <div class="ml-auto flex gap-2">
    <Button variant="outline" size="sm" onclick={onReload}>Discard mine</Button>
    <Button variant="destructive" size="sm" onclick={onOverwrite}>Keep mine</Button>
  </div>
</div>
