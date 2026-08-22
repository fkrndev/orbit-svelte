<script lang="ts" module>
  import { setState } from '@/store.svelte'

  /**
   * Opens the full-size view of an image.
   *
   * Takes the URL the editor is already showing rather than a file path: that URL
   * is fetchable from the page by construction — see `editor/assetUrls.ts` — and
   * resolving the path a second time here would be a second chance to get it
   * wrong.
   */
  export function showImagePreview(src: string, alt = '') {
    setState({ imagePreview: { src, alt } })
  }

  export function closeImagePreview() {
    setState({ imagePreview: null })
  }
</script>

<script lang="ts">
  import Minus from '@lucide/svelte/icons/minus'
  import Plus from '@lucide/svelte/icons/plus'
  import Scan from '@lucide/svelte/icons/scan'
  import X from '@lucide/svelte/icons/x'
  import {
    IMAGE_ACTUAL_ZOOM,
    IMAGE_MAX_ZOOM,
    IMAGE_MIN_ZOOM,
    clampImageZoom,
    fitImageZoom,
    formatImageZoom,
    nextImageZoom,
    type ImageZoomDirection,
  } from '@/imageZoom'

  /**
   * An image, full size, over everything.
   *
   * A screenshot in a note is almost never legible at the width of the prose
   * column, and the two ways of dealing with that in a markdown editor are both
   * bad: resize the node — which edits the file to work around a viewing problem
   * — or open the file in another app and lose your place. So this is a *look*,
   * not an edit: nothing here writes anything, and closing leaves the document
   * exactly as it was.
   *
   * It opens fitted rather than at 1:1, because the first question about a
   * screenshot is what it shows; 100% is one keypress away for the second
   * question, which is what the small print says.
   */
  let { src, alt }: { src: string; alt: string } = $props()

  let shell = $state<HTMLDivElement | null>(null)
  let viewport = $state<HTMLDivElement | null>(null)
  let natural = $state({ width: 0, height: 0 })
  let available = $state({ width: 0, height: 0 })
  let failed = $state(false)

  /**
   * `null` until the image has reported its size.
   *
   * The distinction is load-bearing rather than tidy: a width in pixels cannot be
   * computed before the image is measured, so until then it is rendered under
   * plain `max-width`/`max-height` constraints. Guessing a zoom of 1 instead
   * would show a 3000px screenshot at 1:1 for one frame and jump.
   */
  let zoom = $state<number | null>(null)

  /**
   * Whether the current zoom came from fitting rather than from the user.
   *
   * What it buys: resizing the window re-fits an image that was fitted, and
   * leaves alone one the user has deliberately zoomed. Without it, dragging the
   * window wider would throw away the magnification you had just chosen.
   */
  let fitted = $state(true)

  const scale = $derived(zoom ?? 1)
  const canPan = $derived(
    zoom !== null &&
      (natural.width * scale > available.width + 1 || natural.height * scale > available.height + 1),
  )

  function fit(): number {
    return fitImageZoom(natural, available)
  }

  function onLoad(event: Event) {
    const image = event.currentTarget as HTMLImageElement
    natural = { width: image.naturalWidth, height: image.naturalHeight }
    fitted = true
    zoom = fit()
  }

  /**
   * Changing the zoom, keeping the middle of the view where it was.
   *
   * Without the anchor, zooming in on a detail sends the view to the top-left
   * corner and the thing being looked at off screen — the one behaviour that
   * makes a zoom control feel broken. Restored after the frame that resizes the
   * image, since the scroll extent does not exist until then, and only as an
   * anchor: the browser clamps it at the edges, which is the right answer there.
   */
  function setZoom(next: number, fromFit = false) {
    const from = zoom
    const target = clampImageZoom(next)
    fitted = fromFit
    if (from === null || !viewport || target === from) {
      zoom = target
      return
    }

    const element = viewport
    const ratio = target / from
    const centreX = element.scrollLeft + element.clientWidth / 2
    const centreY = element.scrollTop + element.clientHeight / 2
    zoom = target
    requestAnimationFrame(() => {
      element.scrollLeft = centreX * ratio - element.clientWidth / 2
      element.scrollTop = centreY * ratio - element.clientHeight / 2
    })
  }

  function step(direction: ImageZoomDirection) {
    setZoom(nextImageZoom(zoom ?? IMAGE_ACTUAL_ZOOM, direction))
  }

  /*
   * Bound to the window rather than to the shell, in the capture phase.
   *
   * Focus is not a reliable enough hold on the keyboard here: clicking the
   * backdrop or starting a pan puts `activeElement` back on `<body>`, and a
   * listener on the overlay never sees a key pressed after that — Escape stopped
   * closing the preview, which is the one shortcut that must always work. Capture
   * also means the keys are taken *before* the editor behind can act on them.
   */
  $effect(() => {
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  function onKeyDown(event: KeyboardEvent) {
    // Unmodified keys only: ⌘+/⌘− belong to the window, and ⌘W to the tab.
    if (event.metaKey || event.ctrlKey || event.altKey) return

    switch (event.key) {
      case 'Escape':
        closeImagePreview()
        break
      case '+':
      case '=':
        step(1)
        break
      case '-':
      case '_':
        step(-1)
        break
      case '0':
        setZoom(fit(), true)
        break
      case '1':
        setZoom(IMAGE_ACTUAL_ZOOM)
        break
      default:
        return
    }
    event.preventDefault()
    // Nothing behind this gets a second go at a key the preview has used.
    event.stopPropagation()
  }

  /**
   * Wheel zooms only with a modifier — which is also what a trackpad pinch sends
   * — so a plain two-finger scroll still pans a zoomed-in image. Reversing that
   * would make the obvious gesture for "move down a bit" change the magnification
   * instead.
   */
  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    step(event.deltaY < 0 ? 1 : -1)
  }

  let panning = $state(false)
  let dragged = false
  let from = { x: 0, y: 0, left: 0, top: 0 }

  function onPointerDown(event: PointerEvent) {
    dragged = false
    if (event.button !== 0 || !canPan || !viewport) return
    from = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    }
    panning = true
    viewport.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent) {
    if (!panning || !viewport) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    // A few pixels of slip is a click, not a drag — otherwise letting go over the
    // backdrop after panning would close the preview.
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true
    viewport.scrollLeft = from.left - dx
    viewport.scrollTop = from.top - dy
  }

  function onPointerUp(event: PointerEvent) {
    if (!panning) return
    panning = false
    viewport?.releasePointerCapture(event.pointerId)
  }

  /** Clicking the space around the image dismisses it; clicking the image does not. */
  function onViewportClick(event: MouseEvent) {
    if (dragged) return
    if (event.target === viewport) closeImagePreview()
  }

  /*
   * Focused on mount, and that is not a nicety: the click that opened this came
   * from inside a `contenteditable`, so without moving focus every bare `-` and
   * `0` typed at the preview would be inserted into the note behind it.
   */
  $effect(() => {
    shell?.focus()
  })

  /*
   * Measurement, and deliberately nothing else.
   *
   * Re-fitting from inside here is what the obvious version does, and it wedges
   * the page: fitting reads `available`, the measurement writes it, and an effect
   * that reads and writes one piece of state runs until Svelte gives up
   * (`effect_update_depth_exceeded`) — taking every other effect in the component
   * with it, so the preview freezes at whatever zoom it had. The refit is a
   * separate effect below, which reads the measurement and never writes it.
   */
  $effect(() => {
    const element = viewport
    if (!element) return

    /*
     * The *content* box, padding subtracted.
     *
     * `clientWidth` includes the breathing room around the image, so fitting
     * against it produced an image exactly 32px too tall for the space it was
     * fitted into — a "fit" that still needed scrolling, which is the one thing
     * fit means it should not.
     */
    const measure = () => {
      const style = getComputedStyle(element)
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      available = {
        width: Math.max(0, element.clientWidth - padX),
        height: Math.max(0, element.clientHeight - padY),
      }
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  })

  /** Only what was fitted re-fits when the window changes — see `fitted`. */
  $effect(() => {
    if (!fitted || natural.width <= 0 || available.width <= 0) return
    zoom = fitImageZoom(natural, available)
  })

  const label = $derived(alt.trim() || 'Image')
</script>

<!--
  `tabindex` so the shell can hold focus, `role="dialog"` because it is one: it
  covers the window and takes the keyboard until it is closed.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={shell}
  role="dialog"
  aria-modal="true"
  aria-label={`${label} — image preview`}
  tabindex="-1"
  class="fixed inset-0 z-50 flex flex-col outline-none"
  style="background: rgb(0 0 0 / 94%)"
>
  <!--
    Its own opaque strip rather than a transparent bar over the backdrop: the app's
    title bar is the brightest thing on screen and read straight through the
    controls, which made the row look like part of the window behind it.
  -->
  <div
    class="flex h-11 shrink-0 items-center gap-3 border-b px-3"
    style="background: rgb(10 10 10); border-color: rgb(255 255 255 / 10%)"
  >
    <span class="truncate text-[12.5px]" style="color: rgb(255 255 255 / 72%)">{label}</span>

    <div class="ml-auto flex shrink-0 items-center gap-1">
      <button
        type="button"
        title="Zoom out (−)"
        aria-label="Zoom out"
        disabled={scale <= IMAGE_MIN_ZOOM}
        onclick={() => step(-1)}
        class="grid size-7 place-items-center rounded disabled:opacity-35"
        style="color: rgb(255 255 255 / 80%)"
      >
        <Minus size={15} strokeWidth={2} />
      </button>

      <!--
        The readout is the button: the number people want when they are looking at
        one is 100%, and pressing what already says "38%" is how you ask for it.
      -->
      <button
        type="button"
        title="Actual size (1)"
        onclick={() => setZoom(IMAGE_ACTUAL_ZOOM)}
        class="min-w-14 rounded px-1 text-center font-mono text-[11.5px] tabular-nums"
        style="color: rgb(255 255 255 / 72%)"
      >
        {zoom === null ? '—' : formatImageZoom(zoom)}
      </button>

      <button
        type="button"
        title="Zoom in (+)"
        aria-label="Zoom in"
        disabled={scale >= IMAGE_MAX_ZOOM}
        onclick={() => step(1)}
        class="grid size-7 place-items-center rounded disabled:opacity-35"
        style="color: rgb(255 255 255 / 80%)"
      >
        <Plus size={15} strokeWidth={2} />
      </button>

      <button
        type="button"
        title="Fit to window (0)"
        aria-label="Fit to window"
        onclick={() => setZoom(fit(), true)}
        class="grid size-7 place-items-center rounded"
        style="color: rgb(255 255 255 / 80%)"
      >
        <Scan size={15} strokeWidth={2} />
      </button>

      <button
        type="button"
        title="Close (Esc)"
        aria-label="Close image preview"
        onclick={closeImagePreview}
        class="ml-1 grid size-7 place-items-center rounded"
        style="color: rgb(255 255 255 / 80%)"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  </div>

  <!--
    `m-auto` on the image rather than `place-items-center` on the container: a
    centred flex or grid child that overflows its scroll container cannot be
    scrolled back to on the top and left sides, which would put the top-left
    corner of every zoomed-in screenshot permanently out of reach.
  -->
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    bind:this={viewport}
    class="flex min-h-0 flex-1 overflow-auto p-4"
    style={panning ? 'cursor: grabbing' : canPan ? 'cursor: grab' : ''}
    onclick={onViewportClick}
    onwheel={onWheel}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    {#if failed}
      <p class="m-auto text-[13px]" style="color: rgb(255 255 255 / 60%)">
        Could not load this image.
      </p>
    {:else}
      <!--
        No double-click-to-toggle here, on purpose. The gesture that opens this is
        itself a double-click on the image behind, and the overlay mounts between
        its two halves often enough that the second half landed here — the preview
        opened fitted and instantly jumped to 100%, which reads as the fit being
        broken. The readout and the fit button do that job without the ambiguity.
      -->
      <img
        {src}
        alt={alt || ''}
        draggable="false"
        onload={onLoad}
        onerror={() => (failed = true)}
        class="m-auto max-h-full max-w-full select-none"
        style={zoom === null
          ? 'object-fit: contain'
          : `width: ${natural.width * zoom}px; height: ${natural.height * zoom}px; max-width: none; max-height: none`}
      />
    {/if}
  </div>
</div>
