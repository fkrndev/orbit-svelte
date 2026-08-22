<script lang="ts">
  import type { PropertyEntry } from '$shared/frontmatter'
  import type { DateFormat, PropertyOption } from '$shared/propertySchema'
  import type { PropertyType } from '$shared/propertyTypes'
  import { Switch } from '@/components/ui/switch'
  import ChoiceValue from './ChoiceValue.svelte'
  import DateValue from './DateValue.svelte'
  import ScalarValue from './ScalarValue.svelte'

  /**
   * The value cell.
   *
   * `type` decides the instrument; the entry only supplies what is written down.
   * A property whose YAML we refuse to rewrite says so rather than offering an
   * editor that would quietly do nothing.
   */
  let {
    entry,
    type,
    options,
    dateFormat,
    onChange,
  }: {
    entry: PropertyEntry
    type: PropertyType
    options: PropertyOption[]
    dateFormat?: DateFormat
    onChange: (value: string | string[]) => void
  } = $props()

  const choiceValues = $derived(
    entry.shape === 'list' ? entry.items : entry.value ? [entry.value] : [],
  )

  /**
   * A checkbox, drawn as a switch.
   *
   * It used to be a pair of Yes/No buttons, which meant the *off* state and the
   * *unset* state looked identical — both showed two buttons with one of them
   * highlighted, and neither told you which the file actually said.
   */
  const on = $derived(['true', 'yes', 'on', '1'].includes(entry.value.trim().toLowerCase()))
</script>

{#if entry.shape === 'unsupported'}
  <span
    class="block pt-[3px] text-[12px] italic"
    style="color: var(--text-faint)"
    title="Nested and multi-line values are edited in the markdown source (⌘/)"
  >
    edit in source
  </span>
{:else if type === 'tags' || type === 'status'}
  <ChoiceValue
    values={choiceValues}
    {options}
    multiple={type === 'tags'}
    onChange={next => onChange(type === 'tags' ? next : (next[0] ?? ''))}
  />
{:else if type === 'boolean'}
  <span class="flex items-center gap-2 pt-[2px]">
    <Switch
      checked={on}
      onCheckedChange={next => onChange(next ? 'true' : 'false')}
      aria-label={on ? 'On' : 'Off'}
    />
    <span class="text-[12px]" style="color: var(--text-faint)">{on ? 'Yes' : 'No'}</span>
  </span>
{:else if type === 'date'}
  <DateValue value={entry.value} format={dateFormat} onChange={onChange} />
{:else}
  <ScalarValue {entry} {type} {onChange} />
{/if}
