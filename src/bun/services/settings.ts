import type { AppSettings } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'
import { JsonStore, registerStore } from './jsonStore'
import { STORE_FILES } from '../paths'

const store = registerStore(
  new JsonStore<AppSettings>(STORE_FILES.settings, () => ({ ...DEFAULT_SETTINGS })),
)

export function getSettings(): AppSettings {
  // Spread over defaults so a settings file written by an older build is
  // missing keys rather than broken.
  return { ...DEFAULT_SETTINGS, ...store.get() }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  store.update(draft => {
    Object.assign(draft, patch)
  })
  return getSettings()
}
