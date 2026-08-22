import { DEFAULT_SETTINGS, type AppSettings } from '$shared/types'

/**
 * The resizable panes, and the arithmetic behind dragging one.
 *
 * Widths live in settings, but a drag does **not** write to the store on every
 * pointer move: it writes a CSS variable straight to the document and commits
 * to settings once, on release. A store write per frame would re-render the
 * file tree on every pixel of a sidebar drag, and the one thing a resize handle
 * must be is smooth.
 */

export type PaneKey =
  | 'sidebarWidth'
  | 'inspectorWidth'
  | 'editorWidth'
  | 'browseColumnWidth'

interface PaneSpec {
  cssVar: string
  /** Narrow enough to be useful, never so narrow the pane becomes unreadable. */
  min: number
  max: number
  /**
   * Pixels of width gained per pixel of pointer travel.
   *
   * `2` for the editor measure, which is centred: its right edge moves half as
   * fast as the column grows, so a handle that tracked the pointer 1:1 would
   * drift out from under the cursor as you dragged.
   */
  gain: 1 | 2
}

export const PANES: Record<PaneKey, PaneSpec> = {
  sidebarWidth: { cssVar: '--sidebar-width', min: 180, max: 520, gain: 1 },
  // The floor is set by the tab strip inside it, not by the panel's content:
  // three labelled tabs across the top need more room than a list of headings.
  inspectorWidth: { cssVar: '--inspector-width', min: 240, max: 560, gain: 1 },
  editorWidth: { cssVar: '--editor-measure', min: 480, max: 1200, gain: 2 },
  // Narrower than a sidebar on purpose: several of these sit side by side, and
  // the floor is "a filename is still readable" rather than "the pane is still
  // usable on its own".
  browseColumnWidth: { cssVar: '--browse-column-width', min: 150, max: 460, gain: 1 },
}

/**
 * Also the guard against a width that is not a number.
 *
 * A settings file written by an older build has no entry for a pane added
 * since, and arithmetic on the resulting `undefined` yields `NaN` — which CSS
 * discards, collapsing the pane to nothing. Falling back to the default turns
 * that into a layout the user recognises instead of one that vanished.
 */
export function clampPane(pane: PaneKey, px: number): number {
  const spec = PANES[pane]
  const width = Number.isFinite(px) ? px : DEFAULT_SETTINGS[pane]
  return Math.round(Math.min(spec.max, Math.max(spec.min, width)))
}

/**
 * Where a drag lands.
 *
 * `direction` is +1 when dragging right widens the pane (a left-hand panel, or
 * the editor measure) and -1 when it narrows it (a right-hand panel), so the
 * edge always follows the pointer rather than the pane's own idea of growth.
 */
export function resizedTo(
  pane: PaneKey,
  startWidth: number,
  deltaX: number,
  direction: 1 | -1,
): number {
  return clampPane(pane, startWidth + deltaX * direction * PANES[pane].gain)
}

export function writePaneVar(pane: PaneKey, px: number) {
  document.documentElement.style.setProperty(PANES[pane].cssVar, `${px}px`)
}

export function applyPaneVars(settings: AppSettings) {
  for (const pane of Object.keys(PANES) as PaneKey[]) {
    writePaneVar(pane, clampPane(pane, settings[pane]))
  }
}
