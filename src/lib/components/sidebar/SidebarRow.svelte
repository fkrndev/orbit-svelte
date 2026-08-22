<script lang="ts">
  import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical'
  import type { Snippet } from 'svelte'
  import * as DropdownMenu from '@/components/ui/dropdown-menu'
  import { ROW_ACTION, ROW_ACTIONS } from './rowMenus'

  /**
   * One row in any sidebar panel: tree, recents, bookmarks.
   *
   * Shared because the three panels only differ in what they list. Three
   * hand-rolled rows would drift apart in indent, hover behaviour, and where the
   * actions sit — differences nobody decides on and everybody notices.
   */
  let {
    indent = 0,
    icon,
    label,
    /**
     * The full path behind the row. Shown on hover, and published as
     * `data-row-path` so Reveal can find the row without a ref threaded out of
     * every panel that draws one.
     */
    title,
    active,
    /** A target that is no longer on disk: shown, but not reachable. */
    dim,
    /**
     * The row names a document: drawn bold and at full contrast, so a list of
     * notes can be scanned by name alone. Structure rows — folders, groups —
     * leave it off, which is what makes the names stand out from them.
     */
    strong,
    trailing,
    /**
     * A second line under the name — a preview, a path. Part of the same button,
     * so the whole block is one target rather than a name you can click beside.
     */
    detail,
    menu,
    onclick,
    ondblclick,
  }: {
    indent?: number
    icon?: Snippet
    label: string
    title?: string
    active?: boolean
    dim?: boolean
    strong?: boolean
    trailing?: Snippet
    detail?: Snippet
    menu?: Snippet
    onclick?: () => void
    ondblclick?: () => void
  } = $props()

  let menuOpen = $state(false)

  const style = $derived(
    [
      `padding-left: ${indent}px`,
      active ? 'background: var(--bg-active)' : '',
      `color: ${active ? 'var(--text)' : 'var(--text-muted)'}`,
      `opacity: ${dim ? 0.45 : 1}`,
    ]
      .filter(Boolean)
      .join('; '),
  )
</script>

<!--
  The context menu belongs to the whole row, not to any one control in it; the
  row's own affordances are all real buttons.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group relative flex items-center rounded transition-colors hover:bg-[var(--bg-hover)]"
  {style}
  data-row-path={title}
  oncontextmenu={menu
    ? event => {
        event.preventDefault()
        menuOpen = true
      }
    : undefined}
>
  <button
    type="button"
    disabled={dim}
    {onclick}
    {ondblclick}
    title={title ?? label}
    class={detail
      ? 'flex min-w-0 flex-1 flex-col gap-0.5 py-1.5 pr-1 text-left disabled:cursor-default'
      : 'flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-1 text-left disabled:cursor-default'}
  >
    <!--
      The name line is its own row once there is a detail under it; without one
      the button *is* the line, and wrapping it in a second flex box would only
      add a node.
    -->
    <span class={detail ? 'flex w-full min-w-0 items-center gap-1.5' : 'contents'}>
      <!--
        Not a fixed box: a folder row leads with a chevron *and* an icon, and a
        rigid slot would push the second one somewhere else.
      -->
      {#if icon}
        <span class="flex shrink-0 items-center gap-1">{@render icon()}</span>
      {/if}
      <span
        class="truncate text-[12.5px] {strong ? 'font-semibold' : ''}"
        style={strong ? 'color: var(--text)' : ''}>{label}</span
      >
      {@render trailing?.()}
    </span>
    {@render detail?.()}
  </button>

  {#if menu}
    <div class="{ROW_ACTIONS} pr-1">
      <DropdownMenu.Root bind:open={menuOpen}>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              type="button"
              title="More"
              class="{ROW_ACTION} hover:bg-[var(--bg-active)]"
              style="color: var(--text-faint)"
            >
              <EllipsisVertical size={16} strokeWidth={2} />
            </button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="min-w-44">
          {@render menu()}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  {/if}
</div>
