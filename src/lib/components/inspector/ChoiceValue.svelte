<script lang="ts">
  import Check from '@lucide/svelte/icons/check'
  import Plus from '@lucide/svelte/icons/plus'
  import X from '@lucide/svelte/icons/x'
  import type { PropertyOption } from '$shared/propertySchema'
  import Chip from './Chip.svelte'
  import MenuItem from './MenuItem.svelte'
  import MenuSeparator from './MenuSeparator.svelte'
  import { Input } from '@/components/ui/input'
  import * as Popover from '@/components/ui/popover'

  /**
   * The value cell for the two types whose values come from a list: select and
   * multi-select.
   *
   * It replaces a text box wired to a `<datalist>`. That control looked like a
   * suggestion but behaved like free text: the browser drew it differently on
   * every platform, the suggestions were invisible until you typed, and nothing
   * told you that "Done" and "done" were about to become two different statuses.
   *
   * Here the choices are visible before you type, filtered as you do, and typing
   * something new offers to *create* it — so a new option is one gesture, and an
   * existing one can never be missed by a capital letter.
   */
  let {
    values,
    options,
    multiple,
    onChange,
  }: {
    values: string[]
    options: PropertyOption[]
    multiple: boolean
    onChange: (values: string[]) => void
  } = $props()

  let open = $state(false)
  let query = $state('')

  const colors = $derived(new Map(options.map(option => [option.name, option.color])))

  const matches = $derived.by(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return options
    return options.filter(option => option.name.toLowerCase().includes(needle))
  })

  const typed = $derived(query.trim())
  const canCreate = $derived(
    typed !== '' && !options.some(option => option.name.toLowerCase() === typed.toLowerCase()),
  )

  function choose(name: string) {
    if (!multiple) {
      onChange(values[0] === name ? [] : [name])
      open = false
      query = ''
      return
    }
    onChange(values.includes(name) ? values.filter(value => value !== name) : [...values, name])
    query = ''
  }
</script>

<Popover.Root
  bind:open
  onOpenChange={next => {
    if (!next) query = ''
  }}
>
  <Popover.Trigger
    class="block w-full rounded text-left transition-colors hover:bg-[var(--bg-hover)]"
    title={values.length > 0 ? values.join(', ') : 'Click to set'}
  >
    {#if values.length === 0}
      <span class="block pt-[3px] pl-0.5 text-[12px]" style="color: var(--text-faint)">—</span>
    {:else}
      <span class="flex flex-wrap gap-1 py-[1px]">
        {#each values as value (value)}
          <Chip name={value} color={colors.get(value) ?? 'default'} />
        {/each}
      </span>
    {/if}
  </Popover.Trigger>

  <Popover.Content align="start" class="w-64 p-1">
    <div class="pb-1">
      <!-- svelte-ignore a11y_autofocus -->
      <Input
        autofocus
        bind:value={query}
        onkeydown={event => {
          event.stopPropagation()
          if (event.key !== 'Enter') return
          // Enter takes the obvious answer: the one match if there is one,
          // otherwise the option the typed text would create.
          if (matches.length > 0) choose(matches[0]!.name)
          else if (canCreate) choose(typed)
        }}
        placeholder="Search or create…"
        class="h-7 text-[12px]"
      />
    </div>

    <div class="max-h-64 overflow-y-auto">
      {#each matches as option (option.name)}
        {@const picked = values.includes(option.name)}
        <MenuItem onclick={() => choose(option.name)}>
          {#snippet label()}<Chip name={option.name} color={option.color} />{/snippet}
          {#snippet detail()}
            {#if picked}<Check size={14} strokeWidth={2} />{/if}
          {/snippet}
        </MenuItem>
      {/each}
      {#if matches.length === 0 && !canCreate}
        <div class="px-2 py-3 text-center text-[12px]" style="color: var(--text-faint)">
          No options yet
        </div>
      {/if}
    </div>

    {#if canCreate}
      {#if matches.length > 0}<MenuSeparator />{/if}
      <MenuItem onclick={() => choose(typed)}>
        {#snippet icon()}<Plus size={14} strokeWidth={2} />{/snippet}
        {#snippet label()}
          <span class="flex items-center gap-1">
            Create
            <Chip name={typed} color="default" class="border" />
          </span>
        {/snippet}
      </MenuItem>
    {/if}

    {#if values.length > 0}
      <MenuSeparator />
      <MenuItem
        onclick={() => {
          onChange([])
          open = false
        }}
      >
        {#snippet icon()}<X size={14} strokeWidth={2} />{/snippet}
        {#snippet label()}Clear{/snippet}
      </MenuItem>
    {/if}
  </Popover.Content>
</Popover.Root>
