<script lang="ts">
	import { onDestroy } from 'svelte';
	import { PROBE_CLASS, svelteLog } from './probe-view';

	const props: Record<string, unknown> = $props();

	// The live props object, so a test can read a getter prop after the mount.
	// svelte-ignore state_referenced_locally
	svelteLog.push({ stage: 'mount', props });
	// Every prop is read, so each update the slot sends shows up as one more render.
	$effect(() => {
		svelteLog.push({ stage: 'render', props: { ...props } });
	});
	onDestroy(() => svelteLog.push({ stage: 'destroy' }));
</script>

<b class={PROBE_CLASS}></b>
