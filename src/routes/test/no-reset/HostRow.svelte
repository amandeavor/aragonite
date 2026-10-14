<script lang="ts">
	import type { InlineMenuRowProps } from '#lib';

	let { item }: InlineMenuRowProps = $props();
</script>

<button type="button" class="host-button">{item.label}</button>
