<script lang="ts">
  import Check from '@lucide/svelte/icons/check'
  import X from '@lucide/svelte/icons/x'
  import * as Dialog from '@/components/ui/dialog'
  import { Button } from '@/components/ui/button'
  import { getState } from '@/store.svelte'
  import { ICONS, ICON_KEYS, iconFor, type IconKey } from './icons'
  import type { DecorRequest } from './rowMenus'

  /**
   * Picks an icon and a colour for one file or folder.
   *
   * The colours are the **label palette**, not a free colour wheel. Colour in
   * this app is information rather than decoration, and a folder tinted blue
   * because blue is nice would quietly break that. Reusing the label colours
   * keeps a coloured row meaning something, and adds no second palette to
   * maintain.
   */
  let {
    target,
    onApply,
    onClose,
  }: {
    target: DecorRequest
    onApply: (decor: { icon?: string; color?: string }) => void
    onClose: () => void
  } = $props()

  const labels = $derived(getState().labels)
  const fallback: IconKey = $derived(target.kind === 'folder' ? 'folder' : 'file')
  const DefaultIcon = $derived(iconFor(undefined, fallback))

  function apply(patch: { icon?: string; color?: string }) {
    onApply({ icon: target.icon, color: target.color, ...patch })
  }

  const HEADING = 'mb-2 text-[10.5px] font-semibold tracking-[0.08em] uppercase'
  const CELL = 'grid aspect-square place-items-center rounded transition-colors hover:bg-[var(--bg-hover)]'
</script>

<Dialog.Root open onOpenChange={open => !open && onClose()}>
  <Dialog.Content class="sm:max-w-[420px]">
    <Dialog.Header>
      <Dialog.Title class="text-[15px]">Icon for {target.name}</Dialog.Title>
      <Dialog.Description class="text-[12px]">
        Shown in the sidebar only. Nothing is written into the file.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <div>
        <p class={HEADING} style="color: var(--text-faint)">Colour</p>
        <div class="flex flex-wrap items-center gap-1.5">
          <!-- "No colour" is a choice, not the absence of one, so it gets a swatch. -->
          <button
            type="button"
            title="No colour"
            onclick={() => apply({ color: undefined })}
            class="grid size-6 place-items-center rounded-full border transition-transform hover:scale-110"
            style="border-color: var(--border-strong); color: var(--text-faint)"
          >
            {#if !target.color}<Check size={16} strokeWidth={2} />{/if}
          </button>
          {#each labels as label (label.name)}
            <button
              type="button"
              title={label.name}
              onclick={() => apply({ color: label.color })}
              class="grid size-6 place-items-center rounded-full transition-transform hover:scale-110"
              style="background: {label.color}; color: #fff"
            >
              {#if target.color === label.color}<Check size={16} strokeWidth={2} />{/if}
            </button>
          {/each}
        </div>
        {#if labels.length === 0}
          <p class="text-[12px]" style="color: var(--text-faint)">
            No labels defined yet — colours come from the label palette.
          </p>
        {/if}
      </div>

      <div>
        <p class={HEADING} style="color: var(--text-faint)">Icon</p>
        <div class="grid max-h-56 grid-cols-9 gap-1 overflow-y-auto pr-1">
          <button
            type="button"
            title="Default"
            onclick={() => apply({ icon: undefined })}
            class={CELL}
            style="{target.icon ? '' : 'background: var(--bg-active);'} color: {target.icon
              ? 'var(--text-faint)'
              : 'var(--text-muted)'}"
          >
            <DefaultIcon size={16} strokeWidth={2} />
          </button>
          {#each ICON_KEYS as key (key)}
            {@const Icon = ICONS[key]}
            <button
              type="button"
              title={key}
              onclick={() => apply({ icon: key })}
              class={CELL}
              style="{target.icon === key ? 'background: var(--bg-active);' : ''} color: var(--text-muted)"
            >
              <Icon size={16} strokeWidth={2} />
            </button>
          {/each}
        </div>
      </div>
    </div>

    <Dialog.Footer class="sm:justify-between">
      <Button
        variant="ghost"
        size="sm"
        onclick={() => onApply({})}
        disabled={!target.icon && !target.color}
      >
        <X size={16} strokeWidth={2} />
        Reset
      </Button>
      <Button size="sm" onclick={onClose}>Done</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
