import type { AppSettings } from '$shared/types'
import { api } from './rpcClient'
import { setState } from './store.svelte'

export type ThemePreference = AppSettings['theme']
export type ResolvedTheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function systemTheme(): ResolvedTheme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference
}

/**
 * Applies the preference to the document.
 *
 * "system" *removes* the attribute rather than setting it empty: the CSS guards
 * on `:root:not([data-theme='light'])`, and an empty attribute would still be
 * an attribute — harmless today, but a trap for the next selector someone adds.
 */
export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preference)
}

/**
 * The concrete theme, kept in sync with the OS while the preference is
 * "system".
 *
 * Components that need a real value — the rich editor takes `light`/`dark`, not
 * `system` — should read this rather than resolving once at mount, or they will
 * keep a stale theme when macOS flips at sunset.
 *
 * A single module-level listener rather than one per caller: the media query is
 * the same for everybody, and the React build's per-hook subscription was an
 * artefact of where the state had to live, not a requirement.
 */
let resolved = $state<ResolvedTheme>('light')
let preference: ThemePreference = 'system'
let media: MediaQueryList | null = null

function onSystemChange() {
  if (preference === 'system') resolved = systemTheme()
}

/**
 * Starts tracking. Called once from the shell; safe to call again when the
 * preference changes, which is what keeps `resolved` honest after a switch away
 * from "system" and back.
 */
export function trackResolvedTheme(next: ThemePreference) {
  preference = next
  resolved = resolveTheme(next)

  if (!media) {
    media = window.matchMedia?.(DARK_QUERY) ?? null
    media?.addEventListener('change', onSystemChange)
  }
}

/** The concrete theme on screen right now. Reactive — read it inside `$derived`. */
export function resolvedTheme(): ResolvedTheme {
  return resolved
}

export const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark']

export function nextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_ORDER.indexOf(current)
  return THEME_ORDER[(index + 1) % THEME_ORDER.length]!
}

export function setThemePreference(next: ThemePreference) {
  setState(prev => ({ settings: { ...prev.settings, theme: next } }))
  applyTheme(next)
  trackResolvedTheme(next)
  void api.saveSettings({ patch: { theme: next } })
}
