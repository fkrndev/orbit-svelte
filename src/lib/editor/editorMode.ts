import { isMarkdownName } from '$shared/rename'

/**
 * Which of the two editors a file gets.
 *
 * `settings.editorMode` is a preference about *prose* — rich text or its
 * markdown source — and it is global, because switching to source is a way of
 * working rather than a property of one note. A code file has no such choice:
 * the rich editor's document model is markdown, so opening `App.tsx` in it would
 * parse TypeScript as prose and write markdown back over the file on the next
 * autosave. That is not a degraded view, it is data loss.
 *
 * So the answer is forced here rather than at each editor: one place decides,
 * and the toolbar, the menu command, and the surface all read the same one.
 * The setting itself is left untouched, so going back to a note returns you to
 * the view you had chosen.
 */
export function editorModeFor(path: string, setting: 'rich' | 'raw'): 'rich' | 'raw' {
  return isMarkdownName(path) ? setting : 'raw'
}
