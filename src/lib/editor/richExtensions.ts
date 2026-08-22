import type { Extensions } from '@tiptap/core'
import FileSymlink from '@lucide/svelte/icons/file-symlink'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import TableOfContents, { getHierarchicalIndexes } from '@tiptap/extension-table-of-contents'
import { common, createLowlight } from 'lowlight'

import { getDefaultExtensions } from '@/components/edra/extensions'
import {
  AIHighlight,
  Callout,
  IFrameExtended,
  ImageExtended,
  Mermaid,
  SlashCommand,
  SvelteNodeViewRenderer,
  VideoExtended,
  type SlashGroup,
} from '@/components/edra/tiptap/index'
import { MediaPlaceholder } from '@/components/edra/tiptap/extensions/MediaPlaceHolder'
import CodeBlock from '@/components/edra/shadcn/components/CodeBlock.svelte'
import MediaPlaceholderComp from '@/components/edra/shadcn/components/MediaPlaceHolder.svelte'
import ImageExtendedComp from '@/components/edra/shadcn/components/ImageExtended.svelte'
import VideoExtendedComp from '@/components/edra/shadcn/components/VideoExtended.svelte'
import IFrameComp from '@/components/edra/shadcn/components/IFrame.svelte'
import MermaidComp from '@/components/edra/shadcn/components/Mermaid.svelte'
import SlashCommandComp from '@/components/edra/shadcn/components/SlashCommand.svelte'
import CalloutComp from '@/components/edra/shadcn/components/Callout.svelte'
import { setTocItems } from '@/components/edra/shadcn/toc.svelte'
import { MarkdownPaste } from './markdownPaste'
import { ImagePaste } from './imagePaste'
import type { InlineRefKind } from '$shared/inlineRefs'
import RefSuggestion from './refSuggestion'
import RefSuggestionMenu from './RefSuggestionMenu.svelte'
import type { RefItem } from './refSuggestionItems'
import { InlineRefDecorations } from './inlineRefDecorations'

/**
 * The editor's extension set, as data.
 *
 * Edra ships `createEditor()`, which builds this same list and immediately hands
 * it to `useEditor` — a Svelte hook, so it can only be called from a component.
 * The round-trip test is not a component, and a test that asserts against a
 * *different* schema than the app runs is not a test of the app.
 *
 * So the list lives here and both callers read it: `RichEditor.svelte` builds
 * the editor from it, `__tests__/roundTrip.test.ts` builds a headless one. Any
 * extension added for the app is therefore covered by the round trip
 * automatically, which is the whole point.
 *
 * Deliberately **not** included from Edra's own list: the AI plumbing is left
 * unconfigured (`callAI: null`), because a local-first editor that phones out is
 * a different program.
 */

/*
 * `common`, not `all`.
 *
 * `all` registers every grammar highlight.js ships — a bit under two hundred —
 * and in dev that is a bit under two hundred module requests before the first
 * paint, which was enough to wedge the page. `common` covers the ~35 languages
 * a notes app actually sees, and an unknown language still renders as a plain
 * fenced block rather than failing.
 */
const lowlight = createLowlight(common)

export interface RichExtensionOptions {
  /**
   * Where a pasted or dropped image goes. Returns the URL to show it by.
   *
   * Absent in the round-trip test, which never uploads anything — and the
   * markdown for an image is the same either way, since the file gets the
   * relative path back on save. See `assetUrls.ts`.
   */
  onFileUpload?: (file: File) => Promise<string>
  /**
   * Opens the note picker, for the `/` menu's "Link to file".
   *
   * A callback rather than a call into the store, because this module is also
   * what the headless round-trip test builds its editor from — and the store is
   * the app. Absent there, so the item simply is not offered.
   */
  onLinkFile?: () => void
  /**
   * What `#` and `@` offer while you type. Absent in the round-trip test, which
   * has no backend to ask — and then the menus simply never open.
   */
  loadRefItems?: (kind: InlineRefKind, query: string) => Promise<RefItem[]>
  /**
   * The note being edited. Only pasted markdown needs it, and only for the
   * images in it — a relative `![](assets/…)` has to be rewritten against the
   * note before the editor can fetch it, exactly as on open. See
   * `markdownPaste.ts`; absent in the round-trip test, which pastes nothing.
   */
  notePath?: string
}

/**
 * The `/` menu item that opens the note picker.
 *
 * `⌘K` already opens it, and stays the fast path. This exists because the
 * shortcut is only discoverable if you already know it: `/` is where people look
 * for "what can I put here", and a link to another note is one of the answers.
 * Both entry points open the same picker, so there is one behaviour to learn
 * rather than two — the item inserts nothing itself.
 */
function linkToFileGroup(onLinkFile: () => void): SlashGroup {
  return {
    name: 'others',
    title: 'Others',
    actions: [
      {
        icon: FileSymlink,
        name: 'linkFile',
        tooltip: 'Link to file',
        description: 'Insert a relative markdown link to another note',
        aliases: ['link', 'note', 'file', 'wikilink', 'reference', 'page'],
        onClick: () => onLinkFile(),
      },
    ],
  }
}

export function richExtensions(options: RichExtensionOptions = {}): Extensions {
  return [
    ...getDefaultExtensions(),
    CodeBlockLowlight.configure({ lowlight }).extend({
      addNodeView() {
        return SvelteNodeViewRenderer(CodeBlock)
      },
    }),
    MediaPlaceholder(MediaPlaceholderComp).configure({ onUpload: options.onFileUpload }),
    ImageExtended(ImageExtendedComp),
    VideoExtended(VideoExtendedComp),
    IFrameExtended(IFrameComp),
    Mermaid(MermaidComp),
    SlashCommand(SlashCommandComp).configure({
      extraGroups: options.onLinkFile ? [linkToFileGroup(options.onLinkFile)] : [],
    }),
    Callout(CalloutComp),
    RefSuggestion(RefSuggestionMenu).configure({ load: options.loadRefItems ?? null }),
    InlineRefDecorations,
    // Before `MarkdownPaste` in spirit if not in effect: an image paste is
    // files, a markdown paste is text, and neither ever sees the other's
    // clipboard. See `imagePaste.ts` for why the browser must not get there
    // first.
    ImagePaste.configure({ onFileUpload: options.onFileUpload }),
    MarkdownPaste.configure({ notePath: options.notePath }),
    AIHighlight.configure({ callAI: null }),
    TableOfContents.configure({
      getIndex: getHierarchicalIndexes,
      onUpdate: indexes => setTocItems(indexes),
    }),
  ]
}
