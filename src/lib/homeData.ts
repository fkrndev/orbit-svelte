import type { Dashboard, RootId, TodoScan } from '$shared/types'
import { api, onFileChange } from './rpcClient'

/**
 * Home's data: one fetch, and the rule for when to fetch again.
 *
 * Kept out of the component because the *when* is the part worth testing, and
 * because Home used to have no rule at all — it fetched once on mount and then
 * sat there while the files under it changed.
 */

/**
 * How many rows each ranked list may contribute.
 *
 * Home shows three cards and two short columns, so anything past a handful is
 * paid for and never drawn. It used to ask for ten against a backend default of
 * twelve, which is two numbers neither of which meant anything.
 */
export const HOME_LIMIT = 8

/**
 * Saving a file emits a write event, a meta event, and usually a watcher event
 * within a few milliseconds of each other. Long enough to swallow that burst,
 * short enough that Home is right again before you have finished looking at it.
 */
export const HOME_REFRESH_MS = 300

export function loadHome(): Promise<Dashboard | null> {
  return api.getDashboard({ limit: HOME_LIMIT }).catch(() => null)
}

/**
 * The task list, scoped to one root or to all of them.
 *
 * Separate from `loadHome` because it is the expensive half — a walk of the
 * markdown under each root — and because the two answer to different inputs:
 * the dashboard changes when you open a file, the task list when you write one.
 */
export function loadTodos(scope: RootId | 'all'): Promise<TodoScan | null> {
  return api.listTodos(scope === 'all' ? {} : { rootId: scope }).catch(() => null)
}

/**
 * Tags and mentions across the vault, counted by `tagIndex.ts`.
 *
 * Not part of the dashboard payload any more: the counts that used to travel
 * with it came from the sidecar, which nothing has written since the tags panel
 * was removed, so they were always zero.
 *
 * Both in one call because Home draws them in one row of chips, and two awaits
 * would let the row reflow under the cursor a moment after it appeared.
 */
export function loadRefs(): Promise<{
  tags: Array<{ tag: string; count: number }>
  mentions: Array<{ mention: string; count: number }>
}> {
  return Promise.all([
    api.listTags().catch(() => []),
    api.listMentions().catch(() => []),
  ]).then(([tags, mentions]) => ({ tags, mentions }))
}

/**
 * Calls `reload` when anything Home draws could have changed.
 *
 * Two channels, because they carry different news: `onFileChange` is the disk
 * (a file was written, renamed, deleted), `app:meta-changed` is the app's own
 * records (a pin, a label, a tag). Home reads both, so it has to hear both —
 * this is the same pairing `RecentsPanel` already uses.
 *
 * Returns the unsubscribe, which also cancels a refresh that is still pending:
 * a timer that fires after the screen is gone is a fetch nobody will read.
 */
export function watchHome(reload: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      reload()
    }, HOME_REFRESH_MS)
  }

  window.addEventListener('app:meta-changed', schedule)
  const stopFileChange = onFileChange(schedule)

  return () => {
    if (timer) clearTimeout(timer)
    timer = null
    window.removeEventListener('app:meta-changed', schedule)
    stopFileChange()
  }
}
