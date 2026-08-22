<script lang="ts">
  import { getState } from '@/store.svelte'

  const notice = $derived(getState().notice)
</script>

{#if notice}
  <div role="status" class="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
    <div
      class="rounded-lg border px-3.5 py-2 text-[13px] shadow-[var(--shadow)]"
      style="background: var(--bg-raised);
             border-color: {notice.kind === 'error' ? 'var(--danger)' : 'var(--border)'};
             color: {notice.kind === 'error' ? 'var(--danger)' : 'var(--text)'}"
    >
      {notice.text}
    </div>
  </div>
{/if}
