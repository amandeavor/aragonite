<script module lang="ts">
	import { DEMO_PLUGINS, DEMO_HIGHLIGHT_OCCURRENCES, DEMO_TAGS } from './demo-plugins';

	// The prop is the enablement set, so the toggle is the plugin's presence in the array.
	const WITHOUT_OCCURRENCES = DEMO_PLUGINS.filter((unit) => unit !== DEMO_HIGHLIGHT_OCCURRENCES);
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { Editor } from '#lib/svelte.js';
	import SHOWCASE_DOCUMENT from '../../examples/showcase/showcase-content.md?raw';
	import '../../examples/showcase/tag-marks.css';
	import {
		HANDLES_GATED_TITLE,
		INITIAL_STATE,
		PRESENTATION_MODES,
		TOGGLES,
		handlesGated,
		showsSelectionMenu
	} from '../../examples/showcase/controls';
	import { trackParityDocument } from './parity-documents.svelte';
	import DebugPanel from './debug-panel/DebugPanel.svelte';
	import InsertToolbar from './InsertToolbar.svelte';
	import ReportBug from './ReportBug.svelte';
	import { createPanelState } from './debug-panel/panel-state.svelte';
	import { createDebugPanelFeed } from './debug-panel/panel-feed.svelte';
	import { demoPasteImage, resolveDemoImageUrl } from '../../examples/showcase/image-store';

	// Props that can change while the editor runs: the toggles set these in place, no remount.
	let presentationMode = $state(INITIAL_STATE.presentationMode);
	let theme = $state(INITIAL_STATE.theme);

	// The showcase installs no test probes, so `trackParityDocument` is the only thing putting
	// its container-heavy document under the teardown parity check.
	let editor = $state<ReturnType<typeof Editor>>();
	trackParityDocument(() => editor);

	// blockDragHandles and the plugin set are both fixed at mount, so their toggles remount the
	// editor through {#key}, passing the current content across so a visitor's edits survive.
	let source = $state(SHOWCASE_DOCUMENT);
	let dragHandles = $state(INITIAL_STATE.dragHandles);
	let occurrences = $state(INITIAL_STATE.occurrences);
	let selectionMenu = $state(INITIAL_STATE.selectionMenu);
	// In-body tags are a consumer's plugin, not one of ours: the showcase runs them beside the
	// bundled tour so a `#tag` can be tried against everything else.
	const showcasePlugins = $derived([
		...(occurrences ? DEMO_PLUGINS : WITHOUT_OCCURRENCES),
		DEMO_TAGS
	]);

	function toggleDragHandles() {
		if (editor) source = editor.getSource();
		dragHandles = !dragHandles;
	}

	function toggleOccurrences() {
		if (editor) source = editor.getSource();
		occurrences = !occurrences;
	}

	const handlesOff = $derived(handlesGated(presentationMode));

	// Kept here rather than inside the panel, so the header button and the panel's own
	// Ctrl+Shift+D drive one state.
	const panel = createPanelState();
	const panelFeed = createDebugPanelFeed(() => editor);
</script>

<div class="showcase aragonite-editor-theme" data-editor-theme={theme}>
	<header class="showcase-header">
		<span class="showcase-title">aragonite</span>
		<span class="showcase-tag">showcase</span>
		<!-- Left of the mode group's auto margin: the open debug panel is fixed to the right
		     edge and would otherwise cover the button that closes it. -->
		<button
			type="button"
			class="showcase-toggle"
			class:active={theme === 'light'}
			data-testid={TOGGLES.theme.testId}
			aria-pressed={theme === 'light'}
			onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')}
		>
			{TOGGLES.theme.label}
		</button>
		<button
			type="button"
			class="showcase-toggle"
			class:active={dragHandles}
			data-testid={TOGGLES.dragHandles.testId}
			aria-pressed={dragHandles}
			disabled={handlesOff}
			title={handlesOff ? HANDLES_GATED_TITLE : undefined}
			onclick={toggleDragHandles}
		>
			{TOGGLES.dragHandles.label}
		</button>
		<button
			type="button"
			class="showcase-toggle"
			class:active={selectionMenu}
			data-testid={TOGGLES.selectionMenu.testId}
			aria-pressed={selectionMenu}
			title={TOGGLES.selectionMenu.title}
			onclick={() => (selectionMenu = !selectionMenu)}
		>
			{TOGGLES.selectionMenu.label}
		</button>
		<button
			type="button"
			class="showcase-toggle"
			class:active={occurrences}
			data-testid={TOGGLES.occurrences.testId}
			aria-pressed={occurrences}
			title={TOGGLES.occurrences.title}
			onclick={toggleOccurrences}
		>
			{TOGGLES.occurrences.label}
		</button>
		<button
			type="button"
			class="showcase-toggle"
			class:active={panel.open}
			data-testid="debug-toggle"
			aria-pressed={panel.open}
			onclick={() => panel.toggle()}
		>
			under the hood
		</button>
		<ReportBug {editor} mode={presentationMode} />
		<span class="showcase-hint">Mod+F to search</span>
		<div class="showcase-modes" role="group" aria-label="Presentation mode">
			{#each PRESENTATION_MODES as mode (mode)}
				<button
					type="button"
					class="showcase-mode"
					class:active={presentationMode === mode}
					data-mode={mode}
					onclick={() => (presentationMode = mode)}
				>
					{mode}
				</button>
			{/each}
		</div>
		<a class="showcase-link" href="https://github.com/voithos-labs/aragonite/tree/main/docs">docs</a
		>
		<a class="showcase-link" href={resolve('/changelog')}>changelog</a>
	</header>
	<!-- Both toolbars belong to live mode, where the document is edited as it looks; the
	     markdown-first modes stay bare. -->
	{#if presentationMode === 'live'}
		<InsertToolbar {editor} />
	{/if}
	<div class="showcase-editor">
		{#key `${dragHandles}:${occurrences}`}
			<Editor
				bind:this={editor}
				{source}
				plugins={showcasePlugins}
				blockDragHandles={dragHandles}
				onPasteImage={demoPasteImage}
				resolveImageUrl={resolveDemoImageUrl}
				{presentationMode}
				linkClick="plain"
				selectionToolbar={showsSelectionMenu(presentationMode, selectionMenu)}
				{theme}
			/>
		{/key}
	</div>
	<DebugPanel {panel} {...panelFeed} />
</div>

<style>
	.showcase {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		/* The wrapper holds the theme tokens, so the page around the editor switches with it. */
		background: var(--color-bg, #2c2c2a);
		color: var(--color-text-secondary, #cfcfca);
		/* The host app's two typefaces: proportional for the text, and code that stays monospace
		   whatever the text face is. Set on the wrapper, which is where a consumer sets them. */
		--font-editor: 'Inter', system-ui, sans-serif;
		--font-code: 'JetBrains Mono', ui-monospace, monospace;
		font-family: var(--font-ui, system-ui, sans-serif);
	}

	/* Soft Light: the page switches with the editor, from the same data attribute. */
	.showcase[data-editor-theme='light'] {
		--color-bg: #dfddd7;
		--color-border: #c9c7c0;
		--color-text-primary: #2a2a27;
		--color-text-secondary: #4a4a45;
		--color-ui-dulled: #5c5c56;
		--color-ui-muted: #62625c;
	}
	.showcase-header {
		flex: 0 0 auto;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border, #3e3e3b);
		font-family: var(--font-ui, system-ui, sans-serif);
	}
	.showcase-title {
		font-size: 1.1rem;
		font-weight: 600;
	}
	.showcase-tag {
		font-size: 0.85rem;
		color: var(--color-text-muted, #888);
	}
	.showcase-modes {
		margin-left: auto;
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--color-border, #3e3e3b);
		border-radius: 8px;
	}
	/* Reached into children, so the report button its own component draws looks like the rest. */
	.showcase-mode,
	.showcase-header :global(.showcase-toggle) {
		font-family: inherit;
		font-size: 0.8rem;
		padding: 0.1rem 0.55rem;
		color: var(--color-text-muted, #888);
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		/* A pill is one word wide; wrapping its label doubles the header's row height. */
		white-space: nowrap;
	}
	.showcase-mode.active,
	.showcase-header :global(.showcase-toggle.active) {
		color: var(--color-text-primary, #e8e8e5);
		background: var(--color-ui-faint, rgba(255, 255, 255, 0.07));
	}
	.showcase-header :global(.showcase-toggle:disabled) {
		opacity: 0.4;
		cursor: default;
	}
	.showcase-hint {
		font-size: 0.75rem;
		color: var(--color-text-muted, #888);
	}
	.showcase-link {
		font-size: 0.85rem;
		color: var(--color-accent, #567b67);
	}
	/* The scroll container spans the window so its margins are the editor's own empty space,
	   where a drag can start; the reading column is the root's padding. */
	.showcase-editor {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 0;
		min-height: 0;
	}
	.showcase-editor :global(.editor) {
		box-sizing: border-box;
		padding-left: max(1rem, calc((100% - 1000px) / 2));
		padding-right: max(1rem, calc((100% - 1000px) / 2));
	}
	/* The library paints the overlay's geometry and leaves its color to the host page. */
	.showcase-editor :global(.decoration-overlay.hl-occurrence) {
		background: rgba(250, 204, 21, 0.18);
	}

	/* On a phone the header condenses and drops what a phone cannot use, so the document
	   keeps the screen. */
	@media (max-width: 640px) {
		.showcase-header {
			gap: 0.3rem 0.45rem;
			padding: 0.45rem 0.6rem;
		}
		/* No modifier key on a phone, and the tag repeats what the title already says. */
		.showcase-tag,
		.showcase-hint {
			display: none;
		}
		.showcase-title {
			font-size: 1rem;
		}
		.showcase-mode,
		.showcase-header :global(.showcase-toggle) {
			font-size: 0.7rem;
			padding: 0.1rem 0.4rem;
		}
		/* The mode group takes its own row and wraps, so no pill runs past the right edge. */
		.showcase-modes {
			margin-left: 0;
			flex: 1 0 100%;
			flex-wrap: wrap;
			justify-content: center;
		}
	}

	/* Every header control clears the minimum touch size, the links included, even at the
	   cost of header rows. */
	@media (pointer: coarse) {
		.showcase-mode,
		.showcase-header :global(.showcase-toggle),
		.showcase-link {
			display: inline-flex;
			align-items: center;
			min-height: 24px;
		}
	}
</style>
