import { describe, expect, it } from 'vitest'
import { isCodeName, isMarkdownName, isOpenableName } from '../rename'

/**
 * The one distinction the whole of code support rests on.
 *
 * *Openable* decides what the tree, quick-open, and the watcher can see.
 * *Markdown* decides what the rich editor, the outline, the todo scan, and the
 * tag index are allowed to touch. If the second ever widened to match the
 * first, a `.tsx` file would be parsed as prose and written back as markdown on
 * the next autosave — so the two are asserted here as separate answers rather
 * than as one list with two names.
 */
describe('isOpenableName', () => {
  it('accepts markdown, as it always did', () => {
    for (const name of ['plan.md', 'post.mdx', 'RELEASE.markdown']) {
      expect(isOpenableName(name)).toBe(true)
      expect(isMarkdownName(name)).toBe(true)
    }
  })

  it('accepts code without calling it markdown', () => {
    for (const name of ['App.tsx', 'main.go', 'setup.py', 'package.json', 'style.css']) {
      expect(isOpenableName(name)).toBe(true)
      expect(isCodeName(name)).toBe(true)
      // The half that matters: nothing here may reach the rich editor.
      expect(isMarkdownName(name)).toBe(false)
    }
  })

  it('refuses what it cannot render as text', () => {
    for (const name of ['logo.png', 'report.pdf', 'archive.zip', 'app.dmg']) {
      expect(isOpenableName(name)).toBe(false)
    }
  })

  it('ignores case, because filesystems do not agree about it', () => {
    expect(isOpenableName('MAIN.PY')).toBe(true)
    expect(isOpenableName('Makefile.TS')).toBe(true)
  })

  it('treats a leading dot as no extension, like every walk in the app', () => {
    // Dotfiles are skipped before the question is ever asked; answering "yes"
    // here would be a claim the tree cannot honour.
    expect(isOpenableName('.env')).toBe(false)
    expect(isOpenableName('.gitignore')).toBe(false)
    // A name that merely *starts* with one is still a normal file.
    expect(isOpenableName('.config/local.env')).toBe(true)
  })

  it('says no to a name with no extension at all', () => {
    expect(isOpenableName('Makefile')).toBe(false)
    expect(isOpenableName('README')).toBe(false)
  })
})
