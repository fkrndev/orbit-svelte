<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import ChevronUp from '@lucide/svelte/icons/chevron-up'
  import X from '@lucide/svelte/icons/x'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { cn } from '@/utils'
  import { getState } from '@/store.svelte'
  import {
    closeFind,
    moveFindMatch,
    replaceAllFindMatches,
    replaceCurrentFindMatch,
    setFindQuery,
    setFindReplaceOpen,
    setFindReplacement,
    toggleFindCaseSensitive,
    toggleFindRegex,
  } from '@/find'

  /**
   * Find and replace, over whichever editor is open.
   *
   * The bar owns no search state of its own — everything it draws comes from the
   * store, which is also what the sidebar's results list reads. That is the whole
   * reason the state lives there: two views, one session, and no path between
   * them through the editor.
   */
  const find = $derived(getState().find)
  const hasMatches = $derived(find.matches.length > 0 && !find.error)
  const replaceLabel = $derived(find.replaceOpen ? 'Hide replace' : 'Show replace')

  let input = $state<HTMLInputElement | null>(null)

  // A number, not `find.requestId` read inline: every keystroke replaces the
  // whole find object, so an effect that touches `find` would re-select the
  // text on each letter and eat the one before it.
  const focusRequest = $derived(find.open ? find.requestId : 0)

  $effect(() => {
    if (focusRequest === 0) return
    // A frame late: on the first ⌘F the input is mounted by this same update.
    const frame = requestAnimationFrame(() => {
      input?.focus()
      input?.select()
    })
    return () => cancelAnimationFrame(frame)
  })

  const status = $derived(
    find.error
      ? find.error
      : find.matches.length === 0
        ? 'No results'
        : `${find.activeIndex + 1} of ${find.matches.length}`,
  )

  function onFindKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeFind()
      return
    }
    // ↑/↓ walk the hits the same way Enter does — the arrows are what you reach
    // for with the result list on screen, and a caret move inside a one-line
    // field is nothing to protect.
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFindMatch(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key !== 'Enter') return

    event.preventDefault()
    moveFindMatch(event.shiftKey ? -1 : 1)
  }
</script>

{#if find.open}
  <!--
    Escape from anywhere in the bar, not just the find field — the replace input
    and the toggles are just as likely to hold focus.
  -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex shrink-0 flex-col gap-1.5 border-b px-3 py-2"
    data-testid="find-bar"
    onkeydown={event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeFind()
    }}
    style="background: var(--bg-raised); border-color: var(--border)"
  >
    <div class="flex min-w-0 items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={replaceLabel}
        title={replaceLabel}
        onclick={() => setFindReplaceOpen(!find.replaceOpen)}
      >
        <ChevronRight class={cn('transition-transform', find.replaceOpen && 'rotate-90')} />
      </Button>
      <Input
        bind:ref={input}
        type="search"
        aria-label="Find"
        placeholder="Find"
        value={find.query}
        oninput={event => setFindQuery((event.currentTarget as HTMLInputElement).value)}
        onkeydown={onFindKeyDown}
        class="h-7 min-w-[12rem] flex-1 rounded px-2 text-xs"
        data-testid="find-input"
      />
      <span
        class="min-w-[4.75rem] text-right text-xs"
        style="color: var(--text-muted)"
        aria-live="polite"
        data-testid="find-count"
      >
        {status}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Previous match"
        title="Previous match"
        disabled={!hasMatches}
        onclick={() => moveFindMatch(-1)}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Next match"
        title="Next match"
        disabled={!hasMatches}
        onclick={() => moveFindMatch(1)}
      >
        <ChevronDown />
      </Button>
      <Button
        type="button"
        variant={find.regex ? 'secondary' : 'ghost'}
        size="xs"
        aria-label="Use regular expression"
        aria-pressed={find.regex}
        title="Use regular expression"
        onclick={toggleFindRegex}
      >
        .*
      </Button>
      <Button
        type="button"
        variant={find.caseSensitive ? 'secondary' : 'ghost'}
        size="xs"
        aria-label="Match case"
        aria-pressed={find.caseSensitive}
        title="Match case"
        onclick={toggleFindCaseSensitive}
      >
        Aa
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Close find"
        title="Close find"
        onclick={closeFind}
      >
        <X />
      </Button>
    </div>

    {#if find.replaceOpen}
      <!-- Indented to line up under the find field rather than the disclosure arrow. -->
      <div class="ml-[1.875rem] flex min-w-0 items-center gap-1.5">
        <Input
          type="text"
          aria-label="Replace with"
          placeholder="Replace with"
          value={find.replacement}
          oninput={event => setFindReplacement((event.currentTarget as HTMLInputElement).value)}
          class="h-7 min-w-[12rem] flex-1 rounded px-2 text-xs"
          data-testid="find-replace-input"
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!hasMatches}
          onclick={replaceCurrentFindMatch}
        >
          Replace
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!hasMatches}
          onclick={replaceAllFindMatches}
        >
          Replace all
        </Button>
      </div>
    {/if}
  </div>
{/if}
