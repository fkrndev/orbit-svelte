<script lang="ts">
  import { DEFAULT_SETTINGS } from '$shared/types'
  import { getState } from '@/store.svelte'
  import { savePaneWidth } from '@/actions'
  import { PANES, clampPane, resizedTo, writePaneVar, type PaneKey } from '@/layout'

  /** How far one arrow key moves an edge; a shifted press moves it four times as far. */
  const KEY_STEP = 16

  /**
   * The draggable edge of a pane.
   *
   * Deliberately a `separator` rather than a decorated border: a resize handle is
   * a control, and the keyboard is the only way some people have of using one.
   * Arrow keys move the edge, and double-click returns it to the default — the
   * cheapest possible undo for a drag that went too far.
   *
   * It straddles the border it moves, so the hit area is wider than the 1px line
   * the user is aiming at, and hover paints that same line rather than revealing
   * a second one — the chrome stays still as the pointer crosses it.
   */
  let {
    pane,
    /** Which side of the pane this handle sits on. */
    edge,
    label,
  }: { pane: PaneKey; edge: 'left' | 'right'; label: string } = $props()

  let dragging = $state(false)
  let drag: { x: number; width: number; latest: number } | null = null

  const spec = $derived(PANES[pane])

  // Dragging the right edge of a left-hand pane widens it; the left edge of a
  // right-hand pane is the mirror image.
  const direction = $derived(edge === 'right' ? 1 : -1)

  /**
   * Read from settings rather than from the DOM.
   *
   * The variable is the fast path during a drag, but settings are the truth — and
   * parsing a computed `px` string back out would make a rounding error possible
   * between two drags of the same handle.
   */
  function currentWidth(): number {
    return clampPane(pane, getState().settings[pane])
  }

  function commit(width: number) {
    writePaneVar(pane, width)
    void savePaneWidth(pane, width)
  }

  /**
   * Ends a drag exactly once. Releasing the pointer and losing the capture to
   * something outside the app both land here — the second must be handled, or a
   * window switch mid-drag leaves the whole UI stuck in a resize.
   */
  function endDrag() {
    const state = drag
    if (!state) return
    drag = null
    dragging = false
    document.documentElement.classList.remove('resizing')
    commit(state.latest)
  }

  function nudge(event: KeyboardEvent) {
    const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP
    if (event.key === 'ArrowLeft') commit(resizedTo(pane, currentWidth(), -step, direction))
    else if (event.key === 'ArrowRight') commit(resizedTo(pane, currentWidth(), step, direction))
    else return
    event.preventDefault()
  }
</script>

<!--
  A focusable `separator` with `aria-value*` is the ARIA splitter pattern, which
  is interactive by definition — the checker only models the static case.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={currentWidth()}
  aria-valuemin={spec.min}
  aria-valuemax={spec.max}
  tabindex="0"
  title="{label} — drag, or double-click to reset"
  onkeydown={nudge}
  ondblclick={() => commit(DEFAULT_SETTINGS[pane])}
  onpointerdown={event => {
    // Only the primary button, and never a second pointer mid-drag.
    if (event.button !== 0 || drag) return
    // Without this the press also starts a text selection, and the drag paints
    // half the document blue on its way across.
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    const width = currentWidth()
    drag = { x: event.clientX, width, latest: width }
    dragging = true
    document.documentElement.classList.add('resizing')
  }}
  onpointermove={event => {
    if (!drag) return
    drag.latest = resizedTo(pane, drag.width, event.clientX - drag.x, direction)
    // The variable, not the store: see the note in `layout.ts`.
    writePaneVar(pane, drag.latest)
  }}
  onpointerup={endDrag}
  onlostpointercapture={endDrag}
  class="group absolute top-0 z-20 h-full w-[9px] cursor-col-resize touch-none select-none outline-none
         {edge === 'right' ? '-right-[4px]' : '-left-[4px]'}"
>
  <!--
    The line the handle moves, painted only while it is being aimed at.
    `--brand` rather than a stronger border: a hairline one step darker than
    the border already there is not a state change anyone notices, and this
    line is the only confirmation that the pointer has found the edge.
    Dragging is styled inline as well as by `:hover`, because a captured
    pointer that wanders off the element must not take the highlight with it.
  -->
  <div
    class="pointer-events-none mx-auto h-full w-px transition-colors group-hover:bg-[var(--brand)] group-focus-visible:bg-[var(--brand)]"
    style={dragging ? 'background: var(--brand)' : ''}
  ></div>
</div>
