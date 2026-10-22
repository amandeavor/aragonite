<script lang="ts">
	// Draws fine at mount and throws on the re-render after its raw gains the trigger word, the
	// Svelte form of a DOM view's `update` throwing.
	import type { NodeView } from '../../../core/node-views';
	import { THROWN_MESSAGE } from './thrown-message';

	let { node }: { node: NodeView } = $props();

	const text = $derived.by(() => {
		if (node.raw.includes('bang')) throw new TypeError(THROWN_MESSAGE);
		return node.raw;
	});

	export const editable = true;
	export const focusable = true;
	export function focus(): void {}
	export function getCursorOffset(): number | null {
		return null;
	}
</script>

<div class="throwing-block">{text}</div>
