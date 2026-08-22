<script lang="ts" module>
  import type { DateFormat, PropertyColor, PropertyConfig, PropertyOption } from '$shared/propertySchema'
  import type { PropertyType } from '$shared/propertyTypes'

  export interface PropertyEditorProps {
    name: string
    type: PropertyType
    config: PropertyConfig
    options: PropertyOption[]
    /** Returns false when the name was refused, so the field can put the old one back. */
    onRename: (next: string) => boolean
    onChangeType: (next: PropertyType) => void
    onSetDateFormat: (next: DateFormat) => void
    onAddOption: (name: string) => void
    onRenameOption: (from: string, to: string) => void
    onRecolorOption: (name: string, color: PropertyColor) => void
    onDeleteOption: (name: string) => void
    onToggleHidden: () => void
    onDuplicate: () => void
    onDelete: () => void
    onMove: (by: -1 | 1) => void
    canMoveUp: boolean
    canMoveDown: boolean
  }
</script>

<script lang="ts">
  import ArrowDown from '@lucide/svelte/icons/arrow-down'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import ArrowUp from '@lucide/svelte/icons/arrow-up'
  import Check from '@lucide/svelte/icons/check'
  import Copy from '@lucide/svelte/icons/copy'
  import Eye from '@lucide/svelte/icons/eye'
  import EyeOff from '@lucide/svelte/icons/eye-off'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import {
    DATE_FORMAT_OPTIONS,
    PROPERTY_COLORS,
    colorOf,
    hasOptions,
  } from '$shared/propertySchema'
  import { PROPERTY_TYPE_OPTIONS } from '$shared/propertyTypes'
  import { Input } from '@/components/ui/input'
  import Chip from './Chip.svelte'
  import CommitInput from './CommitInput.svelte'
  import MenuItem from './MenuItem.svelte'
  import MenuLabel from './MenuLabel.svelte'
  import MenuSeparator from './MenuSeparator.svelte'
  import Swatch from './Swatch.svelte'
  import { TYPE_ICON, TYPE_LABEL } from './propertyChrome'

  /**
   * "Edit property" — everything about a property that is not its value.
   *
   * The panel used to offer none of this: a type it inferred and would not let
   * you correct, a name you could not change without editing YAML by hand, and a
   * delete button that only existed while the pointer was over the row. All three
   * are the same gesture now — click the property's name — because they are the
   * same question: *what is this property?*
   *
   * It is one popover with a stack of views rather than nested menus. A nested
   * menu that holds a text input fights it for the arrow keys, and every screen
   * here except the first one holds an input.
   */
  let props: PropertyEditorProps = $props()

  type View = { at: 'main' } | { at: 'type' } | { at: 'format' } | { at: 'option'; name: string }

  let view = $state<View>({ at: 'main' })

  const TypeIcon = $derived(TYPE_ICON[props.type])
  const dateFormatLabel = $derived(
    DATE_FORMAT_OPTIONS.find(item => item.value === (props.config.dateFormat ?? 'long'))?.label,
  )

  const editedOption = $derived(view.at === 'option' ? view.name : '')
  const optionColor = $derived(
    props.options.find(item => item.name === editedOption)?.color ??
      colorOf({ options: props.options }, editedOption),
  )

  /** The always-available "add another choice" row under the options list. */
  let newOption = $state('')
</script>

{#snippet screen(title: string, body: import('svelte').Snippet)}
  <div class="flex flex-col">
    <div class="flex items-center gap-1 px-1 pb-1">
      <button
        type="button"
        onclick={() => (view = { at: 'main' })}
        aria-label="Back"
        class="rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
        style="color: var(--text-muted)"
      >
        <ArrowLeft size={14} strokeWidth={2} />
      </button>
      <span class="text-[12px] font-medium">{title}</span>
    </div>
    <MenuSeparator />
    {@render body()}
  </div>
{/snippet}

{#if view.at === 'type'}
  {#snippet typeList()}
    {#each PROPERTY_TYPE_OPTIONS as option (option.value)}
      {@const Icon = TYPE_ICON[option.value]}
      <MenuItem
        onclick={() => {
          props.onChangeType(option.value)
          view = { at: 'main' }
        }}
      >
        {#snippet icon()}<Icon size={14} strokeWidth={2} />{/snippet}
        {#snippet label()}{TYPE_LABEL[option.value]}{/snippet}
        {#snippet detail()}
          {#if option.value === props.type}<Check size={14} strokeWidth={2} />{/if}
        {/snippet}
      </MenuItem>
    {/each}
  {/snippet}
  {@render screen('Property type', typeList)}
{:else if view.at === 'format'}
  {#snippet formatList()}
    {#each DATE_FORMAT_OPTIONS as option (option.value)}
      <MenuItem
        onclick={() => {
          props.onSetDateFormat(option.value)
          view = { at: 'main' }
        }}
      >
        {#snippet label()}{option.label}{/snippet}
        {#snippet detail()}
          {#if (props.config.dateFormat ?? 'long') === option.value}
            <Check size={14} strokeWidth={2} />
          {/if}
        {/snippet}
      </MenuItem>
    {/each}
  {/snippet}
  {@render screen('Date format', formatList)}
{:else if view.at === 'option'}
  {#snippet optionScreen()}
    <div class="px-1 pb-1">
      <CommitInput
        value={editedOption}
        autofocus
        onCommit={next => {
          if (next === editedOption) return true
          props.onRenameOption(editedOption, next)
          view = { at: 'option', name: next }
          return true
        }}
      />
    </div>
    <MenuItem
      danger
      onclick={() => {
        props.onDeleteOption(editedOption)
        view = { at: 'main' }
      }}
    >
      {#snippet icon()}<Trash2 size={14} strokeWidth={2} />{/snippet}
      {#snippet label()}Delete{/snippet}
    </MenuItem>
    <MenuSeparator />
    <MenuLabel>Colours</MenuLabel>
    <div class="max-h-64 overflow-y-auto">
      {#each PROPERTY_COLORS as swatch (swatch)}
        <MenuItem onclick={() => props.onRecolorOption(editedOption, swatch)}>
          {#snippet icon()}<Swatch color={swatch} />{/snippet}
          {#snippet label()}{swatch.charAt(0).toUpperCase() + swatch.slice(1)}{/snippet}
          {#snippet detail()}
            {#if swatch === optionColor}<Check size={14} strokeWidth={2} />{/if}
          {/snippet}
        </MenuItem>
      {/each}
    </div>
  {/snippet}
  {@render screen('Edit option', optionScreen)}
{:else}
  <div class="flex flex-col">
    <!--
      The property's name, editable in place. Committed on Enter and on blur, and
      reverted when the rename is refused — a name that stays on screen after
      being rejected is a lie about what the file now says.
    -->
    <div class="flex items-center gap-1.5 px-1 pt-1 pb-1.5">
      <span
        class="flex size-7 shrink-0 items-center justify-center rounded"
        style="background: var(--bg-hover); color: var(--text-muted)"
        aria-hidden="true"
      >
        <TypeIcon size={14} strokeWidth={2} />
      </span>
      {#key props.name}
        <CommitInput value={props.name} onCommit={props.onRename} autofocus />
      {/key}
    </div>

    <MenuItem chevron onclick={() => (view = { at: 'type' })}>
      {#snippet icon()}<TypeIcon size={14} strokeWidth={2} />{/snippet}
      {#snippet label()}Type{/snippet}
      {#snippet detail()}{TYPE_LABEL[props.type]}{/snippet}
    </MenuItem>

    {#if props.type === 'date'}
      <MenuItem chevron onclick={() => (view = { at: 'format' })}>
        {#snippet label()}Date format{/snippet}
        {#snippet detail()}{dateFormatLabel}{/snippet}
      </MenuItem>
    {/if}

    {#if hasOptions(props.type)}
      <MenuSeparator />
      <MenuLabel>Options</MenuLabel>
      <div class="max-h-56 overflow-y-auto">
        {#each props.options as option (option.name)}
          <MenuItem chevron onclick={() => (view = { at: 'option', name: option.name })}>
            {#snippet label()}<Chip name={option.name} color={option.color} />{/snippet}
          </MenuItem>
        {/each}
      </div>
      <div class="px-1 pt-1">
        <Input
          bind:value={newOption}
          onkeydown={event => {
            event.stopPropagation()
            if (event.key !== 'Enter') return
            const name = newOption.trim()
            if (name === '') return
            props.onAddOption(name)
            newOption = ''
          }}
          placeholder="Add an option…"
          class="h-7 text-[12px]"
        />
      </div>
    {/if}

    <MenuSeparator />
    <MenuItem onclick={props.onToggleHidden}>
      {#snippet icon()}
        {#if props.config.hidden}<EyeOff size={14} strokeWidth={2} />
        {:else}<Eye size={14} strokeWidth={2} />{/if}
      {/snippet}
      {#snippet label()}{props.config.hidden ? 'Show in panel' : 'Hide in panel'}{/snippet}
    </MenuItem>
    {#if props.canMoveUp}
      <MenuItem onclick={() => props.onMove(-1)}>
        {#snippet icon()}<ArrowUp size={14} strokeWidth={2} />{/snippet}
        {#snippet label()}Move up{/snippet}
      </MenuItem>
    {/if}
    {#if props.canMoveDown}
      <MenuItem onclick={() => props.onMove(1)}>
        {#snippet icon()}<ArrowDown size={14} strokeWidth={2} />{/snippet}
        {#snippet label()}Move down{/snippet}
      </MenuItem>
    {/if}
    <MenuItem onclick={props.onDuplicate}>
      {#snippet icon()}<Copy size={14} strokeWidth={2} />{/snippet}
      {#snippet label()}Duplicate property{/snippet}
    </MenuItem>
    <MenuItem danger onclick={props.onDelete}>
      {#snippet icon()}<Trash2 size={14} strokeWidth={2} />{/snippet}
      {#snippet label()}Delete property{/snippet}
    </MenuItem>
  </div>
{/if}
