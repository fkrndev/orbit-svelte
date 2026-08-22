<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus'
  import { SUGGESTED_PROPERTIES, type PropertySchema } from '$shared/propertySchema'
  import { PROPERTY_TYPE_OPTIONS, type PropertyType } from '$shared/propertyTypes'
  import { Input } from '@/components/ui/input'
  import * as Popover from '@/components/ui/popover'
  import MenuItem from './MenuItem.svelte'
  import MenuLabel from './MenuLabel.svelte'
  import MenuSeparator from './MenuSeparator.svelte'
  import { TYPE_ICON, TYPE_LABEL, humanize } from './propertyChrome'

  /**
   * One searchable list in place of a form.
   *
   * The old flow was a name field, a type dropdown, a value field, and two
   * buttons — four decisions and a commit for something that is usually "the
   * status property, like the one on every other note". Here the properties you
   * already use are one click, and a new one is its name plus its type.
   */
  let {
    schema,
    present,
    onPick,
  }: {
    schema: PropertySchema
    present: Set<string>
    onPick: (key: string, type: PropertyType) => void
  } = $props()

  let open = $state(false)
  let query = $state('')

  const known = $derived.by(() => {
    const seen = new Set<string>()
    const all = [
      ...SUGGESTED_PROPERTIES,
      ...Object.entries(schema.props).map(([key, config]) => ({
        key,
        type: config.type ?? ('text' as PropertyType),
      })),
    ]
    return all.filter(item => {
      if (present.has(item.key) || seen.has(item.key)) return false
      seen.add(item.key)
      return true
    })
  })

  const needle = $derived(query.trim().toLowerCase())
  const matches = $derived(needle === '' ? known : known.filter(item => item.key.includes(needle)))
  const typed = $derived(query.trim())
  const canCreate = $derived(
    typed !== '' && !known.some(item => item.key === needle) && !present.has(needle),
  )

  function pick(key: string, type: PropertyType) {
    onPick(key, type)
    open = false
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
    class="mt-1 flex items-center gap-1.5 rounded px-0.5 py-1 text-[12px] transition-colors hover:bg-[var(--bg-hover)]"
    style="color: var(--text-faint)"
  >
    <Plus size={16} strokeWidth={2} />
    Add property
  </Popover.Trigger>

  <Popover.Content align="start" side="left" class="w-64 p-1">
    <div class="pb-1">
      <!-- svelte-ignore a11y_autofocus -->
      <Input
        autofocus
        bind:value={query}
        onkeydown={event => {
          event.stopPropagation()
          if (event.key !== 'Enter') return
          if (matches.length > 0) pick(matches[0]!.key, matches[0]!.type)
          else if (canCreate) pick(typed, 'text')
        }}
        placeholder="Search for a property…"
        class="h-7 text-[12px]"
      />
    </div>

    <div class="max-h-64 overflow-y-auto">
      {#if matches.length > 0}
        <MenuLabel>Your properties</MenuLabel>
        {#each matches as item (item.key)}
          {@const Icon = TYPE_ICON[item.type]}
          <MenuItem onclick={() => pick(item.key, item.type)}>
            {#snippet icon()}<Icon size={14} strokeWidth={2} />{/snippet}
            {#snippet label()}{humanize(item.key)}{/snippet}
            {#snippet detail()}{TYPE_LABEL[item.type]}{/snippet}
          </MenuItem>
        {/each}
        <MenuSeparator />
      {/if}

      <!--
        Always offered, even when the search matched something. Hiding it behind
        "no results" made a new property reachable only by first typing a name
        that matched nothing, which is a rule nobody can see.
      -->
      <MenuLabel>New property</MenuLabel>
      {#if canCreate}
        <!--
          Outside the label, which is uppercased — a name shown back as "OWN" is
          not the name the property would be given.
        -->
        <div class="px-2 pb-1 text-[11px]" style="color: var(--text-muted)">
          Create “{typed}” as…
        </div>
      {/if}
      {#each PROPERTY_TYPE_OPTIONS as option (option.value)}
        {@const Icon = TYPE_ICON[option.value]}
        <MenuItem onclick={() => pick(canCreate ? typed : TYPE_LABEL[option.value], option.value)}>
          {#snippet icon()}<Icon size={14} strokeWidth={2} />{/snippet}
          {#snippet label()}{TYPE_LABEL[option.value]}{/snippet}
        </MenuItem>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>
