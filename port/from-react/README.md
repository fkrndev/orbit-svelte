# Tests left behind by the port

Each of these was a passing test in the React build and is parked here rather
than deleted, because a parked test is a to-do and a deleted one is a decision
nobody remembers making.

| File | Why it is here | Status |
|---|---|---|
| `richFormattingToolbar.test.tsx` | Renders the BlockNote formatting toolbar with `@testing-library/react`. | **To port** — needs a Svelte component test against Edra's toolbar. |
| `collapsedSections.test.ts` | Covers `collapsedSections.ts`, which counts BlockNote *blocks*. | **Blocked** — collapsible headings are not implemented on Tiptap yet. |
| `dragRegion.test.ts` | Asserts `TitleBar.tsx` carries Electrobun's drag-region class names. | **To port** — the rule still matters; the file it reads is now `TitleBar.svelte`. |

`roundTrip.test.ts` used to sit here too. It is gone because it was *replaced*
rather than deferred: `src/lib/editor/__tests__/roundTrip.test.ts` makes the same
guarantees against the Tiptap extension set the app actually runs.
