/**
 * Property operations: the ones that touch the file, the schema, or both.
 *
 * They live beside `actions.ts` rather than inside it because almost every one
 * of them is a *pair* of writes — rename the key in the frontmatter and move
 * its colours across, change the type and rewrite the value to suit — and a
 * component that did only half of either would leave the panel describing a
 * file that no longer says that. Keeping the pairs in one module is what makes
 * "the schema never disagrees with the file" checkable by reading one screen.
 *
 * Schema writes follow `setSetting`'s shape: optimistic to the store, then to
 * disk unawaited. A colour that waits on a round trip before it paints reads as
 * a broken swatch, and the worst case is a forgotten preference, never a
 * damaged document.
 */

import {
  isPropertyKey,
  readProperties,
  readProperty,
  renamePropertyKey,
  writeProperty,
  type PropertyEntry,
} from '$shared/frontmatter'
import {
  addOption,
  applyConfig,
  configFor,
  convertValue,
  DEFAULT_STATUS_OPTIONS,
  hasOptions,
  propertyId,
  removeOption as dropOption,
  renameOption as relabelOption,
  renameProperty as moveConfig,
  setOptionColor,
  setOrder,
  type PropertyColor,
  type PropertyConfig,
  type PropertySchema,
} from '$shared/propertySchema'
import type { PropertyType } from '$shared/propertyTypes'
import { markEditing, removeProperty, setProperty } from './actions'
import { api } from './rpcClient'
import { getState, setState, updateTab } from './store.svelte'

// ---- schema ---------------------------------------------------------------

function schema(): PropertySchema {
  return getState().propertySchema
}

/** Show the new schema now; tell disk about it when it gets there. */
function commit(next: PropertySchema, persist: () => Promise<unknown>) {
  setState({ propertySchema: next })
  void persist().catch(() => undefined)
}

export function patchPropertyConfig(key: string, patch: Partial<PropertyConfig>) {
  commit(applyConfig(schema(), key, patch), () =>
    api.savePropertyConfig({ key: propertyId(key), patch }),
  )
}

/**
 * Persist the whole config for a key.
 *
 * Used where the pure helper already computed the result — option edits move
 * several fields at once, and re-deriving the patch from the difference would
 * be a second implementation of the same rule.
 */
function commitConfig(next: PropertySchema, key: string) {
  commit(next, () =>
    api.savePropertyConfig({ key: propertyId(key), patch: configFor(next, key) }),
  )
}

export function reorderProperties(keys: string[]) {
  const ids = keys.map(propertyId)
  commit(setOrder(schema(), ids), () => api.savePropertyOrder({ keys: ids }))
}

export function setPropertyHidden(key: string, hidden: boolean) {
  patchPropertyConfig(key, { hidden: hidden || undefined })
}

// ---- the file -------------------------------------------------------------

function contentOf(path: string): string | null {
  return getState().tabs.find(tab => tab.path === path)?.content ?? null
}

/**
 * A name no other property in this file is using.
 *
 * Duplicating `status` twice gives `status 2` then `status 3`, which is what a
 * person would have typed — and never a silent overwrite of the original.
 */
function uniqueKey(content: string, base: string): string {
  const taken = new Set(readProperties(content).map(entry => entry.key.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base} ${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${base} ${Date.now()}`
}

/**
 * Add a property to the panel.
 *
 * The schema learns the name immediately — that is what makes it a suggestion
 * next time — but the *file* is left alone until there is a value to put in it.
 * An empty `owner: ''` written on the way to the picker is litter in a document
 * the user may never finish filling in.
 */
export function createProperty(key: string, type: PropertyType): boolean {
  const name = key.trim()
  if (!isPropertyKey(name)) return false

  let next = applyConfig(schema(), name, { type })
  // A status property with no vocabulary offers an empty picker, which looks
  // broken. Seed it once, on creation, where the user can still edit it away.
  if (type === 'status' && (configFor(next, name).options ?? []).length === 0) {
    next = applyConfig(next, name, { options: [...DEFAULT_STATUS_OPTIONS] })
  }
  commitConfig(next, name)
  return true
}

/**
 * Change what a property *is*.
 *
 * Both halves happen together: the value is rewritten so it is legible in the
 * new editor, and the type is locked so inference does not immediately guess
 * the old one back from the new value.
 */
export function changePropertyType(path: string, entry: PropertyEntry, type: PropertyType) {
  patchPropertyConfig(entry.key, { type })
  if (entry.shape === 'unsupported') return

  const converted = convertValue(entry, type)
  const empty = Array.isArray(converted) ? converted.length === 0 : converted === ''
  if (empty) removeProperty(path, entry.key)
  else setProperty(path, entry.key, converted)
}

/** Rename in the file and move the colours with it. Returns false if refused. */
export function renamePropertyTo(path: string, from: string, to: string): boolean {
  const name = to.trim()
  if (name === from) return true
  if (!isPropertyKey(name)) return false

  const content = contentOf(path)
  if (content === null) return false

  const next = renamePropertyKey(content, from, name)
  if (next === content) return false

  updateTab(path, { content: next })
  markEditing(path)
  commit(moveConfig(schema(), from, name), () =>
    api.renamePropertyConfig({ from: propertyId(from), to: propertyId(name) }),
  )
  return true
}

/** Copy a property's value and its config onto a fresh name. */
export function duplicateProperty(path: string, entry: PropertyEntry): string | null {
  const content = contentOf(path)
  if (content === null || entry.shape === 'unsupported') return null

  const key = uniqueKey(content, entry.key)
  const value = entry.shape === 'list' ? entry.items : entry.value
  const next = writeProperty(content, key, value)
  if (next === content) return null

  updateTab(path, { content: next })
  markEditing(path)
  commitConfig(applyConfig(schema(), key, configFor(schema(), entry.key)), key)
  return key
}

/**
 * Take a property out of this file.
 *
 * Its config is kept on purpose: deleting `status` from one note should not
 * throw away the five colours it has in every other one, and re-adding it a
 * moment later should look exactly as it did.
 */
export function deleteProperty(path: string, key: string) {
  removeProperty(path, key)
}

// ---- options --------------------------------------------------------------

export function addPropertyOption(key: string, name: string) {
  commitConfig(addOption(schema(), key, name), key)
}

export function recolorPropertyOption(key: string, name: string, color: PropertyColor) {
  commitConfig(setOptionColor(schema(), key, name, color), key)
}

/**
 * Rewrite an option wherever the open file uses it.
 *
 * Only the open file: other notes keep the words they were written with, which
 * is the honest outcome when the file is the record and this store is only a
 * memory of how to draw it. A stale name still renders — `optionsFor` offers
 * any value the file holds — it just loses the colour it had under the old one.
 */
function rewriteValue(
  path: string,
  key: string,
  change: (values: string[]) => string[],
  type: PropertyType,
) {
  const content = contentOf(path)
  if (content === null) return
  const entry = readProperty(content, key)
  if (!entry || entry.shape === 'unsupported') return

  const before = entry.shape === 'list' ? entry.items : entry.value === '' ? [] : [entry.value]
  const after = change(before)
  if (after.length === before.length && after.every((value, at) => value === before[at])) return

  if (type === 'tags') setProperty(path, key, after)
  else if (after.length === 0) removeProperty(path, key)
  else setProperty(path, key, after[0]!)
}

export function renamePropertyOption(
  path: string,
  key: string,
  type: PropertyType,
  from: string,
  to: string,
) {
  const name = to.trim()
  const next = relabelOption(schema(), key, from, name)
  if (next === schema()) return
  commitConfig(next, key)
  rewriteValue(path, key, values => values.map(value => (value === from ? name : value)), type)
}

export function deletePropertyOption(
  path: string,
  key: string,
  type: PropertyType,
  name: string,
) {
  commitConfig(dropOption(schema(), key, name), key)
  rewriteValue(path, key, values => values.filter(value => value !== name), type)
}

/**
 * Choose a value, remembering it as an option if it is new.
 *
 * Typing a value into the picker is how most options come to exist, so the two
 * are one action — otherwise every new status would need a second trip through
 * a settings screen to gain a colour.
 */
export function selectPropertyValue(
  path: string,
  key: string,
  type: PropertyType,
  value: string | string[],
) {
  if (hasOptions(type)) {
    const names = Array.isArray(value) ? value : [value]
    let next = schema()
    for (const name of names) {
      if (name !== '') next = addOption(next, key, name)
    }
    if (next !== schema()) commitConfig(next, key)
  }

  const empty = Array.isArray(value) ? value.length === 0 : value.trim() === ''
  if (empty) removeProperty(path, key)
  else setProperty(path, key, value)
}
