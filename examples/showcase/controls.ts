/**
 * The showcase's header controls as data, so the Svelte, React and Vue showcases offer the same
 * controls under the same test ids and open in the same state. Each host draws its own buttons.
 */

export const PRESENTATION_MODES = [
	'source',
	'reading',
	'preview-block',
	'preview-inline',
	'live'
] as const;

export type ShowcaseMode = (typeof PRESENTATION_MODES)[number];
export type ShowcaseTheme = 'light' | 'dark';

export interface ShowcaseToggle {
	testId: string;
	label: string;
	title?: string;
}

export const TOGGLES = {
	// Pressed means light, the theme the page opens in.
	theme: { testId: 'theme-toggle', label: 'light' },
	dragHandles: { testId: 'drag-handles-toggle', label: 'handles' },
	selectionMenu: {
		testId: 'selection-menu-toggle',
		label: 'selection menu',
		title: 'Show the formatting menu over a selection'
	},
	occurrences: {
		testId: 'occurrences-toggle',
		label: 'occurrences',
		title: 'Highlight every other occurrence of the word under the caret'
	},
	source: {
		testId: 'source-toggle',
		label: 'show source',
		title: 'Show the Markdown the editor holds'
	}
} as const satisfies Record<string, ShowcaseToggle>;

export const INITIAL_STATE = {
	theme: 'light' as ShowcaseTheme,
	presentationMode: 'live' as ShowcaseMode,
	dragHandles: true,
	selectionMenu: true,
	occurrences: false,
	showSource: false
};

// The editor turns the handles off in reading mode, so an enabled toggle there would show a state
// it cannot produce.
export const HANDLES_GATED_TITLE = 'Reading mode hides the drag handles';

export function handlesGated(mode: ShowcaseMode): boolean {
	return mode === 'reading';
}

/** The selection menu belongs to live mode, where the document is edited as it looks. */
export function showsSelectionMenu(mode: ShowcaseMode, enabled: boolean): boolean {
	return mode === 'live' && enabled;
}
