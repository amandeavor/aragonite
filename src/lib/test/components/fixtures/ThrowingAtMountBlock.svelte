<script lang="ts">
	// Throws during init while its raw holds the trigger word, with a foreign runtime's message.
	import type { NodeView } from '../../../core/node-views';
	import { THROWN_MESSAGE } from './thrown-message';

	let { node }: { node: NodeView } = $props();

	// svelte-ignore state_referenced_locally
	if (node.raw.includes('boom')) throw new TypeError(THROWN_MESSAGE);

	export const editable = true;
	export const focusable = true;
	export function focus(): void {}
	export function getCursorOffset(): number | null {
		return null;
	}
</script>

<div class="throwing-block">{node.raw}</div>
