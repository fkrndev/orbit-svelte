<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import Expand from '@lucide/svelte/icons/expand';
	import MediaExtended from './MediaExtended.svelte';
	import { showImagePreview } from '@/components/ImagePreview.svelte';

	const { ...rest }: NodeViewProps = $props();

	let mediaRef = $state<HTMLElement>();

	/**
	 * The full-size view — see `components/ImagePreview.svelte`.
	 *
	 * Reachable three ways, because there is no single gesture that works in both
	 * modes. A single click cannot open it while editing: there it selects the node
	 * for the resize handles, and stealing that would take away the only way to
	 * change an image's width. So a double-click opens it anywhere, a single click
	 * opens it when the document is not editable (reading mode, where nothing is
	 * selectable anyway), and the button on hover is what makes any of this
	 * discoverable rather than folklore.
	 */
	function preview() {
		showImagePreview(rest.node.attrs.src, rest.node.attrs.alt ?? '');
	}
</script>

<MediaExtended bind:mediaRef {...rest}>
	{@const node = rest.node}
	<!--
		The click handlers are shortcuts, not the interface: the button below is the
		keyboard- and screen-reader-reachable way to the same thing.
	-->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<img
		bind:this={mediaRef}
		src={node.attrs.src}
		alt={node.attrs.alt}
		title={node.attrs.title}
		class="m-0 cursor-zoom-in object-cover"
		ondblclick={preview}
		onclick={() => {
			if (!rest.editor.isEditable) preview();
		}}
	/>
	<!--
		Above the resize handles (`z-20`) and below the editable toolbar (`z-50`),
		which sits top-centre and would otherwise overlap it.
	-->
	<button
		type="button"
		title="View full size"
		aria-label="View full size"
		onclick={preview}
		class="absolute top-2 right-2 z-30 grid size-7 place-items-center rounded-md border bg-background/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
	>
		<Expand class="size-3.5" />
	</button>
</MediaExtended>
