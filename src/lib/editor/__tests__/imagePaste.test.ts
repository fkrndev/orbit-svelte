import { describe, expect, it } from 'vitest'
import { imageFilesFrom } from '../imagePaste'

/** Enough of a `DataTransfer` for the filter: a `files` list. */
function transfer(files: Array<{ name: string; type: string }>): DataTransfer {
  return { files } as unknown as DataTransfer
}

describe('imageFilesFrom', () => {
  it('claims the images', () => {
    const files = imageFilesFrom(
      transfer([
        { name: 'image.png', type: 'image/png' },
        { name: 'photo.jpg', type: 'image/jpeg' },
      ]),
    )
    expect(files.map(file => file.name)).toEqual(['image.png', 'photo.jpg'])
  })

  it('leaves everything else to the native paste', () => {
    // A dropped archive or a pasted document is not something this editor can
    // show — writing it into `assets/` would be a surprise, not a feature.
    expect(imageFilesFrom(transfer([{ name: 'notes.pdf', type: 'application/pdf' }]))).toEqual([])
    expect(imageFilesFrom(transfer([{ name: 'a.zip', type: '' }]))).toEqual([])
  })

  it('survives a clipboard with no files, and no clipboard at all', () => {
    expect(imageFilesFrom(transfer([]))).toEqual([])
    expect(imageFilesFrom(null)).toEqual([])
    expect(imageFilesFrom(undefined)).toEqual([])
  })
})
