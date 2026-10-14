<script lang="ts">
	import type { InlineMenuRowProps } from '../../../inline-menu/types';

	let { item, active }: InlineMenuRowProps = $props();

	// Mounts cleanly and throws on the re-render that makes item `late` the active row.
	const label = $derived.by(() => {
		if (active && item.id === 'late') throw new Error('row exploded late');
		return item.label;
	});
</script>

<span class="custom-row">{label}</span>
