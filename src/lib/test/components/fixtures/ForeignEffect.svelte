<script lang="ts">
	// Loaded on a second Svelte runtime, its `$effect` finds no effect in progress there.
	let { node }: { node?: { raw: string } } = $props();
	let el: HTMLElement | undefined = $state();
	$effect(() => {
		if (el) el.dataset.raw = node?.raw ?? '';
	});
</script>

<span class="foreign-effect" bind:this={el}></span>
