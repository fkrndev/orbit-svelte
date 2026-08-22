# Orbit Lite — Plan Port ke SvelteKit + Edra

## Status (per 18 Agustus 2026) — **selesai**

| Fase | Status |
|---|---|
| F0 Scaffold | ✅ |
| F1 Backend (`src/shared` + `src/bun`) | ✅ |
| F2 Fondasi webview | ✅ |
| F3 Chrome (title bar, tab, dialog) | ✅ |
| F4 Sidebar | ✅ |
| F5 Editor raw (CodeMirror) | ✅ |
| F6 Editor rich (Edra) + round-trip | ✅ |
| F7 Home / dashboard | ✅ |
| F8 Inspector, properties, quick open, browser | ✅ |
| F9 Settings, menu, build, docs | ✅ |

`bun run typecheck` 0 error. `bun run test` 64 file / 782 test hijau. DMG terbangun di
`artifacts/stable-macos-arm64-OrbitLite.dmg`.

### Yang sengaja tidak ikut

| Tidak diport | Alasan |
|---|---|
| Collapsible heading sections | Khas BlockNote; belum ada padanannya di Tiptap. Test-nya di-park di `port/from-react/`. |
| Test toolbar formatting rich | Toolbar-nya sekarang milik Edra; test lama menguji milik BlockNote. |

Keduanya tercatat di `port/from-react/README.md` supaya jadi to-do, bukan keputusan yang tak
diingat siapa pun.

---

Port aplikasi **Orbit** (`/Users/macbookairm1/project/markdown-local`) ke `/Users/macbookairm1/project/orbit-lite`
dengan stack baru: **SvelteKit** untuk webview, **Edra** (Tiptap + shadcn-svelte) untuk rich editor.

Dokumen ini ditulis sebagai rencana dan disimpan apa adanya, termasuk bagian yang **ternyata
salah** — koreksinya ditandai di tempatnya masing-masing, karena tebakan yang meleset lebih berguna
kalau kelihatan daripada dihapus.

---

## 0. Keputusan yang sudah diambil

| Topik | Keputusan | Konsekuensi |
|---|---|---|
| Runtime | **Electrobun + SvelteKit static (SPA)** | Tetap desktop app macOS. Seluruh `src/bun/` dipakai ulang hampir apa adanya. |
| Scope | **Full parity** | Semua fitur ikut: Home/frecency, inspector properties, bookmarks, todo inbox, labels/tags, settings, mermaid, katex, path browser. |
| Editor | **Edra (rich) + CodeMirror 6 (raw)** | Markdown tetap format penyimpanan. `⌘/` tetap ada. |
| UI kit | **[shadcn-svelte](https://shadcn-svelte.com/)** | Semua kontrol interaktif dari sini. Edra juga dibangun di atasnya, jadi satu sistem, bukan dua. |

Konsekuensi ketiganya digabung: yang berubah **cuma lapisan webview**. Backend, kontrak RPC, dan
seluruh logika murni ikut pindah tanpa ditulis ulang.

---

## 1. Yang sebenarnya kita hadapi

Angka dari source (tanpa file test):

| Lapis | LOC | File | Nasib di orbit-lite |
|---|---:|---:|---|
| `src/shared/` | 3.058 | 20 | **Copy apa adanya** — TypeScript murni, nol dependensi framework |
| `src/bun/` (+22 service) | 3.811 | 28 | **Copy, ubah 4 titik** — lihat §4 |
| `src/mainview/` non-editor | 14.389 | 66 komponen + 20 modul | **Tulis ulang React → Svelte 5** |
| `src/mainview/editor/` | 7.140 | 60 | **Campur** — lihat §5, ini bagian paling berat |
| Test (`__tests__`) | 6.826 | 45 file | Mayoritas ikut apa adanya (Vitest tetap dipakai) |

Artinya kira-kira **6.900 LOC pindah gratis** (shared + bun), **~21.500 LOC harus ditulis ulang atau
diadaptasi**. Ini bukan pekerjaan sekali duduk — makanya dipecah jadi 10 fase di §7.

Aset non-kode yang ikut: `assets/` (icon), `icon.iconset/`, `scripts/build-icons.sh`,
`.github/workflows/ci.yml`, `LICENSE` (AGPL-3.0-or-later), `NOTICE`, `docs-id/ARCHITECTURE.md`.

---

## 2. Arsitektur target

```
orbit-lite/
├── electrobun.config.ts        # sama, kecuali identifier + copy path (§4.1)
├── svelte.config.js            # adapter-static, SPA fallback, paths relative
├── vite.config.ts              # sveltekit() + tailwindcss(), proxy /api ke :5274
├── components.json             # shadcn-svelte, baseColor neutral
├── src/
│   ├── shared/                 # ⟵ copy 1:1 dari source
│   ├── bun/                    # ⟵ copy, 4 titik diubah
│   └── mainview/               # ⟵ SvelteKit app (src/routes + src/lib)
│       ├── app.html
│       ├── app.css             # ⟵ index.css dipindah, token palette identik
│       ├── routes/+layout.svelte
│       ├── routes/+layout.ts   # ssr=false, prerender=false, csr=true
│       ├── routes/+page.svelte # shell aplikasi (bekas App.tsx)
│       └── lib/
│           ├── store.svelte.ts # runes, pengganti useSyncExternalStore
│           ├── rpcClient.ts    # ⟵ copy 1:1, nol perubahan
│           ├── actions.ts      # ⟵ copy, hanya import store diganti
│           ├── components/     # .svelte
│           ├── components/ui/  # shadcn-svelte
│           └── editor/         # Edra + CodeMirror
└── dist/                       # output build, disalin ke bundle Electrobun
```

Batas yang tidak boleh dilanggar (dibawa dari `AGENTS.md` source):

- Hanya `src/bun/` yang menyentuh filesystem. Webview cuma lewat `src/shared/rpc.ts`.
- Aturan yang melindungi file user (mis. `rename.ts`) tinggal di `src/shared/`, dijalankan **dua kali** —
  di UI dan di handler.
- Webview tidak boleh `import 'electrobun'` di luar `rpcClient.ts`.
- Kapabilitas baru = tambah di `AppRPCRequests` → implementasi di `handlers.ts`. Desktop dan browser
  build otomatis dapat.

---

## 3. Kenapa SvelteKit ini gampang di sini

Tiga hal yang kebetulan sangat cocok:

1. **SvelteKit pakai Vite.** Proxy `/api` → `localhost:5274` dengan penanganan SSE di source tinggal
   dipindah ke `vite.config.ts` yang baru. Nol riset.
2. **`rpcClient.ts` nol impor React.** File ini adalah satu-satunya pintu ke filesystem dan bisa
   di-copy karakter per karakter.
3. **Store-nya sudah "external store".** `getState/setState/subscribe` di `store.ts` persis pola yang
   di Svelte 5 jadi `$state` di file `.svelte.ts`. Malah jadi **lebih sederhana** — aturan paling
   berbahaya di source ("jangan bikin object/array baru di dalam selector `useAppState`, window jadi
   blank") **hilang total** karena Svelte tidak membandingkan snapshot by reference.

---

## 4. `src/bun/` — 4 titik yang berubah

Sisanya (22 service: watcher, frecency, meta, history, todosIndex, tagIndex, search, trash,
propertySchema, jsonStore, dll.) copy apa adanya.

### 4.1 `paths.ts` — **WAJIB ganti identifier**

Source memakai `APP_IDENTIFIER = 'local.markdown.app'`. Kalau ini dibiarkan, orbit-lite akan
**menulis ke store yang sama** dengan Orbit yang asli: dua proses, satu direktori JSON, saling
menimpa tag/history/roots. Ganti ke `local.orbitlite.app` (dan `identifier` yang sama di
`electrobun.config.ts`). Efeknya orbit-lite mulai dari nol — itu memang yang kita mau.

### 4.2 `index.ts` — URL dev server

`DEV_SERVER_URL = 'http://localhost:5273'` tetap bisa dipakai; cukup pastikan SvelteKit dev jalan di
port 5273 (`vite.config.ts` → `server.port: 5273, strictPort: true`).

### 4.3 `menu.ts` — tanpa perubahan logika

Native menu mengirim `MenuCommand` lewat `webview.messages`. Daftar command tidak berubah, jadi
file ini copy apa adanya. Yang berubah cuma sisi penerimanya di Svelte.

### 4.4 `apiServer.ts` / `devServer.ts`

Copy apa adanya. Satu catatan operasional yang dibawa dari source: **jangan pernah menjalankan dua
proses yang menulis `store/`**. `bun run dev` (desktop) sudah menghosting API-nya sendiri;
`bun run dev:browser` adalah jalur standalone. Pilih satu.

---

## 5. Editor — bagian paling berisiko

`src/mainview/editor/` (7.140 LOC) tidak homogen. Klasifikasi berdasarkan impor sebenarnya:

### 5a. Terikat BlockNote → **harus ditulis ulang untuk Tiptap/Edra** (14 file)

`RichEditor.tsx`, `RichFormattingToolbar.tsx`, `RichSlashMenu.tsx`, `RichLinkToolbar.tsx`,
`CollapsibleSideMenu.tsx`, `ColorGridButton.tsx`, `IndentMenuButton.tsx`, `TextAlignMenuButton.tsx`,
`toolbarMenu.tsx`, `schema.tsx`, `blockResolution.ts`, `codeBlockOptions.ts`, `collapsedSections.ts`
(738 LOC), `richEditorMarkdown.ts`.

Kabar baiknya: **Edra sudah membawa sebagian besar dari daftar ini secara built-in** — slash command,
formatting toolbar, link toolbar, drag-handle/side menu, color picker, table, code block dengan
syntax highlighting, KaTeX, dan Mermaid. Jadi ini lebih ke *memetakan* fitur ke Edra daripada
menulis dari nol. Yang tetap harus kita tulis sendiri: `collapsedSections` (heading yang bisa
dilipat) dan `blockResolution` (markdown → node, arah masuk).

### 5b. Terikat CodeMirror → **port React hook → Svelte action** (8 file)

`RawEditor.tsx`, `useCodeMirror.ts` (298), `useCodeMirrorFindEngine.ts`, `useCodeMirrorTodoEngine.ts`,
`markdownHighlight.ts`, `frontmatterHighlight.ts`, `editorFindHighlight.ts`, `zoomCursorFix.ts`.

Logika CodeMirror-nya (extension, decoration, state field) **tidak berubah sama sekali** — CodeMirror
6 tidak peduli framework. Yang diubah cuma pembungkusnya: `useEffect` + `ref` jadi Svelte `action`
(`use:codemirror`) atau `$effect` di dalam komponen. Ini port paling mudah dari ketiga kategori.

### 5c. TypeScript murni → **copy apa adanya** (~35 file)

`compact-markdown.ts`, `mathMarkdown.ts` (489), `mermaidMarkdown.ts`, `mermaidRender.ts`,
`mermaidSvgLayout.ts`, `mermaidZoom.ts`, `durableMarkdownBlocks.ts` (298), `markdownHighlightMarkdown.ts`,
`frontmatter.ts`, `editorFind.ts`, `editorFindEngine.ts`, `findResultRows.ts`, `arrowLigatures.ts`,
`safeRegex.ts`, `regexCapabilities.ts`, `assetUrls.ts`, `gotoHeading.ts`, `codeBlockLanguageCatalog.ts`,
`recentColors.ts`, `editorBlockRepair.ts`, dll. — plus seluruh `__tests__`-nya.

⚠️ **Catatan penting:** file di 5c ini "murni" dari sisi framework, tapi beberapa di antaranya
beroperasi di atas **bentuk JSON block milik BlockNote** (`durableMarkdownBlocks`, `mathMarkdown`,
`markdownHighlightMarkdown`, `editorBlockRepair`). Tiptap punya bentuk JSON sendiri
(`{type, attrs, content[]}` ProseMirror). Jadi file-file ini di-copy tapi **lapisan "bentuk block"-nya
harus di-retarget** ke node ProseMirror. Ini risiko teknis nomor satu di seluruh proyek.

### 5d. Strategi markdown round-trip

Dua invariant dari `AGENTS.md` yang **tidak boleh pecah**, dan keduanya sudah punya test
(`editor/__tests__/roundTrip.test.ts`):

1. **Frontmatter tidak pernah dimiliki editor.** Dipotong sebelum parse, ditempel kembali verbatim.
2. **Parse gagal ≠ file kosong.** Fallback ke paragraf polos (`markdownParseFallback.ts`).

Plus: serialisasi harus **idempoten** — save kedua tidak mengubah apa pun.

Rencana:

- Base serializer: **`@tiptap/extension-markdown`** (Tiptap tidak punya markdown serializer bawaan).
  Edra sendiri mendokumentasikan ini sebagai cara mendapat markdown in/out.
- Di atasnya, port pipeline "durable blocks" dari source: mermaid dan math dilewatkan sebagai fenced
  content yang keluar **byte-identical**, bukan diserialisasi ulang oleh Tiptap.
- `compact-markdown.ts` (normalisasi output: tight list, bullet `-`, decode entity, kolaps blank line)
  tetap dipakai sebagai post-processor — tapi aturannya ditulis untuk output BlockNote, jadi perlu
  ditinjau terhadap output Tiptap. Kemungkinan besar sebagian aturannya jadi no-op.

**Cara kerja yang diwajibkan untuk fase editor:** port `roundTrip.test.ts` + korpus fixture-nya
**duluan**, biarkan merah, lalu bangun sampai hijau. Jangan pernah menulis serializer sambil
mengarang ekspektasi.

---

## 6. UI & desain — apa yang berubah dan apa yang tidak

### Yang identik (jangan diutak-atik)

- **Token warna.** Seluruh palette di `src/mainview/index.css` (427 LOC) — oklch, base neutral —
  pindah apa adanya ke `app.css`. Termasuk semantic token seperti `--pinned`, `--brand`/`--brand-on`,
  dan reset border Tailwind v4 (`currentColor` → `var(--border)`).
- **Dua font token.** `--font-ui` (stack OS, untuk chrome) dan `--font-prose` (Avenir Next, 17px,
  measure 44rem, line-height 1.75 — editor saja). Tidak boleh tertukar.
- **Aturan warna.** Hue hanya untuk *state atau kategori yang harus dibedakan pembaca*. Setiap yang
  dapat warna jadi semantic token yang dinamai menurut makna, dideklarasikan di ketiga blok
  (`:root`, `prefers-color-scheme`, `[data-theme='dark']`).
- **Lucide** sebagai satu-satunya icon set (`@lucide/svelte`).

### shadcn-svelte — setup dan pemetaan komponen

Aturan yang dibawa dari `AGENTS.md` source dan **tetap berlaku**: jangan pernah `<button>`, `<input>`,
`<select>`, atau `<textarea>` mentah untuk kontrol yang dilihat user. Selalu komponen shadcn-svelte.

```bash
npx shadcn-svelte@latest init          # baseColor: neutral, css: src/mainview/app.css
npx shadcn-svelte@latest add <nama>
npx shadcn-svelte@latest add https://edra.tsuzat.com/r/edra.json
```

`components.json` yang dituju (padanan dari source, disesuaikan ke Svelte):

```jsonc
{
  "tailwind": { "css": "src/mainview/app.css", "baseColor": "neutral" },
  "aliases": {
    "components": "$lib/components",
    "ui": "$lib/components/ui",
    "utils": "$lib/utils",
    "hooks": "$lib/hooks"
  },
  "registry": "https://shadcn-svelte.com/registry"
}
```

Source memakai 15 komponen UI. **Kelimabelasnya ada di shadcn-svelte** — nol yang perlu ditulis dari nol:

| Source (`components/ui/*.tsx`) | shadcn-svelte |
|---|---|
| button, input, textarea, badge, checkbox, switch | ✅ sama namanya |
| dialog, popover, select, dropdown-menu | ✅ sama namanya |
| slider, toggle, toggle-group, calendar | ✅ sama namanya |
| tooltip | ⚠️ dipasang, **lalu diganti** — lihat di bawah |

Tiga perbedaan teknis di balik nama yang sama:

- **Primitive-nya `bits-ui`, bukan `radix-ui`.** API-nya mirip tapi tidak identik. Yang penting:
  keruwetan `data-active:` vs `data-state="active"` di source **tidak ada** di sini, jadi `@import
  'shadcn/tailwind.css'` tidak diperlukan dan `themeTokens.test.ts` jadi lebih sederhana.
- **`calendar` bukan `react-day-picker`.** shadcn-svelte pakai `bits-ui` + `@internationalized/date`.
  `DateValue.tsx` dan `PropertyEditor.tsx` di inspector menyentuh ini, jadi ada penulisan ulang kecil
  di F8 — tanggal frontmatter tetap disimpan sebagai string, jangan sampai berubah jadi objek Date
  yang direformat saat save.
- **Icon: `@lucide/svelte`**, konsisten dengan shadcn-svelte dan dengan aturan "cuma Lucide".

**`tooltip` adalah pengecualian.** Di source ia bespoke (API `label`/`shortcut`), dipanggil hampir
semua toolbar. Rencana: `add tooltip` untuk dapat primitive-nya, lalu bungkus jadi `Tooltip.svelte`
dengan API `label`/`shortcut` yang sama supaya call site tidak perlu diubah — dan setelah itu
**jangan pernah `add tooltip` lagi**, karena akan menimpa komponen yang dipakai semua orang.

Satu jebakan dari source yang perlu dicek ulang di Svelte: membungkus trigger stateful dengan
`Tooltip` bisa menimpa `data-state`-nya. Kalau kejadian di `bits-ui` juga, kendalikan styling
selected dari state komponen, bukan dari selector `data-[state=on]:`.

### Yang berbeda, dan harus diterima

- ~~shadcn-svelte tidak punya `radix-nova`.~~ **Salah — dikoreksi saat F0.** shadcn-svelte punya
  preset **`nova`**: "Reduced spacing for compact layouts", icon Lucide. Itu padanan langsung
  `radix-nova`, jadi proporsi kontrol tetap ringkas seperti aslinya.
  - Jebakan CLI: `--preset` **tidak menerima nama**, ia menerima kode base62 dari
    `shadcn-svelte.com/create`. Kode untuk nova+neutral+lucide adalah **`b2fA`**
    (dihasilkan dari `encodePreset` yang diekspor `shadcn-svelte/preset`).
- ~~Keruwetan `@import 'shadcn/tailwind.css'` tidak ada di shadcn-svelte.~~ **Juga salah.**
  Preset nova tetap butuh `@import 'shadcn-svelte/tailwind.css'` untuk mendeklarasikan varian
  `data-active:`/`data-horizontal:`. Hapus, dan setiap styling active/orientation diam-diam mati —
  sama persis seperti di source. Catatan panjangnya sudah ada di `app.css`.
- Nova ikut membawa font **Geist**. Sengaja tidak dipakai: `--font-ui` tetap stack UI milik OS,
  karena webfont di chrome justru yang bikin desktop app terlihat seperti halaman web.
- `tooltip.tsx` di source adalah komponen **bespoke** (API `label`/`shortcut`), bukan registry stock.
  Ini ditulis ulang sebagai `Tooltip.svelte` dengan API yang sama, karena hampir semua toolbar
  memanggilnya begitu.
  - Satu perbedaan yang perlu dicatat: trigger-nya membungkus anak dengan `<span class="inline-flex">`,
    **bukan** `display: contents`. `contents` tidak menghasilkan kotak, jadi hover tidak pernah
    mendarat dan tooltip tidak pernah muncul.

### Dua aturan Svelte yang mahal didapat (F2–F5)

Keduanya ditemukan lewat bug nyata, bukan teori, dan keduanya adalah kelas kesalahan yang akan
terulang di fase berikutnya:

1. **Store dimutasi di tempat, jangan diganti utuh.** Versi pertama `setState` menulis
   `state = { ...state, ...patch }` (bentuk yang memang dibutuhkan React). Dengan proxy `$state`,
   spread itu bisa membawa cabang basi maju dan **menimpa teks yang baru diketik dengan isi file
   yang masih di disk** — hilang sekitar satu detik setelah diketik, tanpa satu pun error.
   Sekarang: `const state = $state(...)` + `Object.assign(state, patch)`.

2. **`$effect` yang memanggil fungsi penulis-store wajib `untrack`.** Fungsi seperti `bootstrap()`,
   `registerFindEngine()`, dan `refreshBookmarks()` *membaca* store sambil berjalan. Di dalam
   `$effect`, bacaan itu jadi dependensi, jadi tulisannya menginvalidasi effect-nya sendiri:
   - `bootstrap()` di `$effect` → tiap ketikan memulai ulang startup dan memuat ulang file dari disk.
   - `registerFindEngine()` di `$effect` → find bar redraw ratusan kali/detik dan tak pernah settle.

   Aturannya: yang sekali jalan pakai **`onMount`**; yang perlu dependensi eksplisit bungkus
   panggilan penulisnya dengan **`untrack`**.

### Yang ternyata jauh lebih mudah dari dugaan (F6)

Risiko nomor satu di plan ini — "retarget pipeline durable-block dari BlockNote ke ProseMirror" —
**tidak perlu dikerjakan sama sekali.** Edra sudah membawa `@tiptap/markdown`, dan round-trip
lolos 9/9 di percobaan pertama untuk gambar, link relatif, fence berikut bahasanya, checklist,
blockquote, tabel, dokumen kosong, frontmatter, dan idempotensi. Yang tersisa cuma `compactMarkdown`
sebagai post-processor — modul yang memang sudah ikut pindah.

Tiga jebakan nyata yang menggantikannya:

1. **`createEditor` Edra menambahkan list-nya sendiri.** Memberinya `richExtensions()` mendaftarkan
   setiap extension dua kali; ProseMirror lalu menolak salinan kedua dari plugin ber-key dan editor
   gagal dibuat. Solusinya `useEditor({ extensions: richExtensions(...) })` — satu list, dipakai
   app **dan** test.
2. **`setContent` di dalam `$effect` membekukan halaman.** Bukan lambat — benar-benar hang sampai
   `Runtime.evaluate` pun timeout. Dokumen awal di-seed lewat konstruktor editor; komponennya sudah
   di-`{#key}` per path, jadi file lain memang dapat editor baru.
3. **Serialisasi body-only menghapus frontmatter.** `handleUpdate` sempat mengirim body saja, jadi
   begitu file dibuka di rich mode ia menandai dirinya dirty lalu menulis ulang **tanpa blok YAML**.
   Ini kehilangan data, dan hanya ketahuan karena tesnya menengok isi file di disk, bukan cuma DOM.

Catatan kecil: round-trip diuji lewat `MarkdownManager`, bukan `Editor` hidup — node view Svelte
milik Edra (mermaid, media placeholder) tidak bisa mount di jsdom, dan tak satu pun dari mereka
punya suara soal markdown yang keluar.

### Catatan operasional

- **Port dipisah dari Orbit asli**: vite `5373`, API `5374` (asli: 5273/5274), env
  `ORBIT_LITE_API_PORT` / `ORBIT_LITE_CHANNEL`. Tanpa ini dua app rebutan port dan — lebih buruk —
  request orbit-lite dijawab store milik Orbit asli.
- **`kit.paths.relative` tidak berlaku untuk SPA fallback.** Adapter tetap menulis `/_app/...`
  absolut, yang di dalam bundle (`views://mainview/index.html`) tidak resolve. Diperbaiki oleh
  `scripts/relative-asset-paths.mjs` yang jalan setelah `vite build` dan **gagal keras** kalau masih
  ada referensi absolut.
- **`@types/node` 17 yang ter-hoist** dari dependensi transitif bentrok dengan `@types/bun` dan
  bikin 5 error `Buffer`. Diselesaikan dengan memasang `@types/node@^26` di root.
- Saat verifikasi di browser: **selalu restart dev server + hard reload sebelum menyimpulkan**.
  HMR pada modul `.svelte.ts` ber-`$state` bisa menyisakan dua instance store, dan gejalanya
  persis seperti bug reaktivitas.

### Aturan Svelte pengganti aturan React

| Aturan React di source | Padanan Svelte 5 |
|---|---|
| `useAppState(selector)`, dilarang bikin object baru di selector | `store.svelte.ts` dengan `$state`; derive pakai `$derived` — masalahnya tidak ada |
| `useEffect(() => …, [dep])` | `$effect` |
| `useMemo` | `$derived.by` |
| `useCallback` | fungsi biasa |
| `useState` lokal | `let x = $state(…)` |
| ref + imperative handle (editor) | Svelte `action` (`use:…`) |
| `TooltipProvider` di root | context Svelte, atau tidak perlu sama sekali |

Satu aturan dari source yang **tetap berlaku dan bukan soal framework**: *"Dua kontrol yang menulis
satu boolean itu bug, bukan kemudahan."* Sebelum menambah affordance, cek dulu flag di belakangnya
sudah punya satu belum.

---

## 7. Fase kerja

Setiap fase punya kondisi selesai yang bisa dijalankan, bukan "kelihatannya benar". Urutannya
disusun supaya ada yang jalan sedini mungkin, dan supaya risiko terbesar (editor) tidak ketemu di
akhir waktu sudah tidak ada ruang.

### F0 — Rangka proyek
- `bun create svelte` (atau `sv create`) di `orbit-lite`, TypeScript, tanpa contoh.
- `svelte.config.js`: `adapter-static` + `fallback: 'index.html'`, `paths.relative: true` (wajib —
  Electrobun memuat dari `views://mainview/index.html`, semua URL harus relatif).
- `+layout.ts`: `export const ssr = false; export const prerender = false;` → SPA murni.
- `vite.config.ts`: `sveltekit()`, `@tailwindcss/vite`, `define.__APP_VERSION__`, `build.outDir: 'dist'`,
  `build.target: 'safari18'`, `server.port: 5273 strictPort`, proxy `/api` → `:5274` dengan
  penanganan header SSE (`cache-control: no-cache, no-transform` — kalau tidak, stream file-change
  tidak pernah sampai).
- shadcn-svelte init (`neutral`, css → `src/mainview/app.css`), alias `@/*` di `svelte.config.js`,
  lalu `add` 15 komponen di §6 + `add https://edra.tsuzat.com/r/edra.json`. Icon `@lucide/svelte`.
- Salin `LICENSE`, `NOTICE`, `assets/`, `icon.iconset/`, `scripts/build-icons.sh`.
- **Selesai kalau:** `bun run dev` menyajikan halaman kosong di `localhost:5273`, `bun run typecheck` hijau.

### F1 — Backend hidup duluan
- Copy `src/shared/` dan `src/bun/` apa adanya.
- Terapkan 4 perubahan di §4 (identifier baru!).
- `electrobun.config.ts`: nama `Orbit Lite`, identifier `local.orbitlite.app`, copy `dist/index.html`
  → `views/mainview/index.html` dan `dist/_app` → `views/mainview/_app` (perhatikan: SvelteKit
  mengeluarkan `_app/`, bukan `assets/` — path copy di config **harus** disesuaikan, ini gampang
  terlewat dan bikin jendela putih tanpa error).
- Copy seluruh `src/shared/__tests__/` (16 file) dan `src/bun/services/__tests__/` (9 file).
- **Selesai kalau:** `bun run test` hijau untuk 25 file test itu, dan `bun run dev:browser` menyalakan
  API di :5274 yang menjawab `POST /api/rpc {"method":"listRoots"}`.

### F2 — Fondasi webview
- `app.css` = `index.css` source, token identik. Test `themeTokens.test.ts` ikut.
- `store.svelte.ts`: `AppState` (struktur sama persis, termasuk `Tab`, `Surface`, `FindState`),
  helper `activeTab/updateTab/retargetTab/retargetFolder/resetNavHistory/forgetNavPath/isDirty/notify`.
- Copy `rpcClient.ts`, `navHistory.ts`, `tree.ts`, `navigation.ts`, `layout.ts`, `typography.ts`,
  `theme.ts`, `format.ts`, `find.ts`, `revealPending.ts`, `quickOpenPath.ts`, `sidebar.ts`,
  `properties.ts`, `homeData.ts`, `todoEngine.ts`, `actions.ts` (862 LOC — hanya import store diganti).
- `+page.svelte`: shell dari `App.tsx` — bootstrap, `onFileChange`, `onMenuCommand`, drag-drop dari
  Finder (`text/uri-list`), shortcut browser-mode, boot screen.
- **Selesai kalau:** app boot, tema light/dark jalan, test `navHistory/tree/navigation/layout/theme/
  typography/format/homeData/quickOpenPath` hijau.

### F3 — Chrome: TitleBar, TabBar, Notice, dialog
- `TitleBar.svelte` (426 LOC di source — panel toggle, drag region, nav back/forward),
  `TabBar.svelte`, `Notice.svelte`, `Tooltip.svelte` (bespoke), `ResizeHandle.svelte`,
  `RenameDialog`, `DeleteDialog`, `AddFolderDialog`, `ConflictBanner`, `OrbitMark`.
- **Selesai kalau:** window bisa dibuka, tab bisa ditutup/pindah, `dragRegion.test`, `closeTabs.test`,
  `saveAllTabs.test` hijau.

### F4 — Sidebar
- `Sidebar.svelte` + `sidebar/`: `FilesPanel` (531 LOC), `RecentsPanel` (320), `BookmarksPanel` (356),
  `FindResultsPanel`, `FilterField`, `SidebarRow`, `IconPicker`, `icons`, `rowMenus`.
- **Selesai kalau:** tree lazy jalan, filter server-side (`filterTree`) jalan, Expand All jalan,
  `tree.test`, `sidebarFilterFocus.test`, `collapseEverything.test` hijau.

### F5 — Editor raw (CodeMirror) — **prioritas sebelum rich**
- Port 5b: `useCodeMirror` → action, `RawEditor.svelte`, find engine, todo engine, highlight
  markdown/frontmatter, zoom cursor fix.
- `EditorSurface.svelte` yang untuk sementara **hanya** punya raw mode.
- **Selesai kalau:** buka file → edit → save → byte di disk benar; conflict/missing banner jalan;
  ⌘F find & replace jalan.

Alasan urutan ini: begitu F5 selesai, orbit-lite sudah jadi **editor markdown yang berguna**, dan
sisa risiko terkonsentrasi di satu tempat.

### F6 — Editor rich (Edra) — fase paling berat
1. Port `roundTrip.test.ts` + fixture-nya duluan. Biarkan merah.
2. Pasang Edra, susun extension set, tambah `@tiptap/extension-markdown`.
3. Retarget lapisan durable-blocks dari block BlockNote → node ProseMirror
   (`durableMarkdownBlocks`, `mathMarkdown`, `mermaidMarkdown`, `markdownHighlightMarkdown`).
4. Frontmatter: potong sebelum parse, tempel verbatim sesudah serialisasi.
5. Fallback parse gagal → paragraf polos.
6. `compact-markdown` sebagai post-processor, aturannya ditinjau ulang terhadap output Tiptap.
7. Node kustom: mermaid (dengan zoom), math/KaTeX, collapsed heading sections.
8. Paste image → `saveAsset` → link relatif ke `assets/` di sebelah note.
9. ⌘K → **relative markdown link** (bukan wikilink — ini prinsip, bukan preferensi).
- **Selesai kalau:** `roundTrip.test.ts` hijau, dan save kedua atas file yang sama menghasilkan diff
  kosong (idempoten) untuk seluruh korpus fixture.

### F7 — Home / dashboard
- `Home.svelte` + `home/`: `ContinueCards`, `TodoInbox`, `PlacesPanel`, `MarkedPanel`.
- Ditopang service yang sudah ada (`frecency`, `history`, `todosIndex`, `tagIndex`) — nol kerja backend.
- **Selesai kalau:** `homeData.test` hijau, klik task melompat ke baris yang benar di file yang belum
  terbuka (`pendingReveal.test`).

### F8 — Inspector, properties, quick open, path browser
- `InspectorPane` + `inspector/`: `PropertiesPanel` (485), `PropertyEditor` (373), `PropertyRow` (265),
  `ChoiceValue`, `DateValue`, `InfoTab`, `InfoPanel`, `propertyChrome`.
- `TableOfContents`, `TodosPanel`, `FindBar`, `IncomingLinksDialog`, `LinkFileDialog`.
- `QuickOpen` (⌘P), `PathPicker`, `FileBrowser` (881 LOC — surface, bukan modal; ia menyimpan folder,
  query, dan scroll-nya).
- **Selesai kalau:** edit frontmatter lewat inspector tidak pernah mereformat/mengurutkan ulang key
  lain (line surgery); `properties.test`, `inspectorTab.test`, `browseNewNote.test` hijau.

### F9 — Settings, menu native, build, dokumentasi
- `Settings` + 6 seksi: `General`, `Folders`, `Typography`, `SidebarSettings`, `Shortcuts`, `About`.
- Verifikasi `menu.ts` ↔ shortcut browser-mode masih sinkron (dua daftar, gampang melenceng).
- `bun run build:canary` / `build:stable`, DMG, icon dari `assets/icon-macos.svg`.
- Tulis `AGENTS.md` versi orbit-lite (aturan Svelte, bukan React) + `README.md`.
- **Selesai kalau:** `bun run typecheck` + `bun run test` hijau, DMG terpasang dan membuka file.

---

## 8. Risiko, diurut dari yang paling mungkin menggigit

1. **Round-trip markdown BlockNote → Tiptap.** Pipeline durable-block adalah bagian tersulit dari
   codebase dan satu-satunya yang bisa **merusak file user diam-diam**. Mitigasi: test-first, dan
   gate idempotensi di F6.
2. **Path copy Electrobun (`assets/` → `_app/`).** Salah di sini = jendela putih tanpa pesan error.
   Cek di F1, jangan tunggu F9.
3. **Identifier store yang sama.** Kalau lupa diganti, orbit-lite dan Orbit asli saling menimpa
   tag/history. Ini kerusakan data pada aplikasi yang sudah dipakai.
4. **Fitur Edra tidak 1:1 dengan BlockNote.** Beberapa perilaku (collapsible heading, side menu
   alignment, indent menu) mungkin harus ditulis sendiri di atas Tiptap. Baru ketahuan pasti setelah
   F6 dimulai — kalau ada yang ternyata mahal, laporkan, jangan diam-diam dihilangkan.
5. **`radix-nova` tidak ada di shadcn-svelte.** Sudah dibahas di §6. Ini perbedaan visual yang
   diterima, bukan bug.
6. **Patch dependency.** Source mem-patch `@blocknote/core`, `@blocknote/react`, `@blocknote/code-block`,
   dan `prosemirror-tables@1.8.5`. Tiga yang pertama gugur bersama BlockNote. Patch
   `prosemirror-tables` **perlu ditinjau** — Tiptap juga memakai `prosemirror-tables`, jadi bug yang
   ditambal itu mungkin masih relevan.

---

## 9. Perintah yang akan tersedia

```bash
bun run dev          # desktop app + browser build di :5273, satu pemilik store
bun run dev:browser  # standalone, tanpa Electrobun
bun run typecheck    # tsc --noEmit
bun run test         # vitest run — BUKAN `bun test` (runner-nya tanpa jsdom)
bun run build:stable # DMG
```

---

## 10. Yang perlu dikonfirmasi sebelum mulai

1. **Nama & identifier.** Rencana: nama app `Orbit Lite`, identifier `local.orbitlite.app`. Setuju?
2. **Lisensi.** Source AGPL-3.0-or-later. Port ini turunan langsung, jadi defaultnya ikut AGPL +
   `NOTICE` yang mencantumkan Orbit dan tolaria. Konfirmasi kalau maunya lain.
3. **Urutan mulai.** Rencana di atas mulai dari F0→F1→F2. Kalau mau lihat hasil visual lebih cepat,
   bisa dibalik: F0 → F2 (shell + tema) → F1. Tapi tanpa backend tidak ada yang bisa dibuka, jadi
   aku sarankan urutan asli.
