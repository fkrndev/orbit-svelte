import { describe, expect, it } from 'vitest'
import { editorModeFor } from '../editor/editorMode'

/**
 * The guard that keeps the rich editor away from source.
 *
 * The rich editor's document model is markdown: it parses what it is given and
 * writes markdown back on the next autosave. Pointed at `App.tsx` that is not a
 * bad rendering, it is a file rewritten into something that no longer compiles.
 * So the mode is forced here, in one place all three callers read — the
 * surface, the toolbar button, and the ⌘/ menu command.
 */
describe('editorModeFor', () => {
  it('honours the setting for markdown', () => {
    expect(editorModeFor('/notes/plan.md', 'rich')).toBe('rich')
    expect(editorModeFor('/notes/plan.md', 'raw')).toBe('raw')
  })

  it('forces source for code, whatever the setting says', () => {
    for (const path of ['/app/App.tsx', '/app/main.go', '/app/package.json']) {
      expect(editorModeFor(path, 'rich')).toBe('raw')
      expect(editorModeFor(path, 'raw')).toBe('raw')
    }
  })

  it('leaves the setting itself alone', () => {
    // Nothing is written anywhere — going back to a note has to return you to
    // the view you had chosen, not to whatever the last code file forced.
    const setting = 'rich' as const
    editorModeFor('/app/App.tsx', setting)
    expect(editorModeFor('/notes/plan.md', setting)).toBe('rich')
  })
})
