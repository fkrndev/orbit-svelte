/**
 * Where a pasted image goes, and what the note links it by.
 *
 * Two rules, both about the file staying useful outside this app.
 *
 * **Beside the note, never in a private store.** An image in the app's data
 * directory is invisible to every other tool and lost the moment the note is
 * copied elsewhere. `assets/` next to the note travels with it.
 *
 * **Linked relatively.** An absolute path breaks as soon as the folder moves or
 * is opened on another machine, and this app has no vault root to resolve
 * against, so relative is the only honest option.
 */

export const ASSET_DIR = 'assets'

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'image/heic': '.heic',
}

export function extensionForMime(mime: string): string | null {
  return EXTENSIONS[mime.toLowerCase()] ?? null
}

/** Lowercase, no spaces, no separators — safe on every filesystem we target. */
export function slugifyAssetName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .toLowerCase() || 'image'
  )
}

/**
 * Names a pasted image after the note it lands in, so a folder of assets stays
 * readable instead of becoming a pile of `Screenshot 2026-08-14 at 06.41.22`.
 */
export function assetFileName(noteName: string, mime: string, stamp: string): string {
  const stem = slugifyAssetName(noteName.replace(/\.mdx?$/i, '')) || 'note'
  return `${stem}-${stamp}${extensionForMime(mime) ?? '.png'}`
}

/**
 * Names a file the browser handed us, whether or not it brought a name worth
 * keeping.
 *
 * A clipboard image has none: every screenshot arrives as `image.png`, so
 * honouring it fills `assets/` with `image.png`, `image-1.png`, `image-2.png` —
 * a folder where nothing says which note it belongs to. Those get the
 * note-and-timestamp name. A file dropped from Finder is the other case: the
 * author already named it, and `diagram.png` is better than anything generated.
 */
const GENERIC_FILE_NAME = /^(?:image|images?[ -]?\d*|screenshot|pasted[ -]?image|unknown|untitled)\.\w+$/i

export function assetNameForUpload(
  noteName: string,
  fileName: string,
  mime: string,
  stamp: string,
): string {
  if (fileName && !GENERIC_FILE_NAME.test(fileName)) return slugifyAssetName(fileName)
  return assetFileName(noteName, mime, stamp)
}

/** `2026-08-14-064122` — sortable, and readable in a folder listing. */
export function assetStamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()),
  ].join('-')
}

/** POSIX relative path from the note's folder to the asset. */
export function relativeAssetPath(fileName: string): string {
  return `${ASSET_DIR}/${fileName}`
}
