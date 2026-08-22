import type { InlineRefKind } from '$shared/inlineRefs'
import { api, onFileChange } from '@/rpcClient'
import { mentionItems, tagItems, type RefItem } from './refSuggestionItems'

/**
 * The vault-wide lists behind the `#` and `@` menus, fetched once per burst of
 * typing rather than per keystroke.
 *
 * Every keystroke inside an open menu asks for items again — that is how the
 * Suggestion plugin works — and each of the three calls behind them walks the
 * markdown. Without a cache, holding a key down would queue a scan per
 * character. The window is short because the list is a *suggestion*: a tag
 * created seconds ago in another tab turning up a moment late costs nothing,
 * and the row that creates it is there regardless.
 */
const TTL_MS = 5_000

interface Vault {
  tags: Array<{ tag: string; count: number }>
  mentions: Array<{ mention: string; count: number }>
  notes: Array<{ path: string; name: string }>
}

let cached: { at: number; vault: Promise<Vault> } | null = null

function vault(): Promise<Vault> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.vault

  const fetched = Promise.all([
    api.listTags().catch(() => []),
    api.listMentions().catch(() => []),
    api.listMarkdownFiles({}).catch(() => []),
  ]).then(([tags, mentions, notes]) => ({ tags, mentions, notes }))

  cached = { at: Date.now(), vault: fetched }
  return fetched
}

/**
 * Dropped when anything is written, so a tag you just used in another note is
 * offered back rather than waiting out the window.
 *
 * Subscribed here rather than from the component: the cache is module-wide, and
 * an editor unmounting is not a reason for the *next* one to start stale.
 */
onFileChange(() => {
  cached = null
})

/**
 * A loader bound to one note — `@` needs it, because the link it writes is
 * relative to the file it is written in.
 */
export function refItemLoader(notePath: string) {
  return async (kind: InlineRefKind, query: string): Promise<RefItem[]> => {
    const { tags, mentions, notes } = await vault()
    return kind === 'tag'
      ? tagItems(query, tags)
      : mentionItems(query, mentions, notes, notePath)
  }
}
