import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { extensionForMime } from '$shared/assets'

/**
 * A pasted or dropped image becomes a file on disk, not a `blob:` URL.
 *
 * Left alone, the webview wins this one. Paste a screenshot into a
 * contenteditable and the browser synthesises `<img src="blob:http://localhost:…">`
 * in the clipboard's HTML; ProseMirror parses that HTML faithfully and the
 * document ends up holding a handle to an in-memory object with no file behind
 * it. It looks right until the moment it matters: the markdown on disk reads
 * `![](blob:http://localhost:5373/1496753f-…)`, the blob dies with the page, and
 * the note is left pointing at nothing — in this app *and* in every other editor
 * that opens the same file.
 *
 * So the image is claimed before ProseMirror sees the HTML: written into
 * `assets/` beside the note and linked relatively, which is the rule
 * `shared/assets.ts` exists to state. This is the same bargain markdown-local,
 * this app's React ancestor, makes in `usePasteImage.ts` — and the reason it is
 * a paste *handler* rather than a cleanup pass is that once the blob URL is in
 * the document, the bytes are already unreachable.
 *
 * Only the clipboard's *files* are claimed. A text paste, an HTML paste, an
 * `<img>` pointing at a real URL someone copied off the web — all of those fall
 * through to the native path, and to `markdownPaste.ts` behind it.
 */

export interface ImagePasteOptions {
  /**
   * Writes the file and returns the URL to show it by. Absent in the headless
   * round-trip test, which has no backend to write to — and then this extension
   * registers no plugin at all, leaving paste exactly as it was.
   */
  onFileUpload?: (file: File) => Promise<string>
}

/**
 * The images in a clipboard or a drag, and nothing else.
 *
 * Filtered by mime rather than by "is there a file at all", because a dragged
 * `.zip` or a pasted `.pdf` is not something this editor can show — those must
 * fall through rather than be silently written into `assets/`.
 */
export function imageFilesFrom(transfer: DataTransfer | null | undefined): File[] {
  return Array.from(transfer?.files ?? []).filter(file => extensionForMime(file.type) !== null)
}

export const ImagePaste = Extension.create<ImagePasteOptions>({
  name: 'imagePaste',

  addOptions() {
    return { onFileUpload: undefined }
  },

  addProseMirrorPlugins() {
    const { editor } = this
    const upload = this.options.onFileUpload
    if (!upload) return []

    /*
     * Sequential, not `Promise.all`. Each image is inserted at the caret, and
     * the caret is where the previous insert left it — racing them would land
     * several images in an order nobody chose.
     */
    const save = async (files: File[]) => {
      for (const file of files) {
        try {
          const src = await upload(file)
          editor.chain().focus().setImage({ src }).run()
        } catch {
          // `onFileUpload` has already told the user; swallowing here only stops
          // one failed image from taking the rest of the paste with it.
        }
      }
    }

    return [
      new Plugin({
        key: new PluginKey('imagePaste'),
        props: {
          handlePaste: (view, event) => {
            if (!view.editable) return false
            const files = imageFilesFrom(event.clipboardData)
            if (files.length === 0) return false
            // Returning true is what makes ProseMirror call `preventDefault`
            // for us — and what keeps the browser's `<img src="blob:…">` out of
            // the document.
            void save(files)
            return true
          },

          handleDrop: (view, event, _slice, moved) => {
            // `moved` is a drag *within* the document — content the editor
            // already owns, and none of this extension's business.
            if (!view.editable || moved) return false
            const files = imageFilesFrom(event.dataTransfer)
            if (files.length === 0) return false

            // Drop lands where the pointer is, not where the caret was. The
            // selection is moved first so the insert — which happens a write
            // later — has somewhere to go.
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
            if (at) {
              const { tr, doc } = view.state
              view.dispatch(tr.setSelection(TextSelection.near(doc.resolve(at.pos))))
            }
            void save(files)
            return true
          },
        },
      }),
    ]
  },
})
