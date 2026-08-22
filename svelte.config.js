import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/**
 * Orbit Lite is a single-page app inside a webview, not a web site.
 *
 * Everything below follows from that: no SSR, no prerendering, and every
 * emitted URL relative — the bundle is loaded from `views://mainview/index.html`
 * inside the Electrobun app, where an absolute `/_app/...` resolves to nothing.
 */

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),

  compilerOptions: {
    // Runes everywhere. The store is `$state` and the components read it
    // directly; a component silently compiled in legacy mode would not react.
    runes: true,
  },

  kit: {
    adapter: adapter({
      // `dist/` is what `electrobun.config.ts` copies into the bundle. Keeping
      // the name the desktop build already expects means the two configs
      // cannot drift.
      pages: 'dist',
      assets: 'dist',
      // One HTML file, client-side routing underneath it. Without a fallback
      // the adapter demands prerenderable routes, which an app that reads the
      // filesystem at runtime does not have.
      fallback: 'index.html',
      strict: false,
    }),

    // See the file comment: relative or the desktop build loads nothing.
    paths: { relative: true },

    /*
     * The bundled view is loaded as `views://mainview/index.html`, so the
     * pathname the router sees is `/index.html` — no route matches it and the
     * app boots straight into SvelteKit's own 404 page. Hash routing ignores
     * the pathname entirely, which is what a webview-hosted SPA wants.
     */
    router: { type: 'hash' },

    // `@` points at the webview root, which is what shadcn-svelte generates
    // against. `$shared` is the contract with `src/bun/` — see src/shared/rpc.ts.
    alias: {
      '@': 'src/lib',
      '@/*': 'src/lib/*',
      $shared: 'src/shared',
      '$shared/*': 'src/shared/*',
    },
  },
}
