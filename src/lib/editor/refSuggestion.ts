import { Extension } from '@tiptap/core'
import { PluginKey, type EditorState } from '@tiptap/pm/state'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { computePosition, flip, offset, type Placement } from '@floating-ui/dom'
import type { Component } from 'svelte'
import { SvelteRenderer } from '@/components/edra/tiptap/index'
import type { InlineRefKind } from '$shared/inlineRefs'
import type { RefItem } from './refSuggestionItems'

/**
 * `#` and `@`, completed as you type them.
 *
 * The refs themselves are plain text — see `shared/inlineRefs.ts` — and this
 * changes none of that: picking a row writes `#draft` into the document the same
 * way typing it would. What the menu buys is the *spelling*. An index of tags is
 * only as useful as it is consistent, and `#rilis` beside `#release` beside
 * `#Rilis` is three tags describing one thing, which no amount of searching
 * afterwards can put back together.
 *
 * One exception, and it is the reason `@` is worth having: a row of kind `note`
 * writes a relative markdown link instead. See `refSuggestionItems.ts` for why
 * both live under one sigil.
 */

export interface RefSuggestionOptions {
  /**
   * What to offer, per sigil. `null` switches the menus off entirely — which is
   * what the round-trip test gets, having no backend to ask.
   */
  load: ((kind: InlineRefKind, query: string) => Promise<RefItem[]>) | null
}

const SIGIL: Record<InlineRefKind, string> = { tag: '#', mention: '@' }

/**
 * Module-level, so `inlineRefDecorations.ts` can ask whether a menu is currently
 * open over a ref — it has to stop painting the pill while one is, or the
 * plugin's own decoration cuts the pill into pieces. See the note there.
 */
export const refSuggestionKeys: Record<InlineRefKind, PluginKey> = {
  tag: new PluginKey('refSuggestion:tag'),
  mention: new PluginKey('refSuggestion:mention'),
}

/** The range a menu is open over, or `null` when none is. */
export function activeSuggestionRange(
  state: EditorState,
): { from: number; to: number } | null {
  for (const key of Object.values(refSuggestionKeys)) {
    // Absent in the source editor and in the round-trip test, which register no
    // suggestion plugin at all.
    const suggestion = key.getState(state) as
      | { active?: boolean; range?: { from: number; to: number } }
      | undefined
    if (suggestion?.active && suggestion.range) return suggestion.range
  }
  return null
}

function popup(): HTMLElement {
  const el = document.createElement('div')
  el.style.position = 'fixed'
  el.style.zIndex = '9999'
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  el.className = 'ref-suggestion-popup'
  document.body.appendChild(el)
  return el
}

const extensionName = 'refSuggestion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (menu: Component<any, any, ''>): Extension<RefSuggestionOptions> =>
  Extension.create<RefSuggestionOptions>({
    name: extensionName,

    addOptions() {
      return { load: null }
    },

    addStorage() {
      return { element: null as HTMLElement | null }
    },

    onCreate() {
      this.storage.element = popup()
    },

    onDestroy() {
      this.storage.element?.remove()
      this.storage.element = null
    },

    addProseMirrorPlugins() {
      const { load } = this.options
      if (!load) return []
      const storage = this.storage

      return (['tag', 'mention'] as InlineRefKind[]).map(kind =>
        Suggestion<RefItem>({
          editor: this.editor,
          char: SIGIL[kind],
          pluginKey: refSuggestionKeys[kind],
          // The same whitespace rule the scanner uses, so the menu opens exactly
          // where a ref would be recognised: never in `you@example.com`, never in
          // `docs/plan#2`. `allowSpaces` stays off — a space ends a ref.
          allowedPrefixes: [' '],
          allowSpaces: false,

          // A `#` in a fence is a comment and an `@` in one is code. The scanner
          // skips both; offering a menu there would promise an index entry that
          // never arrives.
          allow: ({ state, range }) =>
            !state.doc.resolve(range.from).parent.type.spec.code &&
            !state.doc.resolve(range.from).marks().some(mark => mark.type.name === 'code'),

          items: ({ query }) => load(kind, query),

          command: ({ editor, range, props }) => {
            if (props.kind === 'note' && props.href) {
              editor
                .chain()
                .focus()
                .deleteRange(range)
                .insertContent({
                  type: 'text',
                  text: props.label,
                  marks: [{ type: 'link', attrs: { href: props.href } }],
                })
                // Leaving the mark active would put every character typed next
                // inside the link.
                .unsetMark('link')
                .run()
              return
            }

            // The trailing space is deliberate: the ref is finished once it is
            // chosen, and without it the next character typed lands inside the
            // tag and quietly renames it.
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(`${SIGIL[kind]}${props.label} `)
              .run()
          },

          render: () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let component: any
            let rectOf: (() => DOMRect | null) | null = null

            const place = () => {
              const rect = rectOf?.()
              if (!storage.element || !rect) return
              void computePosition({ getBoundingClientRect: () => rect }, storage.element, {
                placement: 'bottom-start' as Placement,
                strategy: 'fixed',
                middleware: [
                  offset({ mainAxis: 6 }),
                  flip({ fallbackPlacements: ['top-start', 'bottom-start'] }),
                ],
              }).then(({ x, y }) => {
                if (!storage.element) return
                storage.element.style.left = `${x}px`
                storage.element.style.top = `${y}px`
              })
            }

            const show = (visible: boolean) => {
              if (!storage.element) return
              storage.element.style.visibility = visible ? 'visible' : 'hidden'
              storage.element.style.pointerEvents = visible ? 'auto' : 'none'
            }

            return {
              onStart: (props: SuggestionProps<RefItem>) => {
                component = new SvelteRenderer(menu, { props: { ...props, kind } })
                rectOf = props.clientRect ?? null
                storage.element?.appendChild(component.element)
                show(true)
                place()
              },

              onUpdate: (props: SuggestionProps<RefItem>) => {
                component?.updateProps({ ...props, kind })
                rectOf = props.clientRect ?? null
                show(true)
                place()
              },

              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                  show(false)
                  return true
                }
                return component?.ref?.handleKeyDown?.(props.event) ?? false
              },

              onExit: () => {
                show(false)
                if (storage.element) storage.element.innerHTML = ''
                rectOf = null
                component?.destroy()
              },
            }
          },
        }),
      )
    },
  })
