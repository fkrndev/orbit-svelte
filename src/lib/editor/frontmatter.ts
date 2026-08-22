/**
 * Frontmatter is passed through untouched.
 *
 * The rich editor only ever owns the body; the YAML block is sliced off before
 * parsing and re-attached verbatim on serialize. That means the editor can
 * never reformat, reorder, or drop a key it does not understand — which is
 * exactly what you want from a tool that opens files it did not create.
 *
 * The splitting itself moved to `src/shared/frontmatter.ts` once the properties
 * panel needed to read the same block. Re-exported here so the editor's callers
 * are unaffected by where it lives.
 */

export { splitFrontmatter, extractEditorBody, type FrontmatterSplit } from '$shared/frontmatter'

export function blankParagraphBlocks(): unknown[] {
  return [{ type: 'paragraph', content: [], children: [] }]
}
