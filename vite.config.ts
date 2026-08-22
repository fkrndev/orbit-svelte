import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'node:module'
// With the extension: Vite's native config loader is Node's, which does not
// resolve an extensionless TypeScript specifier.
import { DEFAULT_API_PORT } from './src/shared/api.ts'

const { version } = createRequire(import.meta.url)('./package.json') as { version: string }

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],

  // The About section's version. Baked in at build rather than fetched over
  // RPC: it is a property of the bundle, and asking the main process for it
  // would let the two disagree.
  define: { __APP_VERSION__: JSON.stringify(version) },

  server: {
    port: 5373,
    strictPort: true,
    // The browser build talks to the same services the desktop app uses, over
    // HTTP. Proxying keeps it same-origin, so there is no CORS to configure and
    // no second port to remember.
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.ORBIT_LITE_API_PORT ?? DEFAULT_API_PORT}`,
        changeOrigin: true,
        // SSE must not be buffered or the file-change stream never arrives.
        // Vite 8 types `proxy` as the http-proxy instance without surfacing its
        // emitter, so the listener is attached through a narrow local shape
        // rather than a bare `any`.
        configure: proxyServer => {
          const proxy = proxyServer as unknown as {
            on: (
              event: 'proxyRes',
              listener: (proxyRes: { headers: Record<string, string | undefined> }) => void,
            ) => void
          }
          proxy.on('proxyRes', proxyRes => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache, no-transform'
            }
          })
        },
      },
    },
  },

  build: {
    // WKWebView on macOS 15. Matches the desktop shell rather than a browser
    // matrix the app is never shipped to.
    target: 'safari18',
  },

  test: {
    // The lifted editor utilities build and inspect DOM nodes (mark elements,
    // KaTeX output, sanitised HTML), so they need a document even though they
    // are otherwise pure functions. `src/bun` and `src/shared` do not care.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Vitest defaults to requiring an assertion per test in the scaffold; the
    // ported suites include a few that assert by not throwing.
    expect: { requireAssertions: false },
    coverage: {
      provider: 'v8',
      include: ['src/bun/services/**', 'src/shared/**', 'src/lib/editor/**'],
    },
    alias: {
      '@': fileURLToPath(new URL('./src/lib', import.meta.url)),
      $shared: fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
})
