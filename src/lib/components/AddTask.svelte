<script lang="ts">
  import { Input } from '@/components/ui/input'

  let { onAdd, onCancel }: { onAdd: (text: string) => void; onCancel: () => void } = $props()

  let draft = $state('')
</script>

<div class="px-2 py-1">
  <!-- svelte-ignore a11y_autofocus -->
  <Input
    autofocus
    bind:value={draft}
    onkeydown={event => {
      // The editor is a contenteditable that grabs keys aggressively; stopping
      // propagation keeps typing inside this field.
      event.stopPropagation()
      if (event.key === 'Escape') onCancel()
      if (event.key !== 'Enter') return
      const text = draft.trim()
      if (text === '') {
        onCancel()
        return
      }
      onAdd(text)
      // Stays open so a list can be typed straight in, one Enter each.
      draft = ''
    }}
    onblur={() => draft.trim() === '' && onCancel()}
    placeholder="New task, then Enter"
    class="h-7 text-[12px]"
  />
</div>
