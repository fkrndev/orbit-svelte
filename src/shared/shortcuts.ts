/**
 * Every keyboard shortcut the app advertises, in one list.
 *
 * These strings used to be written out at each tooltip. That is fine right up
 * until a binding changes and one of the eleven copies is missed — and a
 * shortcut list that lies is worse than no list, because the reader has no way
 * to tell which entry is the stale one.
 *
 * This is the display layer only: it names bindings, it does not install them.
 * The handlers live with the thing they act on (the native menu, `App.tsx`,
 * BlockNote), and this file is what the tooltips and the settings page read so
 * they cannot disagree with each other.
 */

export type ShortcutId =
  | 'quickOpen'
  | 'openByPath'
  | 'newFile'
  | 'save'
  | 'toggleSidebar'
  | 'showInfo'
  | 'showOutline'
  | 'markdownSource'
  | 'readOnly'
  | 'pinToDashboard'
  | 'rename'
  | 'back'
  | 'forward'
  | 'home'

export type ShortcutGroup = 'Files' | 'Navigation' | 'View'

export interface Shortcut {
  id: ShortcutId
  /** Written the way a macOS menu writes it, because that is where it also appears. */
  keys: string
  label: string
  group: ShortcutGroup
}

export const SHORTCUTS: Shortcut[] = [
  { id: 'newFile', keys: '⌘N', label: 'New file', group: 'Files' },
  { id: 'save', keys: '⌘S', label: 'Save', group: 'Files' },
  { id: 'rename', keys: '⇧⌘R', label: 'Rename…', group: 'Files' },
  { id: 'pinToDashboard', keys: '⌘D', label: 'Pin to dashboard', group: 'Files' },

  { id: 'quickOpen', keys: '⌘P', label: 'Search all folders', group: 'Navigation' },
  { id: 'openByPath', keys: '⇧⌘P', label: 'Open by path…', group: 'Navigation' },
  { id: 'back', keys: '⌘[', label: 'Back', group: 'Navigation' },
  { id: 'forward', keys: '⌘]', label: 'Forward', group: 'Navigation' },
  { id: 'home', keys: '⌘0', label: 'Home', group: 'Navigation' },

  { id: 'toggleSidebar', keys: '⌘B', label: 'Toggle sidebar', group: 'View' },
  // Both open the one pane on the right, on the view they name — and close it
  // again when that view is already showing.
  { id: 'showInfo', keys: '⌘I', label: 'Info panel', group: 'View' },
  { id: 'showOutline', keys: '⇧⌘T', label: 'Outline', group: 'View' },
  { id: 'markdownSource', keys: '⌘/', label: 'Markdown source', group: 'View' },
  // Filed under View because it is a mode you are in, like the source toggle
  // beside it — even though what it changes is what the app is allowed to do.
  { id: 'readOnly', keys: '⇧⌘L', label: 'Read-only mode', group: 'View' },
]

const BY_ID = new Map(SHORTCUTS.map(shortcut => [shortcut.id, shortcut]))

/** The keys alone, for a tooltip's `shortcut` slot. */
export function keysFor(id: ShortcutId): string {
  const shortcut = BY_ID.get(id)
  if (!shortcut) throw new Error(`Unknown shortcut: ${id}`)
  return shortcut.keys
}

/**
 * "Toggle sidebar (⌘B)" — for the controls that put their whole hint in a
 * `title`/`aria-label` rather than in a tooltip with a separate key slot.
 */
export function labelWithKeys(id: ShortcutId, label = BY_ID.get(id)?.label ?? ''): string {
  return `${label} (${keysFor(id)})`
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = ['Files', 'Navigation', 'View']
