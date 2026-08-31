<script lang="ts">
  import AlignLeft from '@lucide/svelte/icons/align-left'
  import CaseSensitive from '@lucide/svelte/icons/case-sensitive'
  import Clock from '@lucide/svelte/icons/clock'
  import Code from '@lucide/svelte/icons/code'
  import ListIndentIncrease from '@lucide/svelte/icons/list-indent-increase'
  import Pilcrow from '@lucide/svelte/icons/pilcrow'
  import WholeWord from '@lucide/svelte/icons/whole-word'
  import type { Component } from 'svelte'
  import type { FileInfo } from '$shared/types'
  import { extractEditorBody } from '$shared/frontmatter'
  import { api } from '@/rpcClient'
  import {
    absoluteDate,
    countCharacters,
    countLines,
    countParagraphs,
    countWords,
    detectIndent,
    formatBytes,
    readingTime,
  } from '@/format'
  import { isMarkdownName } from '$shared/rename'
  import { codeLanguageFor } from '@/editor/codeLanguage'

  /**
   * What the file is, as opposed to what we have recorded about it.
   *
   * The statistics are computed from the buffer rather than fetched, so they move
   * as you type — a saved-only number would sit there looking stale and wrong
   * halfway through a paragraph. Dates come from the filesystem, and are refetched
   * on save because that is the only moment they change.
   *
   * The four counts sit in cards and the rest in rows, which is a claim about
   * attention: how much you have written is what a writer glances over for, and
   * when the file was last touched is what they go looking for.
   *
   * A code file gets a different four, because the question is a different one.
   * Read time and paragraph count are answers about prose, and over a `.ts` file
   * they are not wrong so much as meaningless — nobody reads source at 200 words
   * a minute. Lines, language, and indent are what you check before typing into
   * a file someone else wrote. The rows underneath are the same either way:
   * size and dates belong to the file, not to what is in it.
   */
  let { path, content, mtimeMs }: { path: string; content: string; mtimeMs: number } = $props()

  let info = $state<FileInfo | null>(null)

  $effect(() => {
    // `mtimeMs` is a dependency on purpose: a save is the only moment the
    // filesystem's own dates change.
    void mtimeMs
    let live = true
    api
      .fileInfo({ path })
      .then(next => live && (info = next))
      .catch(() => live && (info = null))
    return () => {
      live = false
    }
  })

  const markdown = $derived(isMarkdownName(path))

  // Size is of the file, so it counts the frontmatter the reader would see on
  // disk rather than the body the editor shows.
  const size = $derived(formatBytes(new TextEncoder().encode(content).length))

  type Card = {
    icon: Component<{ size?: number; strokeWidth?: number; class?: string; style?: string }>
    label: string
    value: string
  }

  const proseCards = $derived.by((): Card[] => {
    const body = extractEditorBody(content)
    const words = countWords(body)
    return [
      { icon: WholeWord, label: 'Words', value: words.toLocaleString() },
      { icon: CaseSensitive, label: 'Characters', value: countCharacters(body).toLocaleString() },
      { icon: Pilcrow, label: 'Paragraphs', value: countParagraphs(body).toLocaleString() },
      { icon: Clock, label: 'Read time', value: readingTime(words) },
    ]
  })

  const codeCards = $derived.by((): Card[] => [
    { icon: AlignLeft, label: 'Lines', value: countLines(content).toLocaleString() },
    // The same catalogue the editor highlights from, so the panel cannot name a
    // language the view is not using. A file with no grammar says so plainly.
    { icon: Code, label: 'Language', value: codeLanguageFor(path)?.name ?? 'Plain text' },
    { icon: CaseSensitive, label: 'Characters', value: countCharacters(content).toLocaleString() },
    { icon: ListIndentIncrease, label: 'Indent', value: detectIndent(content) },
  ])

  const cards = $derived(markdown ? proseCards : codeCards)

  const rows = $derived([
    { label: 'Size', value: size },
    { label: 'Modified', value: info ? absoluteDate(info.mtimeMs) : '—' },
    { label: 'Created', value: info?.birthtimeMs ? absoluteDate(info.birthtimeMs) : '—' },
  ])
</script>

<div class="flex flex-col gap-2.5 px-4 pb-4">
  <div class="grid grid-cols-2 gap-1.5">
    {#each cards as card (card.label)}
      {@const Icon = card.icon}
      <div
        class="@container flex flex-col gap-1 rounded-md border px-2.5 py-2"
        style="background: var(--bg-raised); border-color: var(--border)"
      >
        <!--
          The number gets the full width of the card. The panel narrows to
          220px, and a five-figure word count clipped to "13,7…" is worse than
          useless — it looks like a smaller document.
        -->
        <span
          class="truncate text-[15px] leading-tight font-semibold tabular-nums"
          style="color: var(--text)"
          title={card.value}
        >
          {card.value}
        </span>
        <div class="flex items-center justify-between gap-1">
          <span class="truncate text-[11px] leading-none" style="color: var(--text-faint)">
            {card.label}
          </span>
          <!--
            The icon is the first thing to go when the panel is dragged narrow:
            it decorates a label that already says the same thing, and the label
            is the half worth keeping whole.
          -->
          <Icon
            size={16}
            strokeWidth={2}
            class="hidden shrink-0 @min-[110px]:block"
            style="color: var(--text-faint)"
          />
        </div>
      </div>
    {/each}
  </div>

  <div class="flex flex-col gap-0.5">
    {#each rows as row (row.label)}
      <div class="flex items-baseline justify-between gap-2 py-[3px] text-[12px]">
        <span style="color: var(--text-faint)">{row.label}</span>
        <span class="truncate" style="color: var(--text-muted)" title={row.value}>{row.value}</span>
      </div>
    {/each}
  </div>
</div>
