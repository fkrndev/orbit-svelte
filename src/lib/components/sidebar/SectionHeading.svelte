<script lang="ts">
  let { title }: { title: string } = $props()
</script>

<div
  class="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase"
  style="color: var(--text-faint)"
>
  {title}
</div>
