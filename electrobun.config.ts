import type { ElectrobunConfig } from 'electrobun'
import pkg from './package.json'

export default {
  app: {
    name: 'Orbit Lite',
    /*
     * A *filesystem path*, not a name — it is the user-data directory.
     *
     * Deliberately different from the React build's `local.markdown.app`: the
     * two apps keep their stores in memory and write them back whole, so
     * sharing an identifier would have them overwriting each other's tags,
     * history, and roots. See src/bun/paths.ts.
     */
    identifier: 'local.orbitlite.app',
    /*
     * Read, not repeated. The tag `scripts/release.sh` cuts comes from
     * package.json, and a second copy here would drift the moment one of the
     * two was bumped alone — shipping a build that calls itself the version it
     * is replacing.
     */
    version: pkg.version,
    description:
      'Local-first markdown editor with no single vault — every folder you open stays in reach',
    fileAssociations: [
      {
        ext: ['md', 'markdown', 'mdx'],
        name: 'Markdown Document',
        role: 'Editor',
      },
    ],
  },
  build: {
    /*
     * SvelteKit's static adapter emits `dist/index.html` plus a hashed
     * `dist/_app/` — *not* the `dist/assets/` a plain Vite build produces.
     * Copying the wrong directory yields a white window with nothing in the
     * console, so this pair is the thing to check first when the desktop build
     * boots to blank.
     */
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/_app': 'views/mainview/_app',
      'dist/icon.svg': 'views/mainview/icon.svg',
    },
    // Vite output is a build product, not a source — don't retrigger builds on it.
    watchIgnore: ['dist/**'],
    mac: {
      // System WKWebView keeps the bundle small; the editor core is already
      // WebKit-hardened.
      bundleCEF: false,
      // The .app alone is an updater payload, not something a person can
      // install. A DMG is the only artifact a stable build hands to a user.
      createDmg: true,
      // Generated from assets/icon-macos.svg — see `bun run icons`.
      icons: 'icon.iconset',
    },
    linux: { bundleCEF: false },
    win: { bundleCEF: false },
  },
  /*
   * Where the running app looks for `stable-macos-arm64-update.json` and the
   * tarball beside it. `/releases/latest/download` is a GitHub redirect to the
   * newest non-prerelease, so publishing a release *is* shipping the update —
   * there is no URL to bump. The build also fetches the previous update.json
   * from here to generate the delta patch, which is why the very first release
   * prints a "no previous version" note rather than failing.
   */
  release: {
    baseUrl: 'https://github.com/fkrndev/orbit-svelte/releases/latest/download',
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
} satisfies ElectrobunConfig
