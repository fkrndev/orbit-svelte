# AGENTS.md — Orbit Lite

Conventions for this repo. Short on purpose; the reasoning lives in the file
comments — every module opens by explaining the decision it encodes.

> This is a **SvelteKit port** of [Orbit](../markdown-local), which is React +
> BlockNote on Electrobun. The backend (`src/shared`, `src/bun`) is that project's,
> near-verbatim. Everything under `src/lib` and `src/routes` was rewritten.
> Orbit's own `AGENTS.md` still applies where it talks about *the product*; the
> React rules below are replaced.

## Architecture

- Only `src/bun/` touches the filesystem. The webview reaches it through `src/shared/rpc.ts`.
- A rule that protects the user's files belongs in `src/shared/`, not in the component that happens
  to collect the input — see `rename.ts`, which the dialog and the handler both run. Validating in
  the UI alone is decoration; validating only in the handler makes the UI feel dead.
- New capability = add it to `AppRPCRequests`, implement it in `src/bun/handlers.ts`. Both the
  desktop app and the HTTP dev server pick it up automatically.
- Anything needing a native API (dialogs, trash, Finder) goes through `NativeBridge` so the browser
  build keeps working.
- **Never redraw on a round trip for something the app just did.** The push channel (`onFileChange`)
  exists for changes made *outside* the app. When an action already knows what changed, tell the UI
  directly — `notifyDirChanged`, `app:meta-changed`.
- The webview must never import `electrobun` outside `src/lib/rpcClient.ts`.
- **Read-only mode is enforced in one place: the proxy in `lib/rpcClient.ts`**, which refuses every
  request named in `FILE_WRITE_METHODS` (`shared/rpc.ts`). The checks scattered through `actions.ts`
  are *manners* — they stop the app offering what it will refuse — and none of them is the
  guarantee. Do not move the enforcement to a call site, and do not add a second one.
  - The set names requests that change **the user's files**. Sidecar writes (`updateMeta`,
    `addBookmark`, `saveSettings`) are deliberately allowed: blocking them would make reading mode a
    lockout that cannot pin or tag, for no gain.
  - **Adding an RPC means classifying it.** `shared/__tests__/fileWriteMethods.test.ts` fails on any
    request that is in neither list, because a write nobody classified is one read-only lets through.
  - Known limit, accepted: `editable: false` (Tiptap) and `EditorState.readOnly` (CodeMirror) stop
    *input*, not a transaction dispatched by code. A programmatic mutation still moves the view; it
    just cannot reach disk, because `setTabContent` refuses and the gate refuses under that. Do not
    "fix" this by re-seeding the document from an effect — see Svelte rule 3.
- **`local.orbitlite.app` is not `local.markdown.app`.** Both apps hold their JSON stores in memory
  and write them back whole; one identifier would have them overwriting each other's tags, pins,
  and history. Ports are split for the same reason: 5373/5374 here, 5273/5274 there.

## Svelte

Three rules earned by bugs that produced no error message at all. Each cost hours.

1. **The store is mutated in place, never replaced.** `setState` does `Object.assign(state, patch)`
   on one `$state` proxy. The obvious port of the React store — `state = { ...state, ...patch }` —
   *worked*, right up until a spread carried a stale branch forward and **overwrote freshly typed
   text with the copy still on disk**, about a second after it was typed.

2. **An `$effect` that calls a store-writing function must `untrack` the call.** Functions like
   `bootstrap()`, `registerFindEngine()`, and `refreshBookmarks()` *read* the store while they run.
   Inside an effect those reads become dependencies, so the write re-invalidates the effect that
   made it:
   - `bootstrap()` in an `$effect` → every keystroke restarted startup and reloaded files from disk.
   - `registerFindEngine()` in an `$effect` → the find bar redrew hundreds of times a second.

   One-shot work goes in **`onMount`**. Work with real dependencies wraps its writer in **`untrack`**.

3. **Never `setContent` an editor from inside an `$effect`.** It runs a transaction storm while the
   component is still settling and the two never finish. The page locks up hard enough that
   evaluating an expression in it times out. Seed the document through the editor's constructor —
   the component is keyed on the file path, so another file gets another editor anyway.

Beyond those:

- Prefer `$derived` over `$effect` + local state. The React build's rule about never building an
  object inside a store selector **does not apply here** — runes have no snapshot to compare, so
  `$derived(getState().x.filter(…))` is fine and is the idiomatic form.
- Give a snippet prop a name that is not the prop it fills (`control={sliderAndReadout}`, not a
  snippet called `control`) and declare it *before* the component that takes it.

## UI

Every rule below is a default that has earned its place, not a law. **When one of them makes the
interface worse to use, the person using the app wins.** Change the rule in the same commit as the
code that broke it, and say what it cost.

- **Use shadcn-svelte** for interactive elements. Never a raw `<button>`, `<input>`, `<select>`, or
  `<textarea>` for user-facing controls. Add more with
  `npx shadcn-svelte@latest add <component>`.
- **The component style is `nova`** (`components.json`) — the compact preset: `h-8` controls,
  `rounded-lg`. Its CLI takes a *code*, not a name: `--preset b2fA` is nova + neutral + lucide.
  - `@import 'shadcn-svelte/tailwind.css'` in `app.css` is what declares the `data-active:` /
    `data-horizontal:` variants Nova's sources are written against. Remove it and every
    active/selected style silently stops applying, and nothing fails.
  - `Tooltip.svelte` is **ours**, not registry stock — a bespoke `label`/`shortcut` API. Never
    `add tooltip`; it would overwrite the component every toolbar uses. Its trigger wraps children
    in an `inline-flex` span rather than `display: contents`, which generates no box and never
    receives the hover that opens it.
  - Nova ships Geist. It is deliberately unused: `--font-ui` is the platform's own stack, because a
    webfont in the chrome is what makes a desktop app look like a web page.
- **Icons come from [Lucide](https://lucide.dev/icons)** (`@lucide/svelte`). No other icon set.
- **Colours come from tokens**, never literals. The palette is defined once in `src/app.css`;
  shadcn's semantic tokens are mapped onto it there.
  - The scale is **neutral** — a true grey, in oklch — and the chrome stays that way by default, so
    that the colour which *is* on screen is colour that means something.
  - The reader can swap that scale for one of shadcn-svelte's other base colours, and give the brand
    a hue, from **Settings → Appearance**. The presets are generated into `src/lib/themePresets.ts`
    (`bun scripts/gen-theme-presets.mjs`) and injected as a stylesheet by `src/lib/themeSkin.ts`.
    The default preset reproduces `app.css` value for value, which
    `__tests__/themeSkin.test.ts` asserts — a drift there is a flash of the wrong colour at launch.
    Anything new in the palette has to be added to the generator's ladder too, or it stays neutral
    while everything around it changes.
  - **Where restraint and legibility disagree, legibility wins.** Hue earns its place by naming a
    **state or a category the reader has to tell apart** — pinned, error, ok, a label's tint. Ask
    what fact it carries. "It looks nicer" is not one.
  - Anything that earns colour becomes a **semantic token named for the meaning rather than the
    hue**, defined in all three blocks (`:root`, the `prefers-color-scheme` block, and
    `[data-theme='dark']`), and used at *every* site that shows that meaning.
  - `--brand` is a **contrast step** first: near-black in light, near-white in dark, and still one
    end of the scale when an accent gives it a hue. It is written as a background *and* as a text
    colour, which is what fixes that — an accent chosen for a button would be invisible glyphs.
    Anything drawn *on* it uses `--brand-on`.
  - `--accent` is shadcn's *hover surface*. Do not conflate them.
  - **Never add a `--color-*` alias in `@theme` that shadcn already declares.** A later declaration
    in the same block silently wins. `__tests__/themeTokens.test.ts` fails if one appears.
- **Two font tokens, and they are not interchangeable.** `--font-ui` dresses every label, menu, and
  panel. `--font-prose` is Avenir Next and dresses the editor only — 17px on a 44rem measure at 1.75.
- Every surface must work in light **and** dark. Theme state lives in `src/lib/theme.svelte.ts`.
- **Two controls that write one boolean is a bug**, not a convenience. Before adding an affordance,
  check whether the flag behind it already has one.

## Editor

`src/lib/editor/` is two engines over one file.

- **Source** is CodeMirror 6, mounted by the `use:codemirror` action. Content is pushed in by
  `syncDocument` from an effect — *not* from the action's `update`, which re-runs whenever its
  parameter object is rebuilt and was reverting freshly typed text.
- **Rich** is [Edra](https://edra.tsuzat.com) over Tiptap. The extension list lives in
  `richExtensions.ts` rather than in Edra's `createEditor`, because `createEditor` *appends* to its
  own list — passing it ours registered everything twice and ProseMirror refused the second copy of
  a keyed plugin. One list, read by the app **and** the round-trip test.
- **The formatting bar is `RichToolbar.svelte`, ours, not `Edra.Toolbar`.** Edra's draws all
  thirty-four commands flat and overran the window into a horizontal scroll. Ours folds the
  mutually-exclusive groups into menus and looks each command up *by name* out of Edra's registry,
  so icons, shortcuts and `isActive` stay Edra's. A name that is not in the registry silently
  vanishes from the bar, so `__tests__/richToolbar.test.ts` checks both directions — every name the
  toolbar cites exists, and every command Edra registers is placed somewhere.
- **Both pieces of formatting chrome are settings**: `editorToolbarOpen` (off by default) and
  `editorBubbleMenuOpen` (on) — see `shared/types.ts` for why the defaults point opposite ways.
  Their one control is Settings → General; do not add a second.

Two invariants, both held by `editor/__tests__/roundTrip.test.ts`:

1. **Frontmatter is never owned by the editor.** Sliced off before parsing, re-attached verbatim.
   Serializing the body alone once dropped the YAML block on the first autosave — a file rewriting
   itself the moment it was opened.
2. **Serialization is idempotent.** A second save changes nothing, or every visit rewrites the
   document and pollutes the user's diff.

The round trip runs through `MarkdownManager`, not a live editor: it is the same parse/serialize
half `editor.getMarkdown()` delegates to, and it needs no view — a real editor in jsdom mounts every
Svelte node view, none of which have any say in what markdown comes out.

## Testing

```bash
bun run typecheck   # svelte-check
bun run test        # vitest run
```

Test the logic that can silently corrupt data — stores, path repair, ranking, markdown round trips.
Do not write tests that assert on styling.

Two tests exist purely because their contracts break *silently*: `dragRegion.test.ts` (Electrobun
resolves drag regions by literal class name) and `menuShortcuts.test.ts` (the native menu and the
browser build's key handler are two lists of the same bindings, and nothing connects them).

## Running

```bash
bun run dev          # desktop app + browser build at :5373, one owner of the stores
bun run dev:browser  # standalone browser path
bun run build:stable # DMG in artifacts/
```

Never add a second process that writes `store/`. Whoever owns the stores hosts the API.

**When verifying in a browser, restart the dev server and hard-reload before concluding anything.**
HMR on a `.svelte.ts` module holding `$state` can leave two instances of the store alive, and the
symptom is indistinguishable from a reactivity bug.
