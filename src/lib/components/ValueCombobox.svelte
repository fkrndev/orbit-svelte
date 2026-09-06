<script lang="ts">
  import Check from '@lucide/svelte/icons/check'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import * as Command from '@/components/ui/command'
  import * as Popover from '@/components/ui/popover'
  import { cn } from '@/utils'

  type Option = { value: string; label: string }

  let {
    value = $bindable(''),
    options,
    placeholder = '',
    searchPlaceholder = 'Search…',
    emptyText = 'No match',
    /** When set, a typed name can be committed as-is — installed fonts are not
        enumerable from the webview, so a preset list can never be complete. */
    customLabel = '',
    class: className = '',
    onCommit,
  }: {
    value?: string
    options: Option[]
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    customLabel?: string
    class?: string
    onCommit?: (value: string) => void
  } = $props()

  let open = $state(false)
  let search = $state('')

  const label = $derived(options.find(o => o.value === value)?.label || value || placeholder)

  function commit(next: string) {
    value = next
    open = false
    search = ''
    onCommit?.(next)
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class={cn('flex h-8 w-48 items-center gap-1.5 rounded-md border px-2 text-[0.8125rem]', className)}
    style="border-color: var(--border); color: var(--text)"
    role="combobox"
    aria-expanded={open}
  >
    <span class="min-w-0 flex-1 truncate text-left" style={value ? '' : 'color: var(--text-muted)'}>
      {label}
    </span>
    <ChevronsUpDown size={13} class="shrink-0 opacity-60" />
  </Popover.Trigger>

  <Popover.Content class="w-48 p-0" align="end">
    <Command.Root>
      <Command.Input placeholder={searchPlaceholder} bind:value={search} />
      <Command.List>
        <Command.Empty class="p-1">
          {#if customLabel && search.trim()}
            <button
              class="w-full rounded-sm px-2 py-1.5 text-left text-[0.75rem]"
              style="color: var(--text)"
              onclick={() => commit(search.trim())}
            >
              {customLabel} “{search.trim()}”
            </button>
          {:else}
            <span class="text-[0.8125rem]" style="color: var(--text-muted)">{emptyText}</span>
          {/if}
        </Command.Empty>
        <Command.Group>
          {#each options as option (option.value)}
            <!-- `value` drives Command's search, so it carries the label. -->
            <Command.Item value={option.label} onSelect={() => commit(option.value)}>
              <Check size={14} class={cn('shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')} />
              <span class="min-w-0 flex-1 truncate">{option.label}</span>
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
