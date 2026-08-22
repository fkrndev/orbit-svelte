/**
 * Persistence for what the user decided about their properties.
 *
 * The rules all live in `shared/propertySchema.ts`, because the webview applies
 * them optimistically and this store applies them again on the way to disk —
 * two copies of the same rule would drift, and the drift would show up as a
 * colour that reverts a second after you pick it.
 *
 * So this module is deliberately thin: read the file, hand the pure function
 * the current schema, write back what it returns. It owns durability and
 * nothing else.
 */

import {
  EMPTY_PROPERTY_SCHEMA,
  applyConfig,
  forgetProperty,
  renameProperty,
  setOrder,
  type PropertyConfig,
  type PropertySchema,
} from '../../shared/propertySchema'
import { JsonStore, registerStore } from './jsonStore'
import { STORE_FILES } from '../paths'

const store = registerStore(
  new JsonStore<PropertySchema>(STORE_FILES.properties, () => structuredClone(EMPTY_PROPERTY_SCHEMA)),
)

/**
 * Spread over the empty schema so a file written by an older build arrives with
 * its missing halves present but empty, rather than as `undefined` that the
 * first `Object.keys` in the webview would throw on.
 */
export function getPropertySchema(): PropertySchema {
  const stored = store.get()
  return {
    version: 1,
    props: stored.props ?? {},
    order: stored.order ?? [],
  }
}

function commit(next: PropertySchema): PropertySchema {
  store.replace(next)
  return getPropertySchema()
}

export function savePropertyConfig(key: string, patch: Partial<PropertyConfig>): PropertySchema {
  return commit(applyConfig(getPropertySchema(), key, patch))
}

export function deletePropertyConfig(key: string): PropertySchema {
  return commit(forgetProperty(getPropertySchema(), key))
}

export function renamePropertyConfig(from: string, to: string): PropertySchema {
  return commit(renameProperty(getPropertySchema(), from, to))
}

export function savePropertyOrder(keys: string[]): PropertySchema {
  return commit(setOrder(getPropertySchema(), keys))
}
