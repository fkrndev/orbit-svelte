<script lang="ts">
  import { getState, setState } from '@/store.svelte'

  const notice = $derived(getState().notice)
</script>

{#if notice}
  <!--
    `pointer-events-none` on the wrapper keeps a transient notice from eating a
    click meant for the editor underneath it; the button re-enables them for
    itself only, so the one notice that *is* clickable stays clickable.
  -->
  <div role="status" class="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
    <div
      class="flex items-center gap-3 rounded-lg border px-3.5 py-2 text-[13px] shadow-[var(--shadow)]"
      style="background: var(--bg-raised);
             border-color: {notice.kind === 'error' ? 'var(--danger)' : 'var(--border)'};
             color: {notice.kind === 'error' ? 'var(--danger)' : 'var(--text)'}"
    >
      {notice.text}
      {#if notice.action}
        <button
          type="button"
          class="pointer-events-auto rounded-md px-2 py-1 text-[12px] font-medium"
          style="background: var(--brand); color: var(--brand-on)"
          onclick={() => {
            const run = notice.action!.run
            setState({ notice: null })
            run()
          }}
        >
          {notice.action.label}
        </button>
        <button
          type="button"
          class="pointer-events-auto rounded-md px-1.5 py-1 text-[12px]"
          style="color: var(--text-muted)"
          onclick={() => setState({ notice: null })}
          aria-label="Dismiss"
        >
          ✕
        </button>
      {/if}
    </div>
  </div>
{/if}
