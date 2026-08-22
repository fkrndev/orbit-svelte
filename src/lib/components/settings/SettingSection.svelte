<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * The chrome every settings section is built from.
   *
   * One component rather than each section laying out its own rows, because the
   * thing that makes a settings page feel finished is that every row has the same
   * rhythm — and that is exactly the property that decays first when six sections
   * each write their own `flex justify-between`.
   *
   * The shape is: name and one line of explanation on the left, the control on
   * the right, hairline between rows, card around the group.
   */
  let {
    title,
    icon,
    description,
    children,
  }: { title: string; icon?: Snippet; description?: string; children: Snippet } = $props()
</script>

<section class="mb-9">
  <h2 class="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
    {@render icon?.()}
    {title}
  </h2>
  {#if description}
    <p class="mt-1 text-[12.5px]" style="color: var(--text-muted)">{description}</p>
  {/if}
  <div class="mt-3 overflow-hidden rounded-xl border" style="border-color: var(--border)">
    {@render children()}
  </div>
</section>
