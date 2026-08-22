import Electrobun, { Electroview } from 'electrobun/view'
import { FILE_WRITE_METHODS } from '$shared/rpc'
import type { AppRPCMessages, AppRPCRequests, MenuCommand } from '$shared/rpc'
import type { FileChangeEvent } from '$shared/types'
import { getState } from './store.svelte'

/**
 * The webview's only door to the filesystem.
 *
 * There are two transports behind the same API:
 *
 *  - **Desktop** — Electrobun's typed RPC to the Bun main process.
 *  - **Browser** — HTTP to the dev server (`src/bun/devServer.ts`), which mounts
 *    the identical handlers against the identical store. Running the UI at
 *    <http://localhost:5273> is the same app, not a degraded preview.
 *
 * Everything runtime-specific is confined to this file, so the rest of the UI
 * never learns which one it is talking to.
 */

type AppRPCType = {
  bun: { requests: AppRPCRequests; messages: Record<never, unknown> }
  webview: { requests: Record<never, unknown>; messages: AppRPCMessages }
}

type FileChangeListener = (event: FileChangeEvent) => void
type MenuListener = (command: MenuCommand) => void
type UpdateListener = (update: { version: string }) => void

const fileChangeListeners = new Set<FileChangeListener>()
const menuListeners = new Set<MenuListener>()
const updateListeners = new Set<UpdateListener>()

function emitFileChange(event: FileChangeEvent) {
  for (const listener of fileChangeListeners) listener(event)
}

const rpc = Electroview.defineRPC<AppRPCType>({
  maxRequestTime: 15_000,
  handlers: {
    requests: {},
    messages: {
      fileChanged: emitFileChange,
      menuCommand: ({ command }: { command: MenuCommand }) => {
        for (const listener of menuListeners) listener(command)
      },
      updateReady: (update: { version: string }) => {
        for (const listener of updateListeners) listener(update)
      },
    },
  },
})

/**
 * `Electroview` assumes the Electrobun preload has already run and assigns
 * straight into `window.__electrobun`. In a plain browser that object does not
 * exist, so constructing it throws and takes the whole module — and therefore
 * the entire UI — down with it.
 */
const hasElectrobunPreload =
  typeof window !== 'undefined' && Boolean((window as { __electrobun?: unknown }).__electrobun)

const electrobun = hasElectrobunPreload ? new Electrobun.Electroview({ rpc }) : null

/** True inside the desktop shell. The browser gets the HTTP transport instead. */
export const isDesktop = Boolean(electrobun?.rpc)

// ---- http transport -------------------------------------------------------

const API_URL = '/api/rpc'

/**
 * The most common failure here by far is "nothing is listening" — the Vite
 * proxy then answers with an HTML error page, which surfaces as an unparseable
 * body. Saying so beats reporting a bare status code the user cannot act on.
 */
const NO_BACKEND_HINT =
  'Cannot reach the Orbit backend. Start the desktop app (bun run dev) ' +
  'or the standalone server (bun run dev:browser).'

async function httpRequest(method: string, params?: unknown): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, params }),
    })
  } catch {
    throw new Error(NO_BACKEND_HINT)
  }

  const payload = (await response.json().catch(() => null)) as
    | { result?: unknown; error?: string }
    | null

  if (!response.ok || payload?.error) {
    // A non-JSON body means the request never reached a handler.
    if (!payload) throw new Error(NO_BACKEND_HINT)
    throw new Error(payload.error ?? `${method} failed (${response.status})`)
  }
  return payload?.result ?? undefined
}

let eventSource: EventSource | null = null

/**
 * The browser's stand-in for Electrobun's push channel. Opened lazily so a
 * desktop run never creates it.
 */
function ensureEventStream() {
  if (isDesktop || eventSource || typeof EventSource === 'undefined') return

  eventSource = new EventSource('/api/events')
  eventSource.onmessage = message => {
    try {
      emitFileChange(JSON.parse(message.data) as FileChangeEvent)
    } catch {
      // A malformed frame is not worth tearing the stream down for.
    }
  }
  eventSource.onerror = () => {
    // EventSource reconnects on its own; log once rather than on every retry.
  }
}

// ---- public api -----------------------------------------------------------

export type AppApi = {
  [K in keyof AppRPCRequests]: AppRPCRequests[K]['params'] extends undefined
    ? () => Promise<AppRPCRequests[K]['response']>
    : (params: AppRPCRequests[K]['params']) => Promise<AppRPCRequests[K]['response']>
}

/**
 * Thrown, not returned, when read-only mode refuses a write.
 *
 * A refusal has to be loud. The alternative — resolving with something
 * plausible — would leave the caller updating the store as though the write had
 * landed, and the app would then show a file that does not match the one on
 * disk. Callers that expect this catch it by class; everything else surfaces the
 * message, which is written for the person reading it.
 */
export class ReadOnlyError extends Error {
  constructor(method: string) {
    super(`Read-only mode is on — ${method} was not run. Press ⇧⌘L to turn it off.`)
    this.name = 'ReadOnlyError'
  }
}

export const api = new Proxy({} as AppApi, {
  get(_target, method: string) {
    return (params?: unknown) => {
      /*
       * The one gate, and deliberately here rather than at each call site.
       *
       * Every write to the user's folders goes through this proxy, so this is
       * the only place that can promise "nothing changed" without depending on
       * a caller having remembered to ask. Anything new that writes is covered
       * the moment it is named in `FILE_WRITE_METHODS`.
       */
      if (FILE_WRITE_METHODS.has(method as keyof AppRPCRequests) && getState().settings.readOnly) {
        return Promise.reject(new ReadOnlyError(method))
      }

      if (!isDesktop) {
        ensureEventStream()
        return httpRequest(method, params)
      }
      const request = electrobun!.rpc!.request as unknown as Record<
        string,
        (p?: unknown) => Promise<unknown>
      >
      return request[method]!(params)
    }
  },
})

export function onFileChange(listener: FileChangeListener): () => void {
  ensureEventStream()
  fileChangeListeners.add(listener)
  return () => fileChangeListeners.delete(listener)
}

export function onMenuCommand(listener: MenuListener): () => void {
  menuListeners.add(listener)
  return () => menuListeners.delete(listener)
}

/**
 * Fires at most once per run, and only in the desktop app — the browser build
 * has no bundle to replace, so nothing ever sends this.
 */
export function onUpdateReady(listener: UpdateListener): () => void {
  updateListeners.add(listener)
  return () => updateListeners.delete(listener)
}
