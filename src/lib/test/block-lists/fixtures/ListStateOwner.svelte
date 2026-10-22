<script lang="ts">
	import type { NodeView } from '#lib/core/node-views.js';
	import { createBlockListState } from '#lib/block-lists/block-list-state.svelte.js';

	let { node }: { node: NodeView } = $props();
	createBlockListState(() => node);
</script>
