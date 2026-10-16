<script lang="ts">
	/** The drawn chip: the name between the braces. */
	import type { InlineWidgetComponentProps } from '#lib/plugin.js';

	let { source }: InlineWidgetComponentProps = $props();
</script>

<span class="harness-chip">{source.slice(2, -2)}</span>

<style>
	.harness-chip {
		padding: 0 4px;
		border-radius: 4px;
		border: 1px solid currentColor;
	}
</style>
