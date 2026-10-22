/**
 * The keys a spec presses for what it means, spelled for the platform the run is on. On macOS
 * Home and End scroll the page, Ctrl+click is a right-click and Tab skips buttons, so a spec that
 * means a line edge, a word step, a copy drag or a walk through every control asks here.
 */

// Playwright resolves `ControlOrMeta` by this same test-process platform.
export const isMacOS = process.platform === 'darwin';
export const isWindows = process.platform === 'win32';

/** Where a caret key moves the caret: its visual line's edge, or the edge of its block's text
 *  (a table cell's, in a cell). */
export type CaretEdge = 'lineStart' | 'lineEnd' | 'blockStart' | 'blockEnd';

/** Where a Shift chord extends the selection's moving end: its visual line's edge, or the
 *  document's. */
export type ExtendEdge = 'lineStart' | 'lineEnd' | 'docStart' | 'docEnd';

type Edge = CaretEdge | ExtendEdge;

const KEY: Record<Edge, string> = {
	lineStart: 'Home',
	lineEnd: 'End',
	blockStart: 'ControlOrMeta+Home',
	blockEnd: 'ControlOrMeta+End',
	docStart: 'ControlOrMeta+Home',
	docEnd: 'ControlOrMeta+End'
};

const MAC_ARROW: Record<Edge, string> = {
	lineStart: 'ArrowLeft',
	lineEnd: 'ArrowRight',
	blockStart: 'ArrowUp',
	blockEnd: 'ArrowDown',
	docStart: 'ArrowUp',
	docEnd: 'ArrowDown'
};

/** The chord that moves the caret to `edge`: Home, End, Mod+Home or Mod+End, Cmd+Arrow on macOS. */
export function edgeKey(edge: CaretEdge): string {
	return isMacOS ? `Meta+${MAC_ARROW[edge]}` : KEY[edge];
}

/** The chord that extends the selection to `edge`: `edgeKey`'s chord with Shift held. */
export function extendKey(edge: ExtendEdge): string {
	return isMacOS ? `Shift+Meta+${MAC_ARROW[edge]}` : `Shift+${KEY[edge]}`;
}

/** The key that moves a menu's focus to its first or last item: Home and End on every platform (a
 *  Mac keyboard sends them as Fn+Left and Fn+Right), which the menu reads itself. */
export function listEdgeKey(edge: 'first' | 'last'): string {
	return edge === 'first' ? 'Home' : 'End';
}

/** The modifier that makes an arrow or Backspace step a word: Option on macOS, Ctrl elsewhere. */
export const WORD_MODIFIER: 'Alt' | 'Control' = isMacOS ? 'Alt' : 'Control';

/** The modifiers a drop reads as a copy. On macOS a Ctrl press is a right-click, so only Option. */
export const COPY_DRAG_MODIFIERS: readonly ('Control' | 'Alt')[] = isMacOS
	? ['Alt']
	: ['Control', 'Alt'];

/** The Tab that reaches every control, buttons included: macOS WebKit's plain Tab skips them
 *  unless Option is held. */
export function focusWalkKey(options: { backward?: boolean } = {}): string {
	const tab = options.backward ? 'Shift+Tab' : 'Tab';
	return isMacOS ? `Alt+${tab}` : tab;
}
