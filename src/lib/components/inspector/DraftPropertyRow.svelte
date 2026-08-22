<script lang="ts" module>
  import type { PropertyType } from '$shared/propertyTypes'

  /** A property the user has added but not yet given a value, so it is not in the file. */
  export interface Draft {
    key: string
    type: PropertyType
  }
</script>

<script lang="ts">
  import type { PropertyEntry } from '$shared/frontmatter'
  import { configFor, optionsFor, type PropertySchema } from '$shared/propertySchema'
  import {
    addPropertyOption,
    createProperty,
    deletePropertyOption,
    patchPropertyConfig,
    recolorPropertyOption,
    renamePropertyOption,
    selectPropertyValue,
    setPropertyHidden,
  } from '@/properties'
  import PropertyRow from './PropertyRow.svelte'
  import PropertyValue from './PropertyValue.svelte'
  import PropertyEditor from './PropertyEditor.svelte'
  import { humanize } from './propertyChrome'

  /**
   * A property that exists in the panel but not yet in the file.
   *
   * Adding one writes nothing: an empty `owner: ''` left behind by someone who
   * changed their mind is litter in a document the app did not create. The name
   * and type are remembered in the schema straight away, so the property is
   * offered again next time even if this file never gets a value for it.
   */
  let {
    path,
    draft,
    schema,
    onChange,
    onDone,
  }: {
    path: string
    draft: Draft
    schema: PropertySchema
    onChange: (draft: Draft) => void
    onDone: () => void
  } = $props()

  const config = $derived(configFor(schema, draft.key))
  const options = $derived(optionsFor(config))

  const emptyEntry = $derived<PropertyEntry>({
    key: draft.key,
    shape: 'scalar',
    value: '',
    items: [],
    line: 0,
    span: 1,
  })
</script>

<PropertyRow type={draft.type} label={humanize(draft.key)} editor={editorPanel}>
  <PropertyValue
    entry={emptyEntry}
    type={draft.type}
    {options}
    dateFormat={config.dateFormat}
    onChange={value => {
      // An empty value means the user changed their mind, and the file should
      // look exactly as it did before they clicked.
      const empty = Array.isArray(value) ? value.length === 0 : value.trim() === ''
      if (!empty) selectPropertyValue(path, draft.key, draft.type, value)
      onDone()
    }}
  />
</PropertyRow>

{#snippet editorPanel(close: () => void)}
  <PropertyEditor
    name={draft.key}
    type={draft.type}
    {config}
    {options}
    canMoveUp={false}
    canMoveDown={false}
    onRename={next => {
      if (!createProperty(next, draft.type)) return false
      onChange({ ...draft, key: next })
      return true
    }}
    onChangeType={next => {
      createProperty(draft.key, next)
      onChange({ ...draft, type: next })
    }}
    onSetDateFormat={next => patchPropertyConfig(draft.key, { dateFormat: next })}
    onAddOption={name => addPropertyOption(draft.key, name)}
    onRenameOption={(from, to) => renamePropertyOption(path, draft.key, draft.type, from, to)}
    onRecolorOption={(name, color) => recolorPropertyOption(draft.key, name, color)}
    onDeleteOption={name => deletePropertyOption(path, draft.key, draft.type, name)}
    onToggleHidden={() => setPropertyHidden(draft.key, !config.hidden)}
    onMove={() => undefined}
    onDuplicate={close}
    onDelete={() => {
      onDone()
      close()
    }}
  />
{/snippet}
