<script lang="ts">
	// A render-primary editable leaf whose `singleLine`, painter and source-change callback are
	// props, so one fixture drives both Enter contracts and the painted source.
	import { type NodeView } from '#lib/plugin.js';
	import { createEditableLeaf } from '#lib/svelte.js';

	let {
		node,
		index,
		myPath = [],
		singleLine = false,
		paint,
		onSourceEdit
	}: {
		node: NodeView;
		index: number;
		myPath?: number[];
		singleLine?: boolean;
		paint?: (text: string) => DocumentFragment;
		onSourceEdit?: (text: string) => void;
	} = $props();

	let sourceEl: HTMLDivElement | undefined = $state();
	let revealed = $state(false);

	// Static config, captured once on purpose: the factory reads it at the call, not live.
	// svelte-ignore state_referenced_locally
	const oneLine = singleLine;
	// svelte-ignore state_referenced_locally
	const renderSource = paint;
	// svelte-ignore state_referenced_locally
	const reportSourceEdit = onSourceEdit;

	const leaf = createEditableLeaf({
		getNode: () => node,
		getIndex: () => index,
		getPath: () => myPath,
		getEl: () => sourceEl ?? null,
		mode: 'render-primary',
		singleLine: oneLine,
		renderSource,
		onSourceEdit: reportSourceEdit,
		isRevealed: () => revealed,
		setRevealed: (next) => (revealed = next)
	});

	export const blockApi = leaf.blockApi;
</script>

<!-- The spread sits on a wrapper that stays mounted while the source shows, as the guide says. -->
<div class="reveal-leaf-block" {...leaf.renderProps}>
	{#if revealed}
		<div bind:this={sourceEl} {...leaf.surfaceProps} class="reveal-leaf-source"></div>
	{:else}
		<div class="reveal-leaf-render">{node.raw}</div>
	{/if}
</div>

<style>
	.reveal-leaf-source {
		white-space: pre-wrap;
	}
</style>
