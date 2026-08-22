<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import { readProperties, type PropertyEntry } from '$shared/frontmatter'
  import { SUGGESTED_PROPERTIES, configFor, orderEntries } from '$shared/propertySchema'
  import { createProperty, reorderProperties } from '@/properties'
  import { getState } from '@/store.svelte'
  import PropertyRow from './PropertyRow.svelte'
  import RealPropertyRow from './RealPropertyRow.svelte'
  import DraftPropertyRow, { type Draft } from './DraftPropertyRow.svelte'
  import AddProperty from './AddProperty.svelte'
  import { humanize } from './propertyChrome'

  /**
   * The properties panel.
   *
   * The old one could do two things: set a value, and delete a property. Every
   * other question a person has about a property — what type is it, why is it
   * showing the wrong editor, what are the choices, what colour is "done", can I
   * rename it, can I move it — had no answer anywhere in the app, and the answer
   * to several of them was "edit the YAML by hand".
   *
   * So the panel now has exactly three targets, and between them they cover all
   * of it:
   *
   * - **the value** — click it and edit it, in the instrument the type deserves;
   * - **the name** — click it and the editor opens: rename, type, options and
   *   their colours, date format, order, duplicate, delete;
   * - **Add property** — one searchable list of the properties you already use
   *   and the types you can create, instead of a three-field form.
   *
   * What the file holds and what the app remembers stay separate throughout. The
   * values are frontmatter and nothing else; the types, options, colours and
   * order live in the property schema, keyed by name — see
   * `shared/propertySchema.ts` for why that split is worth the sidecar.
   */
  let { path, content }: { path: string; content: string } = $props()

  const schema = $derived(getState().propertySchema)

  let draft = $state<Draft | null>(null)
  let showHidden = $state(false)
  let drag = $state<{ key: string; over: string | null } | null>(null)
  let armed = $state(false)

  const ordered = $derived(orderEntries(schema, readProperties(content)))
  const shown = $derived(ordered.filter(entry => !configFor(schema, entry.key).hidden))
  const hidden = $derived(ordered.filter(entry => configFor(schema, entry.key).hidden))

  const present = $derived(new Set(ordered.map(entry => entry.key.toLowerCase())))
  const suggestions = $derived(
    SUGGESTED_PROPERTIES.filter(item => !present.has(item.key) && item.key !== draft?.key),
  )

  /** Moving a row records the order of *every* property, hidden ones included. */
  function moveTo(key: string, to: number) {
    const keys = ordered.map(entry => entry.key)
    const from = keys.indexOf(key)
    if (from === -1 || to < 0 || to >= keys.length || to === from) return
    keys.splice(to, 0, ...keys.splice(from, 1))
    reorderProperties(keys)
  }

  function drop() {
    if (drag?.over) moveTo(drag.key, ordered.findIndex(entry => entry.key === drag!.over))
    drag = null
    armed = false
  }
</script>

{#snippet row(entry: PropertyEntry)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    draggable={armed}
    ondragstart={() => (drag = { key: entry.key, over: null })}
    ondragend={() => {
      drag = null
      armed = false
    }}
    ondragover={event => {
      if (!drag) return
      event.preventDefault()
      if (drag.over !== entry.key) drag = { ...drag, over: entry.key }
    }}
    ondrop={event => {
      event.preventDefault()
      drop()
    }}
  >
    <RealPropertyRow
      {path}
      {entry}
      {schema}
      onArmDrag={next => (armed = next)}
      dragging={drag?.key === entry.key}
      draggedOver={drag !== null && drag.over === entry.key && drag.key !== entry.key}
      index={ordered.indexOf(entry)}
      count={ordered.length}
      onMove={moveTo}
    />
  </div>
{/snippet}

<div class="flex flex-col gap-0.5 px-4 pb-4">
  {#each shown as entry (entry.key)}
    {@render row(entry)}
  {/each}

  {#if draft}
    <DraftPropertyRow
      {path}
      {draft}
      {schema}
      onChange={next => (draft = next)}
      onDone={() => (draft = null)}
    />
  {/if}

  {#each suggestions as item (item.key)}
    <button
      type="button"
      onclick={() => {
        createProperty(item.key, item.type)
        draft = item
      }}
      class="rounded text-left"
    >
      <PropertyRow type={item.type} label={humanize(item.key)} muted>
        <span class="block pt-[3px] pl-0.5 text-[12px]" style="color: var(--text-faint)">—</span>
      </PropertyRow>
    </button>
  {/each}

  {#if hidden.length > 0}
    <button
      type="button"
      onclick={() => (showHidden = !showHidden)}
      class="mt-1 flex items-center gap-1 rounded px-0.5 py-1 text-[12px] transition-colors hover:bg-[var(--bg-hover)]"
      style="color: var(--text-faint)"
    >
      {#if showHidden}<ChevronDown size={14} strokeWidth={2} />
      {:else}<ChevronRight size={14} strokeWidth={2} />{/if}
      {hidden.length} hidden {hidden.length === 1 ? 'property' : 'properties'}
    </button>
    {#if showHidden}
      {#each hidden as entry (entry.key)}
        {@render row(entry)}
      {/each}
    {/if}
  {/if}

  <AddProperty
    {schema}
    {present}
    onPick={(key, type) => {
      if (!createProperty(key, type)) return
      draft = { key, type }
    }}
  />
</div>
