<script lang="ts">
	import type { InlineMenuRowProps } from '../../../inline-menu/types';

	let { item, active }: InlineMenuRowProps = $props();

	// Throws during mount for one item only, so its neighbours prove the failure stays in its row.
	// svelte-ignore state_referenced_locally
	if (item.id === 'bad') throw new Error('row exploded');
</script>

<span class="custom-row" data-active-row={active}>{item.label}</span>
