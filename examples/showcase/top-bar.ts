/**
 * The showcase's top bar as plain DOM, so the Svelte, React and Vue showcases mount one copy: the
 * wordmark, the presentation-mode switcher, the links, report a bug and the settings popover. The
 * host owns the state: it passes each change to `update` and hears clicks through the callbacks.
 */
import { el, icon, setAttrs } from './bar-dom';
import {
	HANDLES_GATED_TITLE,
	PRESENTATION_MODES,
	TOGGLES,
	handlesGated,
	type ShowcaseMode,
	type ShowcaseToggle
} from './controls';
import { dismissPopover } from './popover';
import { mountReportBug, type RecordingEditor } from './report-bug';

export type ToggleKey = keyof typeof TOGGLES;

export interface ShowcaseBarState {
	mode: ShowcaseMode;
	/** Each settings row's switch; a key left out reads as off. */
	pressed: Partial<Record<ToggleKey, boolean>>;
}

export interface ShowcaseBarOptions {
	/** Named beside the wordmark ("in React"), for a showcase not on the Svelte site. */
	framework?: string;
	changelogHref: string;
	/** The rows only this host can offer, under the shared settings. */
	tools: readonly ToggleKey[];
	onMode: (mode: ShowcaseMode) => void;
	onToggle: (key: ToggleKey) => void;
	editor: () => RecordingEditor | null | undefined;
}

export interface ShowcaseBar {
	update(state: ShowcaseBarState): void;
	destroy(): void;
}

export const REPO_URL = 'https://github.com/voithos-labs/aragonite';
const DOCS_URL = `${REPO_URL}/tree/main/docs`;
const SETTINGS: readonly ToggleKey[] = ['theme', 'dragHandles', 'selectionMenu', 'occurrences'];

export function mountShowcaseBar(
	header: HTMLElement,
	options: ShowcaseBarOptions,
	initial: ShowcaseBarState
): ShowcaseBar {
	let state = initial;

	// ── Wordmark ──
	const wordmark = el(
		'a',
		{
			class: 'showcase-wordmark',
			href: REPO_URL,
			'aria-label': 'aragonite on GitHub',
			title: 'aragonite on GitHub'
		},
		'aragonite',
		icon('github', 14)
	);
	const brand = el('div', { class: 'showcase-brand' }, wordmark);
	if (options.framework) {
		brand.append(el('span', { class: 'showcase-framework' }, `in ${options.framework}`));
	}

	// ── Mode switcher: segments when wide, a chip and a list when narrow ──
	const segments = PRESENTATION_MODES.map((mode) => {
		const segment = el(
			'button',
			{ type: 'button', class: 'showcase-mode', 'data-mode': mode },
			mode
		);
		segment.addEventListener('click', () => options.onMode(mode));
		return segment;
	});
	const modes = el(
		'div',
		{ class: 'showcase-modes', role: 'group', 'aria-label': 'Presentation mode' },
		...segments
	);
	const modeLabel = el('span');
	const modeTrigger = el(
		'button',
		{ type: 'button', class: 'showcase-mode-trigger', 'aria-expanded': 'false' },
		modeLabel,
		icon('chevron', 14)
	);
	const modeList = popover('showcase-mode-picker', modeTrigger, paint, () =>
		el(
			'div',
			{
				class: 'showcase-popover showcase-mode-list',
				role: 'group',
				'aria-label': 'Presentation mode'
			},
			...PRESENTATION_MODES.map((mode) => {
				const option = el(
					'button',
					{ type: 'button', class: 'showcase-row showcase-mode-option', 'data-mode': mode },
					mode
				);
				option.addEventListener('click', () => {
					options.onMode(mode);
					modeList.close();
				});
				return option;
			})
		)
	);

	// ── Settings ──
	const rows = new Map<ToggleKey, { row: HTMLButtonElement; desc: HTMLElement }>();
	const settingsTrigger = el(
		'button',
		{
			type: 'button',
			class: 'showcase-icon-btn',
			'data-testid': 'showcase-settings',
			'aria-label': 'Settings',
			'aria-expanded': 'false'
		},
		icon('settings', 16)
	);
	const settings = popover('showcase-popover-anchor', settingsTrigger, paint, () => {
		rows.clear();
		const divider = () => el('div', { class: 'showcase-popover-divider', role: 'separator' });
		const panel = el(
			'div',
			{ class: 'showcase-popover showcase-settings', role: 'group', 'aria-label': 'Settings' },
			...SETTINGS.map(settingRow),
			...(options.tools.length ? [divider(), ...options.tools.map(settingRow)] : []),
			divider(),
			el(
				'div',
				{ class: 'showcase-popover-foot' },
				el('span', {}, 'Search the document'),
				el('span', { class: 'showcase-kbd' }, el('kbd', {}, modKey()), el('kbd', {}, 'F'))
			),
			el(
				'div',
				{ class: 'showcase-popover-links' },
				divider(),
				el('a', { class: 'showcase-row', href: DOCS_URL }, 'docs'),
				el('a', { class: 'showcase-row', href: options.changelogHref }, 'changelog')
			)
		);
		return panel;
	});

	function settingRow(key: ToggleKey): HTMLButtonElement {
		const toggle = TOGGLES[key];
		const desc = el('span', { class: 'showcase-row-desc' });
		const row = el(
			'button',
			{ type: 'button', class: 'showcase-row', 'data-testid': toggle.testId },
			el('span', { class: 'showcase-row-text' }, el('span', {}, toggle.label), desc),
			el('span', { class: 'showcase-switch', 'aria-hidden': 'true' })
		);
		row.addEventListener('click', () => options.onToggle(key));
		rows.set(key, { row, desc });
		return row;
	}

	// ── Assembly ──
	const report = mountReportBug({ editor: options.editor, mode: () => state.mode });
	const end = el(
		'div',
		{ class: 'showcase-end' },
		el('a', { class: 'showcase-link', href: DOCS_URL }, 'docs'),
		el('a', { class: 'showcase-link', href: options.changelogHref }, 'changelog'),
		el('span', { class: 'showcase-sep', 'aria-hidden': 'true' }),
		report.anchor,
		settings.anchor
	);
	header.replaceChildren(el('div', { class: 'showcase-bar' }, brand, modes, modeList.anchor, end));

	function paint() {
		for (const segment of segments) {
			setAttrs(segment, { 'aria-pressed': String(segment.dataset.mode === state.mode) });
		}
		modeLabel.textContent = state.mode;
		setAttrs(modeTrigger, { 'aria-label': `Presentation mode: ${state.mode}` });
		for (const option of modeList.panel?.querySelectorAll<HTMLElement>('[data-mode]') ?? []) {
			const current = option.dataset.mode === state.mode;
			setAttrs(option, { 'aria-pressed': String(current) });
			option.querySelector('svg')?.remove();
			if (current) option.append(icon('check', 14));
		}
		for (const [key, { row, desc }] of rows) {
			const gated = key === 'dragHandles' && handlesGated(state.mode) ? HANDLES_GATED_TITLE : null;
			setAttrs(row, {
				'aria-pressed': String(state.pressed[key] ?? false),
				disabled: gated !== null
			});
			const toggle: ShowcaseToggle = TOGGLES[key];
			desc.textContent = gated ?? toggle.title ?? '';
		}
	}

	paint();
	return {
		update(next) {
			state = next;
			paint();
		},
		destroy() {
			modeList.close();
			settings.close();
			report.destroy();
			header.replaceChildren();
		}
	};
}

/** A trigger and the popover it opens below it, built fresh on each open and painted once in. */
function popover(
	anchorClass: string,
	trigger: HTMLButtonElement,
	paint: () => void,
	build: () => HTMLElement
) {
	const anchor = el('div', { class: anchorClass }, trigger);
	let panel: HTMLElement | null = null;
	let release: (() => void) | null = null;
	const result = {
		anchor,
		get panel() {
			return panel;
		},
		close() {
			release?.();
			release = null;
			panel?.remove();
			panel = null;
			setAttrs(trigger, { 'aria-expanded': 'false' });
		}
	};
	trigger.addEventListener('click', () => {
		if (panel) return result.close();
		panel = build();
		anchor.append(panel);
		paint();
		setAttrs(trigger, { 'aria-expanded': 'true' });
		release = dismissPopover(anchor, result.close);
	});
	return result;
}

function modKey(): string {
	return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
}
