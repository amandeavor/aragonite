<script lang="ts">
	// Two root listeners installed the way the editor installs them, logging each install and teardown.
	import { createRootEffect } from '../../../components/editor-root/root-effect.svelte';

	let { log }: { log: string[] } = $props();
	let root: HTMLDivElement | undefined = $state();
	const rootEffect = createRootEffect(() => root);
	for (const name of ['first', 'second']) {
		rootEffect(() => {
			log.push(`install ${name}`);
			return () => log.push(`teardown ${name}`);
		});
	}
</script>

<div bind:this={root}></div>
