import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FileChangeEvent } from '../shared/types'
import type { RequestHandlers } from './handlers'
import { STORE_DIR } from './paths'
import { listRoots } from './services/roots'
import { isGrantedFolder } from './services/openedFolders'

/**
 * The HTTP face of the app: `POST /api/rpc` plus a server-sent event stream.
 *
 * Hosted by whichever process owns the stores. The desktop app starts one so
 * the browser can attach to the *running app* rather than to a second process —
 * that matters, because each process keeps the JSON stores in memory and writes
 * them back whole, so two owners would overwrite each other's tags and history.
 * One owner, two front doors.
 */

export interface ApiServer {
  port: number
  broadcast: (event: FileChangeEvent) => void
  stop: () => void
}

/** Connected browser tabs, each holding an SSE stream. */
type Client = (event: FileChangeEvent) => void

export function startApiServer(options: {
  handlers: RequestHandlers
  port: number
  label: string
}): ApiServer | null {
  const { handlers, port, label } = options
  const clients = new Set<Client>()

  const isHandlerName = (name: string): name is keyof RequestHandlers =>
    Object.prototype.hasOwnProperty.call(handlers, name)

  async function handleRpc(request: Request): Promise<Response> {
    let body: { method?: string; params?: unknown }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return Response.json({ error: 'Malformed JSON body' }, { status: 400 })
    }

    const method = body.method
    if (!method || !isHandlerName(method)) {
      return Response.json({ error: `Unknown method: ${String(method)}` }, { status: 404 })
    }

    try {
      const handler = handlers[method] as (params: unknown) => unknown
      const result = await handler(body.params)
      // `undefined` is not valid JSON; void handlers still need a parseable body.
      return Response.json({ result: result ?? null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[api] ${method} failed:`, message)
      return Response.json({ error: message }, { status: 500 })
    }
  }

  function sseResponse(): Response {
    let client: Client | null = null

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const write = (data: string) => {
          try {
            controller.enqueue(encoder.encode(data))
          } catch {
            // The tab went away mid-write; cleanup happens in cancel().
          }
        }

        write(': connected\n\n')
        client = event => write(`data: ${JSON.stringify(event)}\n\n`)
        clients.add(client)
      },
      cancel() {
        if (client) clients.delete(client)
        client = null
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    })
  }

  /**
   * Serves a note's images to the webview, which cannot resolve a path relative
   * to a file on disk.
   *
   * Confined to folders the user has explicitly opened, on purpose. This listens
   * on localhost, so any process on the machine can reach it, and an unguarded
   * `?path=` would hand out `~/.ssh/id_rsa` to whatever asked.
   *
   * Two ways to be explicit, and they are the same act: adding a root, or
   * opening a file by naming its path — see `openedFolders.ts` for the second,
   * which grants that one folder for this run only.
   */
  function serveFile(requested: string | null): Response {
    if (!requested) return new Response('Missing path', { status: 400 })
    const path = resolve(requested)
    const allowed =
      listRoots().some(root => path.startsWith(`${resolve(root.path)}/`)) || isGrantedFolder(path)
    if (!allowed) return new Response('Forbidden', { status: 403 })
    if (!existsSync(path) || !statSync(path).isFile()) {
      return new Response('Not found', { status: 404 })
    }
    return new Response(Bun.file(path), {
      // These are content-addressed by path and change only when the user
      // replaces them, so a short cache stops every keystroke refetching.
      headers: { 'cache-control': 'private, max-age=60' },
    })
  }

  let server: ReturnType<typeof Bun.serve>
  try {
    server = Bun.serve({
      port,
      fetch(request) {
        const url = new URL(request.url)
        if (url.pathname === '/api/events') return sseResponse()
        if (url.pathname === '/api/rpc' && request.method === 'POST') return handleRpc(request)
        if (url.pathname === '/api/file') return serveFile(url.searchParams.get('path'))
        if (url.pathname === '/api/health') {
          return Response.json({ ok: true, store: STORE_DIR, host: label })
        }
        return new Response('Not found', { status: 404 })
      },
    })
  } catch (error) {
    // Almost always "port in use" — another owner is already serving. Say so
    // plainly rather than taking the whole app down over an optional feature.
    console.error(
      `[api] could not listen on :${port} (${String(error)}). ` +
        'Another Orbit process is probably already serving the browser build.',
    )
    return null
  }

  console.log(`[api] ${label} serving http://localhost:${server.port}`)

  return {
    // Bun types `port` as optional; we always pass a concrete one.
    port: server.port ?? port,
    broadcast(event) {
      for (const send of clients) send(event)
    },
    stop() {
      server.stop(true)
      clients.clear()
    },
  }
}
