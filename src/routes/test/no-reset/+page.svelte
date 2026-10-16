<script lang="ts">
	import { untrack } from 'svelte';
	import {
		type Decoration,
		type DecorationSource,
		type InlineMenuSource,
		type PluginView
	} from '#lib';
	import { Editor, svelteView } from '#lib/svelte.js';
	import type { KeybindingOverride } from '#lib/schema/keybinding-overrides.js';
	import { installTestProbes } from '../editor/test-probes';
	import { HarnessSource } from '../editor/harness-source.svelte';
	import { trackParityDocument } from '../../parity-documents.svelte';
	import HostRow from './HostRow.svelte';
	import type { PageData } from './$types';

	// A host page with no stylesheet of its own: the root layout skips app.css here, so the page
	// keeps the browser's default margins, padding and `content-box` sizing, as a new Vite app does.
	// Dressed in `/test/editor`'s fonts, theme and drag handles, so the two editors' blocks compare.

	let { data }: { data: PageData } = $props();

	const source = new HarnessSource('A paragraph.\n');
	let keybindings = $state<KeybindingOverride[] | undefined>(undefined);
	let editor = $state<ReturnType<typeof Editor>>();
	let findBarSlot = $state<HTMLElement>();

	trackParityDocument(() => editor);

	const hostButton = (label: string) => () => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'host-button';
		button.textContent = label;
		return button;
	};
	const hostView =
		(label: string): PluginView<{ decoration: Decoration }> =>
		(target) => {
			target.append(hostButton(label)());
			return {};
		};

	const hostDecorations: DecorationSource = {
		name: 'host-widgets',
		provide: (doc) =>
			doc.children.length === 0
				? []
				: [
						{ type: 'widget', path: [0], offset: 0, widget: { view: hostView('widget') } },
						{ type: 'block', path: [0], badge: { view: hostView('badge') } }
					]
	};

	const hostMenu = (name: string, trigger: string, row: InlineMenuSource['row']) => ({
		name,
		trigger,
		row,
		items: () => [{ id: name, label: name, insert: name }]
	});

	$effect(() => {
		if (!editor) return;
		installTestProbes({
			editor,
			source,
			setKeybindings: (overrides) => (keybindings = overrides),
			setPresentationMode: () => {}
		});
	});

	$effect(() => {
		const instance = editor;
		if (!instance || !data.hostContent) return;
		// Untracked: adding a source reads the state it then writes.
		const handles = untrack(() => [
			instance.getDecorations().addSource(hostDecorations),
			instance.getInlineMenus().addSource(hostMenu('component-row', '@@', svelteView(HostRow))),
			instance.getInlineMenus().addSource(
				hostMenu('dom-row', '%%', (target, { item }) => {
					target.append(hostButton(item.label)());
					return {};
				})
			)
		]);
		return () => handles.forEach((handle) => handle.dispose());
	});
</script>

{#snippet hostHeader()}
	<p class="host-paragraph">A host paragraph</p>
	<button type="button" class="host-button">A host button</button>
	{#if data.findBarInHeader}<div class="find-bar-slot" bind:this={findBarSlot}></div>{/if}
{/snippet}

<div class="no-reset aragonite-editor-theme" data-editor-theme="dark">
	<!-- What the host's own elements look like outside the editor, to compare its content inside. -->
	{#if data.hostContent}
		<div class="reference" data-testid="reference">
			<p class="host-paragraph">A reference paragraph</p>
			<button type="button" class="host-button">A reference button</button>
		</div>
	{/if}
	<div class="editor-box" data-testid="editor-box" style:width={data.width && `${data.width}px`}>
		<Editor
			bind:this={editor}
			source={source.text}
			{keybindings}
			blockDragHandles
			header={data.hostContent ? hostHeader : undefined}
			searchBarAnchor={findBarSlot}
		/>
	</div>
</div>

<style>
	.no-reset {
		--font-ui: Inter, system-ui, sans-serif;
		--font-editor: Inter, system-ui, sans-serif;
		--font-code: 'JetBrains Mono', ui-monospace, monospace;
		background: var(--color-bg);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
	}
	.find-bar-slot {
		position: relative;
		height: 60px;
	}
	.editor-box {
		display: flex;
		flex-direction: column;
		height: 70vh;
	}
</style>
