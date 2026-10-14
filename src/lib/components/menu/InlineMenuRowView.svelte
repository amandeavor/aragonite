<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { mountPluginView, type PluginView } from '../../plugin-view';
	import type { InlineMenuRowProps } from '../../inline-menu/types';

	// A source's own row drawn by its view, mounted once per item; the default row stands in once
	// the view throws.
	let {
		view,
		item,
		active,
		query,
		report,
		subject,
		fallback
	}: InlineMenuRowProps & {
		view: PluginView<InlineMenuRowProps>;
		report: (error: unknown) => void;
		subject: string;
		fallback: Snippet;
	} = $props();

	let failed = $state(false);

	const drawRow: Attachment<HTMLElement> = (target) => {
		const props = () => ({ item, active, query });
		const rowView = view;
		const mounted = untrack(() => mountPluginView(rowView, target, props(), { report, subject }));
		if (!mounted) {
			failed = true;
			return;
		}
		let mounting = true;
		$effect(() => {
			const next = props();
			if (mounting) mounting = false;
			else if (!untrack(() => mounted.update(next))) failed = true;
		});
		return () => mounted.destroy();
	};
</script>

{#if failed}
	{@render fallback()}
{:else}
	<span class="inline-menu-host-row" data-host-content {@attach drawRow}></span>
{/if}

<style>
	/* The view's DOM lays out as a direct child of the menu row. */
	.inline-menu-host-row {
		display: contents;
	}
</style>
