<script lang="ts">
  import { api } from '@/rpcClient'

  /** The first lines of the highlighted note, for telling eight `README.md` apart. */
  let { path }: { path: string | null } = $props()

  let excerpt = $state('')
  /** The preview column only appears on a window that can spare the room. */
  let wide = $state(true)

  $effect(() => {
    const measure = () => (wide = window.innerWidth >= 1100)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  })

  $effect(() => {
    if (!path || !wide) return
    const target = path
    let cancelled = false
    // Debounced, because holding ↓ moves the cursor faster than a disk read.
    const timer = setTimeout(() => {
      api
        .peekFile({ path: target })
        .then(result => !cancelled && (excerpt = result.excerpt))
        .catch(() => !cancelled && (excerpt = ''))
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  })
</script>

{#if wide}
  <aside
    class="w-72 shrink-0 overflow-y-auto border-l p-5 text-[12.5px] leading-relaxed"
    style="border-color: var(--border); background: var(--bg-sunken); color: var(--text-muted)"
  >
    {#if path}
      <p class="mb-2 truncate font-medium" style="color: var(--text)">
        {path.slice(path.lastIndexOf('/') + 1)}
      </p>
      <p class="break-words whitespace-pre-wrap">{excerpt || 'Empty note'}</p>
    {:else}
      <p style="color: var(--text-faint)">Highlight a note to preview it.</p>
    {/if}
  </aside>
{/if}
