<script lang="ts">
	import type { NodeView } from '#lib/core/node-views.js';
	import ListStateOwner from './ListStateOwner.svelte';

	let { node, generation }: { node: NodeView; generation: number } = $props();
</script>

{#key generation}
	<ListStateOwner {node} />
{/key}
