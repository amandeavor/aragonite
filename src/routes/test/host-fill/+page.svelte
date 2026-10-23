<script lang="ts">
	import { createEditor, type EditorHandle } from '#lib';
	import { Editor } from '#lib/svelte.js';
	import { trackParityDocument } from '../../parity-documents.svelte';
	import type { PageData } from './$types';

	// A long document in a plain block box, mounted by `?host=svelte` or `?host=create-editor`,
	// with the box `?height=` px tall or left to its content. `?scroll=host` makes the box the
	// editor's scroller.

	let { data }: { data: PageData } = $props();

	const SOURCE =
		Array.from({ length: 300 }, (_, i) => `Paragraph ${i + 1}, long enough to fill a line.`).join(
			'\n\n'
		) + '\n';
	// svelte-ignore state_referenced_locally
	const scrollMode = data.hostScroll ? 'host' : 'self';

	let component = $state<ReturnType<typeof Editor>>();
	let handle = $state<EditorHandle>();
	let target = $state<HTMLElement>();

	// `createEditor`'s handle carries the component's test surface; its public type leaves it out.
	trackParityDocument(() => component ?? (handle as ReturnType<typeof Editor> | undefined));

	$effect(() => {
		if (!target) return;
		const mounted = createEditor(target, { source: SOURCE, theme: 'light', scrollMode });
		handle = mounted;
		return () => mounted.destroy();
	});
</script>

<div class="aragonite-editor-theme" data-editor-theme="light">
	{#if data.host === 'svelte'}
		<div
			data-testid="host"
			style:height={data.height && `${data.height}px`}
			style:overflow-y={data.hostScroll ? 'auto' : undefined}
		>
			<Editor bind:this={component} source={SOURCE} theme="light" {scrollMode} />
		</div>
	{:else}
		<div
			data-testid="host"
			style:height={data.height && `${data.height}px`}
			style:overflow-y={data.hostScroll ? 'auto' : undefined}
			bind:this={target}
		></div>
	{/if}
</div>
