<script lang="ts">
	import { svelteLog } from './probe-view';

	let { source }: { source: string } = $props();

	// Reads one prop only, so a render here means `source` itself changed.
	$effect(() => {
		svelteLog.push({ stage: 'render', props: source });
	});
</script>

<b>{source}</b>
