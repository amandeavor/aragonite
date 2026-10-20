<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	// The host app's own typefaces, from the packages it uses, so the demo reads as that app
	// rather than as whatever the browser's system-ui happens to be. They are devDependencies:
	// they reach these routes, never the published package.
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/500.css';
	import '@fontsource/inter/600.css';
	import '@fontsource/jetbrains-mono/400.css';
	import '@fontsource/jetbrains-mono/700.css';
	import appCss from '../app.css?url';
	import '#lib/styles/editor-theme.css';
	import { installTypingBatchHandle } from './typing-batches';

	let { children }: { children: Snippet } = $props();

	installTypingBatchHandle();

	// Linked rather than imported, so `/test/no-reset` can stand in for a host page with no
	// stylesheet of its own.
	const pageStyles = $derived(page.route.id !== '/test/no-reset');
</script>

<svelte:head>
	{#if pageStyles}<link rel="stylesheet" href={appCss} />{/if}
</svelte:head>

{@render children()}
