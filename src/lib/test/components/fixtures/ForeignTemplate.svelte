<script lang="ts">
	// Template only: loaded on a second Svelte runtime, it fails reading DOM helpers that runtime
	// never set up.
	let { node }: { node?: { raw: string } } = $props();
</script>

<span class="foreign-template">{node?.raw}</span>
