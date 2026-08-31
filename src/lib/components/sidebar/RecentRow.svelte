<script lang="ts">
  import Star from '@lucide/svelte/icons/star'
  import type { RecentItem, RecentSort } from '$shared/types'
  import { openPath } from '@/actions'
  import { relativeTime } from '@/format'
  import SidebarRow from './SidebarRow.svelte'
  import RowMarks from './RowMarks.svelte'
  import Excerpt from './Excerpt.svelte'
  import FileMenu from './FileMenu.svelte'
  import { fileIconFor } from './icons'
  import { displayName } from './names'
  import type { DecorRequest } from './rowMenus'

  let {
    item,
    sort,
    /** Which folder the note lives in, already disambiguated by the list. */
    folder,
    /** Excerpt lines to draw. Zero is the compact row. */
    lines,
    active,
    onDecor,
  }: {
    item: RecentItem
    sort: RecentSort
    folder: string | undefined
    lines: number
    active: boolean
    onDecor: (request: DecorRequest) => void
  } = $props()

  const glyph = $derived(fileIconFor(item.path, item.icon))
  const Icon = $derived(glyph.Icon)
</script>

<SidebarRow
  indent={8}
  icon={rowIcon}
  label={displayName(item.path)}
  title={item.path}
  {active}
  strong
  onclick={() => void openPath(item.path)}
  detail={lines > 0 || folder ? detail : undefined}
  trailing={marks}
  menu={rowMenu}
/>

{#snippet rowIcon()}
  <Icon size={16} strokeWidth={2} style="color: {item.color ?? glyph.color}" />
{/snippet}

{#snippet detail()}
  {#if lines > 0}
    <Excerpt text={item.excerpt} {lines} />
  {/if}
  <!--
    Half these notes are called `README` and live in a folder called `docs`;
    without the folder the row names nothing you can act on. It sits under the
    name rather than beside it so a long folder never eats the name.
  -->
  {#if folder}
    <span
      class="max-w-full self-start truncate rounded px-1 py-px text-[10.5px] font-medium"
      style="background: var(--bg-active); color: var(--text-muted)"
      title={folder}>{folder}</span
    >
  {/if}
{/snippet}

{#snippet marks()}
  <RowMarks>
    {#if item.pinned}
      <Star fill="currentColor" size={16} style="color: var(--pinned)" />
    {/if}
    <span class="text-[10.5px] tabular-nums" style="color: var(--text-faint)">
      <!--
        Counts are approximate — see `RecentItem` — so the label never claims to
        be a total.
      -->
      {sort === 'opens' ? `${item.openCount} opens` : relativeTime(item.lastOpenedAt)}
    </span>
  </RowMarks>
{/snippet}

{#snippet rowMenu()}
  <FileMenu
    path={item.path}
    meta={{
      pinned: item.pinned,
      ...(item.icon ? { icon: item.icon } : {}),
      ...(item.color ? { color: item.color } : {}),
    }}
    {onDecor}
  />
{/snippet}
