import { existsSync } from 'node:fs'
import { isMarkdown } from './files'

/**
 * Files the app was asked to open before there was a window to open them in.
 *
 * Launching with a path — `orbit ~/notes/plan.md` — arrives long
 * before the webview exists, so the path is parked here and the webview drains
 * it during `bootstrap`. A queue rather than a push, because a message sent to
 * a webview that has not finished loading is a message nobody receives, and the
 * timing of that race changes with the machine.
 */
const queue: string[] = []

export function queueOpen(path: string) {
  if (!existsSync(path) || !isMarkdown(path)) return
  if (!queue.includes(path)) queue.push(path)
}

/** Returns what is queued and empties it — these are one-shot instructions. */
export function takeOpens(): string[] {
  return queue.splice(0, queue.length)
}
