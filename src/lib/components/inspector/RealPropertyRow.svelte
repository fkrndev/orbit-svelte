<script lang="ts">
  import type { PropertyEntry } from '$shared/frontmatter'
  import { configFor, optionsFor, resolveType, type PropertySchema } from '$shared/propertySchema'
  import {
    addPropertyOption,
    changePropertyType,
    deleteProperty,
    deletePropertyOption,
    duplicateProperty,
    patchPropertyConfig,
    recolorPropertyOption,
    renamePropertyOption,
    renamePropertyTo,
    selectPropertyValue,
    setPropertyHidden,
  } from '@/properties'
  import PropertyRow from './PropertyRow.svelte'
  import PropertyValue from './PropertyValue.svelte'
  import PropertyEditor from './PropertyEditor.svelte'
  import { humanize } from './propertyChrome'

  let {
    path,
    entry,
    schema,
    index,
    count,
    onMove,
    onArmDrag,
    dragging,
    draggedOver,
  }: {
    path: string
    entry: PropertyEntry
    schema: PropertySchema
    index: number
    count: number
    onMove: (key: string, to: number) => void
    onArmDrag: (armed: boolean) => void
    dragging: boolean
    draggedOver: boolean
  } = $props()

  const type = $derived(resolveType(schema, entry))
  const config = $derived(configFor(schema, entry.key))
  const used = $derived(entry.shape === 'list' ? entry.items : entry.value ? [entry.value] : [])
  const options = $derived(optionsFor(config, used))
</script>

<PropertyRow
  {type}
  label={humanize(entry.key)}
  {onArmDrag}
  {dragging}
  {draggedOver}
  editor={editorPanel}
>
  <PropertyValue
    {entry}
    {type}
    {options}
    dateFormat={config.dateFormat}
    onChange={value => selectPropertyValue(path, entry.key, type, value)}
  />
</PropertyRow>

{#snippet editorPanel(close: () => void)}
  <PropertyEditor
    name={entry.key}
    {type}
    {config}
    {options}
    canMoveUp={index > 0}
    canMoveDown={index < count - 1}
    onRename={next => renamePropertyTo(path, entry.key, next)}
    onChangeType={next => changePropertyType(path, entry, next)}
    onSetDateFormat={next => patchPropertyConfig(entry.key, { dateFormat: next })}
    onAddOption={name => addPropertyOption(entry.key, name)}
    onRenameOption={(from, to) => renamePropertyOption(path, entry.key, type, from, to)}
    onRecolorOption={(name, color) => recolorPropertyOption(entry.key, name, color)}
    onDeleteOption={name => deletePropertyOption(path, entry.key, type, name)}
    onToggleHidden={() => {
      setPropertyHidden(entry.key, !config.hidden)
      close()
    }}
    onMove={by => {
      onMove(entry.key, index + by)
      close()
    }}
    onDuplicate={() => {
      duplicateProperty(path, entry)
      close()
    }}
    onDelete={() => {
      deleteProperty(path, entry.key)
      close()
    }}
  />
{/snippet}
