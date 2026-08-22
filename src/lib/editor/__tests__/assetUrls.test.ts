import { describe, expect, it } from 'vitest'
import {
  postProcessAssetMarkdown,
  preProcessAssetMarkdown,
  resolveAgainstNote,
} from '../assetUrls'

const NOTE = '/vault/notes/one.md'

describe('resolveAgainstNote', () => {
  it.each([
    ['assets/a.png', '/vault/notes/assets/a.png'],
    ['./assets/a.png', '/vault/notes/assets/a.png'],
    ['../shared/a.png', '/vault/shared/a.png'],
    ['../../a.png', '/a.png'],
  ])('%s → %s', (relative, expected) => {
    expect(resolveAgainstNote(NOTE, relative)).toBe(expected)
  })
})

describe('the asset URL round trip', () => {
  it('restores the exact markdown it was given', () => {
    const markdown = '![shot](assets/a.png)\n\ntext\n\n![up](../shared/b.png)\n'
    const display = preProcessAssetMarkdown(NOTE, markdown)
    // Absolute and pointed at the page's own origin — a relative `/api/file`
    // would reach nothing from a packaged build's `views://` document.
    expect(display).toContain(`${location.origin}/api/file?path=`)
    expect(postProcessAssetMarkdown(NOTE, display)).toBe(markdown)
  })

  it('leaves a remote image alone in both directions', () => {
    // Someone else's URL is not ours to rewrite, and must survive a save.
    const markdown = '![web](https://example.com/a.png)\n'
    expect(preProcessAssetMarkdown(NOTE, markdown)).toBe(markdown)
    expect(postProcessAssetMarkdown(NOTE, markdown)).toBe(markdown)
  })

  it('leaves a data URL alone', () => {
    const markdown = '![inline](data:image/png;base64,AAA)\n'
    expect(preProcessAssetMarkdown(NOTE, markdown)).toBe(markdown)
  })

  it('does not touch ordinary links', () => {
    // Only `![...]` is an image; a plain link to a note must stay relative.
    const markdown = 'See [two](./two.md).\n'
    expect(preProcessAssetMarkdown(NOTE, markdown)).toBe(markdown)
  })

  it('unwraps only URLs it produced', () => {
    const foreign = '![x](http://localhost:5374/other)\n'
    expect(postProcessAssetMarkdown(NOTE, foreign)).toBe(foreign)
    // Someone else's `/api/file` is not ours either — only a local one is.
    const elsewhere = '![x](https://example.com/api/file?path=%2Fetc%2Fpasswd)\n'
    expect(postProcessAssetMarkdown(NOTE, elsewhere)).toBe(elsewhere)
  })

  it('unwraps a URL made against a different local port', () => {
    // The port can move between the moment an image is shown and the moment the
    // document is written, and what must never land in the file is a URL.
    const stale = '![s](http://localhost:9999/api/file?path=%2Fvault%2Fnotes%2Fassets%2Fa.png)\n'
    expect(postProcessAssetMarkdown(NOTE, stale)).toBe('![s](assets/a.png)\n')
  })

  it('keeps a bracketed folder out of the markdown', () => {
    // A `)` in the URL would end the image early and spill the rest of the path
    // into the paragraph.
    const display = preProcessAssetMarkdown('/vault/plans (old)/one.md', '![s](assets/a.png)\n')
    expect(display).not.toMatch(/[()]a\.png/)
    expect(display).toContain('%28old%29')
    expect(postProcessAssetMarkdown('/vault/plans (old)/one.md', display)).toBe(
      '![s](assets/a.png)\n',
    )
  })

  it('survives a path with spaces', () => {
    const markdown = '![s](assets/my%20shot.png)\n'
    expect(postProcessAssetMarkdown(NOTE, preProcessAssetMarkdown(NOTE, markdown))).toBe(
      '![s](assets/my shot.png)\n',
    )
  })
})
