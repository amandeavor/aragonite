<script lang="ts">
	import { getContext } from 'svelte';
	import { EDITOR_SERVICES_KEY, type EditorServices } from '../editor-keys';
	import MenuIcon from './menu/MenuIcon.svelte';
	import {
		SEARCH_CLOSE_LABEL,
		SEARCH_CLOSE_TITLE,
		SEARCH_FIND,
		SEARCH_MATCH_CASE,
		SEARCH_NEXT_LABEL,
		SEARCH_NEXT_TITLE,
		SEARCH_PREVIOUS_LABEL,
		SEARCH_PREVIOUS_TITLE,
		SEARCH_REGEX,
		SEARCH_REPLACE,
		SEARCH_TOGGLE_REPLACE,
		SEARCH_WHOLE_WORD
	} from '../a11y-strings';

	// `replaceExpanded` is owned by Editor so the root Ctrl+H shortcut and the
	// chevron share one source of truth; the chevron reports toggles back up.
	let {
		replaceExpanded = false,
		onToggleReplace
	}: {
		replaceExpanded?: boolean;
		onToggleReplace?: () => void;
	} = $props();

	const { search } = getContext<EditorServices>(EDITOR_SERVICES_KEY);

	const OPTION_TOGGLES = [
		{ key: 'caseSensitive', icon: 'case-sensitive', text: SEARCH_MATCH_CASE },
		{ key: 'wholeWord', icon: 'whole-word', text: SEARCH_WHOLE_WORD },
		{ key: 'regex', icon: 'regex', text: SEARCH_REGEX }
	] as const;

	let findInput = $state<HTMLInputElement>();
	$effect(() => {
		if (search.isOpen) findInput?.focus();
	});

	// The steps and the replace buttons disable once no match is left, and a disabled button
	// can't keep focus, so focus moves to the field in the same row.
	let barEl = $state<HTMLElement>();
	$effect(() => {
		if (search.matches.length || !barEl) return;
		const focused = barEl.ownerDocument.activeElement;
		if (focused instanceof HTMLButtonElement && focused.disabled && barEl.contains(focused)) {
			focused.closest('.search-row')?.querySelector('input')?.focus();
		}
	});

	function onFindKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			e.shiftKey ? search.prev() : search.next();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			search.close();
		}
	}

	function onReplaceKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			search.replaceCurrent();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			search.close();
		}
	}
</script>

{#if search.isOpen}
	<div class="search-bar" role="search" bind:this={barEl}>
		<div class="search-row">
			<button
				type="button"
				class="search-icon-btn search-chevron"
				class:on={replaceExpanded}
				title={SEARCH_TOGGLE_REPLACE}
				aria-label={SEARCH_TOGGLE_REPLACE}
				aria-expanded={replaceExpanded}
				onclick={() => onToggleReplace?.()}><MenuIcon name="chevron-right" /></button
			>
			<!-- A label, so a click anywhere on the pill outside its buttons lands in the field. -->
			<label class="search-field" class:invalid={!!search.error}>
				<span class="search-glyph"><MenuIcon name="search" /></span>
				<input
					bind:this={findInput}
					class="search-input"
					placeholder={SEARCH_FIND}
					value={search.query}
					oninput={(e) => search.setQuery(e.currentTarget.value)}
					onkeydown={onFindKeydown}
					aria-label={SEARCH_FIND}
				/>
				<span
					class="search-count"
					class:error={!!search.error}
					role="status"
					title={search.error ?? undefined}
					>{#if search.error}
						{search.error}
					{:else if !search.query}
						<!-- Nothing to count yet. -->
					{:else if search.isScanning}
						Searching…
					{:else if search.matches.length}
						{search.activeIndex + 1} / {search.matches.length}
					{:else if search.replacedCount != null}
						{search.replacedCount} replaced
					{:else}
						No results
					{/if}</span
				>
				<span class="search-options">
					{#each OPTION_TOGGLES as toggle (toggle.key)}
						<button
							type="button"
							class="search-tog"
							class:on={search.options[toggle.key]}
							title={toggle.text}
							aria-label={toggle.text}
							aria-pressed={search.options[toggle.key]}
							onclick={() => search.setOptions({ [toggle.key]: !search.options[toggle.key] })}
							><MenuIcon name={toggle.icon} /></button
						>
					{/each}
				</span>
			</label>
			<span class="search-steps">
				<button
					type="button"
					class="search-icon-btn"
					title={SEARCH_PREVIOUS_TITLE}
					aria-label={SEARCH_PREVIOUS_LABEL}
					disabled={!search.matches.length}
					onclick={() => search.prev()}><MenuIcon name="chevron-up" size={16} /></button
				>
				<button
					type="button"
					class="search-icon-btn"
					title={SEARCH_NEXT_TITLE}
					aria-label={SEARCH_NEXT_LABEL}
					disabled={!search.matches.length}
					onclick={() => search.next()}><MenuIcon name="chevron-down" size={16} /></button
				>
				<span class="search-divider" aria-hidden="true"></span>
				<button
					type="button"
					class="search-icon-btn"
					title={SEARCH_CLOSE_TITLE}
					aria-label={SEARCH_CLOSE_LABEL}
					onclick={() => search.close()}><MenuIcon name="x" /></button
				>
			</span>
		</div>
		{#if replaceExpanded}
			<div class="search-row search-replace-row">
				<label class="search-field">
					<span class="search-glyph"><MenuIcon name="replace" /></span>
					<input
						class="search-input"
						placeholder={SEARCH_REPLACE}
						value={search.replacement}
						oninput={(e) => search.setReplacement(e.currentTarget.value)}
						onkeydown={onReplaceKeydown}
						aria-label={SEARCH_REPLACE}
					/>
				</label>
				<span class="search-steps">
					<button
						type="button"
						class="search-btn"
						disabled={!search.matches.length}
						onclick={() => search.replaceCurrent()}>Replace</button
					>
					<button
						type="button"
						class="search-btn"
						disabled={!search.matches.length}
						onclick={() => search.replaceAll()}>All</button
					>
				</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* A raised card holding one filled pill, with buttons that stay quiet until hovered. */
	.search-bar {
		position: absolute;
		/* The only placement knobs: the editor sets them at `.editor`, an anchor may set its own. */
		top: var(--search-bar-top, 10px);
		right: var(--search-bar-right, 10px);
		/* Content-sized off the right edge, so without the cap a narrow host puts the bar's
		   left half (the find field) off screen instead of shrinking it. */
		max-width: calc(100% - 2 * var(--search-bar-right, 10px));
		box-sizing: border-box;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		border-radius: 8px;
		background: var(--color-bg, #1e1e1d);
		border: 1px solid var(--color-border, #3e3e3b);
		box-shadow: var(--menu-shadow, 0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.35));
		font-family: var(--font-ui, system-ui, sans-serif);
		font-size: 13px;
		line-height: 1.4;
		color: var(--color-text-primary, #e8e8e5);
	}
	.search-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	/* The replace pill starts under the find pill, past the chevron's column. */
	.search-replace-row {
		padding-left: 32px;
	}

	.search-field {
		display: flex;
		align-items: center;
		gap: 7px;
		/* Shrinks before the row wraps, so a narrow host keeps the field and the steps together. */
		flex: 1 1 auto;
		min-width: 0;
		height: 30px;
		padding: 0 4px 0 11px;
		box-sizing: border-box;
		border-radius: 999px;
		background: var(--menu-chip-bg, rgba(255, 255, 255, 0.055));
		color: var(--color-ui-muted, #93938d);
		cursor: text;
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}
	.search-field:hover,
	.search-field:focus-within {
		background: var(--menu-chip-bg-hover, rgba(255, 255, 255, 0.085));
		color: var(--color-text-secondary, #cfcfca);
	}
	.search-field.invalid {
		background: color-mix(in srgb, var(--color-error, #e06c75) 12%, transparent);
	}
	.search-replace-row .search-field {
		padding-right: 11px;
	}
	.search-glyph {
		display: inline-flex;
		flex-shrink: 0;
	}
	.search-input {
		flex: 1;
		/* A floor, not a width: `min-width: auto` on a flex item is its intrinsic size, which
		   is what stops the field shrinking before the row wraps. */
		min-width: 6ch;
		width: 15em;
		padding: 0;
		border: 0;
		outline: none;
		background: transparent;
		font: inherit;
		color: var(--color-text-primary, #e8e8e5);
	}
	.search-input::placeholder {
		color: var(--color-ui-muted, #93938d);
	}
	.search-count {
		flex-shrink: 0;
		max-width: 16em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--color-ui-muted, #93938d);
	}
	/* Out of the flow rather than hidden, so the live region is there before its first count. */
	.search-count:empty {
		position: absolute;
	}
	.search-count.error {
		color: var(--color-error, #e06c75);
	}

	.search-options {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		flex-shrink: 0;
		padding-left: 4px;
		border-left: 1px solid var(--color-border, #3e3e3b);
	}

	.search-steps {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}
	.search-divider {
		width: 1px;
		height: 18px;
		margin: 0 3px;
		border-radius: 999px;
		background: var(--color-border, #3e3e3b);
	}

	.search-icon-btn,
	.search-tog,
	.search-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--color-ui-muted, #93938d);
		font: inherit;
		cursor: pointer;
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}
	.search-icon-btn {
		width: 28px;
		height: 28px;
		border-radius: 8px;
	}
	.search-tog {
		width: 24px;
		height: 24px;
		border-radius: 999px;
	}
	.search-btn {
		height: 28px;
		padding: 0 12px;
		border-radius: 999px;
		background: var(--menu-chip-bg, rgba(255, 255, 255, 0.055));
		color: var(--color-text-secondary, #cfcfca);
		font-size: 12px;
		font-weight: 500;
	}
	.search-icon-btn:hover:not(:disabled),
	.search-tog:hover,
	.search-btn:hover:not(:disabled) {
		background: var(--menu-chip-bg-hover, rgba(255, 255, 255, 0.085));
		color: var(--color-text-primary, #e8e8e5);
	}
	.search-icon-btn:focus-visible,
	.search-tog:focus-visible,
	.search-btn:focus-visible {
		outline: 1px solid var(--color-ui-muted, #93938d);
		outline-offset: 1px;
	}
	.search-icon-btn:disabled,
	.search-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.search-tog.on,
	.search-tog.on:hover {
		background: color-mix(in srgb, var(--color-text-primary, #e8e8e5) 16%, transparent);
		color: var(--color-text-primary, #e8e8e5);
	}

	.search-chevron :global(svg) {
		transition: transform 120ms ease;
	}
	.search-chevron.on :global(svg) {
		transform: rotate(90deg);
	}

	/* Forced colors drop every fill, and fills are all the field and a pressed toggle are drawn with. */
	@media (forced-colors: active) {
		.search-field {
			border: 1px solid CanvasText;
		}
		.search-field:focus-within {
			border-color: Highlight;
		}
		.search-tog.on,
		.search-tog.on:hover {
			forced-color-adjust: none;
			background: Highlight;
			color: HighlightText;
		}
	}

	/* A pointer with no hover is a thumb: every control clears the WCAG 2.5.8 24px minimum, and
	   the row wraps rather than crowding once they grow. */
	@media (pointer: coarse) {
		.search-icon-btn,
		.search-tog,
		.search-btn {
			min-width: 28px;
			min-height: 28px;
		}
	}
</style>
