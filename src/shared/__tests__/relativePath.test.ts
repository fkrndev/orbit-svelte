import { describe, expect, it } from 'vitest'
import { relativePathBetween } from '../relativePath'
import {
  assetFileName,
  assetNameForUpload,
  assetStamp,
  relativeAssetPath,
  slugifyAssetName,
} from '../assets'

describe('relativePathBetween', () => {
  it('links a sibling explicitly', () => {
    // `./` matters: a bare `notes.md` is ambiguous with a scheme in some renderers.
    expect(relativePathBetween('/a/b/one.md', '/a/b/two.md')).toBe('./two.md')
  })

  it('descends into a subfolder', () => {
    expect(relativePathBetween('/a/b/one.md', '/a/b/sub/two.md')).toBe('sub/two.md')
  })

  it('climbs out of a folder', () => {
    expect(relativePathBetween('/a/b/sub/one.md', '/a/b/two.md')).toBe('../two.md')
  })

  it('handles two roots with nothing in common but the top', () => {
    expect(relativePathBetween('/a/docs/one.md', '/a/notes/deep/two.md')).toBe('../notes/deep/two.md')
  })

  it('climbs more than one level', () => {
    expect(relativePathBetween('/a/b/c/d/one.md', '/a/two.md')).toBe('../../../two.md')
  })
})

describe('asset naming', () => {
  it('names the file after the note it lands in', () => {
    expect(assetFileName('My Plan.md', 'image/png', '2026-08-14-064122')).toBe(
      'my-plan-2026-08-14-064122.png',
    )
  })

  it('falls back to png for a mime it does not know', () => {
    expect(assetFileName('n.md', 'image/unknown', 's')).toBe('n-s.png')
  })

  it('strips characters that are unsafe in a filename', () => {
    expect(slugifyAssetName('Screenshot 2026-08-14 at 06.41.22.png')).toBe(
      'screenshot-2026-08-14-at-06.41.22.png',
    )
    expect(slugifyAssetName('///')).toBe('image')
  })

  it('links assets relatively', () => {
    expect(relativeAssetPath('a.png')).toBe('assets/a.png')
  })

  it('keeps a name the author chose', () => {
    expect(assetNameForUpload('plan.md', 'Sales Diagram.PNG', 'image/png', 's')).toBe(
      'sales-diagram.png',
    )
  })

  it('replaces the names a clipboard makes up', () => {
    // Every screenshot paste arrives as one of these, so keeping them would
    // pile `image.png`, `image-1.png`, `image-2.png` into one folder.
    for (const generic of ['image.png', 'Image.png', 'image2.png', 'Screenshot.png', 'unknown.jpg'])
      expect(assetNameForUpload('My Plan.md', generic, 'image/png', '2026-08-14-064122')).toBe(
        'my-plan-2026-08-14-064122.png',
      )
  })

  it('names a file that arrived with no name at all', () => {
    expect(assetNameForUpload('plan.md', '', 'image/png', 's')).toBe('plan-s.png')
  })

  it('stamps sortably, to the second', () => {
    expect(assetStamp(new Date(2026, 7, 14, 6, 41, 22))).toBe('2026-08-14-064122')
  })
})
