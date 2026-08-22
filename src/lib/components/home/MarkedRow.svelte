<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    icon,
    label,
    title,
    detail,
    dim,
    onclick,
  }: {
    icon: Snippet
    label: string
    title?: string
    detail?: string
    dim?: boolean
    onclick: () => void
  } = $props()
</script>

<button
  type="button"
  {onclick}
  title={title ?? label}
  disabled={dim}
  class="flex items-center gap-2 rounded px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-default"
  style="opacity: {dim ? 0.45 : 1}"
>
  <span class="shrink-0" style="color: var(--text-faint)">{@render icon()}</span>
  <span class="min-w-0 flex-1 truncate text-[12.5px]">{label}</span>
  {#if detail}
    <span class="shrink-0 text-[11px]" style="color: var(--text-faint)">{detail}</span>
  {/if}
</button>
