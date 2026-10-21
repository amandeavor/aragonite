<!--
  What BlockHost renders for a block drawn by `defineBlockView`. A new spec (the block's kind
  changed) mounts a fresh view, since the editable-leaf and container factories run once.
-->
<script lang="ts">
	import type { BlockComponent } from '../../block-component';
	import type { NodeView } from '../../core/node-views';
	import type { BlockViewSpec } from '../../schema/block-view';
	import DomBlockView from './DomBlockView.svelte';

	let {
		spec,
		node,
		index,
		myPath
	}: { spec: BlockViewSpec; node: NodeView; index: number; myPath: number[] } = $props();

	let view: { viewRef(): BlockComponent | undefined } | undefined = $state();

	export function viewRef(): BlockComponent | undefined {
		return view?.viewRef();
	}
</script>

{#key spec}
	<DomBlockView {spec} {node} {index} {myPath} bind:this={view} />
{/key}
