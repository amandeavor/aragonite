/**
 * The line-start key in a text block whose first line starts behind a marker (`- `, `- [ ] `,
 * `[^1]: `) or a leading widget, where the browser's own line start lands outside the text. Home
 * and Cmd+Left (with Shift, extending) go to the line's start; only on the first line does the
 * editor place that start itself.
 */

import { isAtFirstVisualLine, type CaretBounds } from '../../../caret/visual-lines';
import { caretEdgeKey } from '../../../schema/keybindings';
import {
	landableStartAbutsIsland,
	markerPrefixOf,
	type CaretWriter
} from '../../../caret/widget-offset';

export interface HomeKeyDeps {
	getEl(): HTMLElement | null;
	/** The first and last offsets a caret can sit at. */
	caretBounds(): CaretBounds;
	/** The selection's moving end in raw offsets, or null when it isn't in this block. */
	getFocusOffset(): number | null;
	/** A collapsed caret at the start of the text, through the clamp every caret placement takes. */
	focusContentStart(): void;
	/** The editor's caret writer, which Shift+Home extends the selection through. */
	caretWriter: CaretWriter;
}

/** True when the key was handled here, its default prevented. */
export function handleHomeKey(e: KeyboardEvent, deps: HomeKeyDeps): boolean {
	// Mod+Home is the shared keydown's, which a table cell runs too.
	const edge = caretEdgeKey(e);
	if (edge?.to !== 'line' || edge.side !== 'start') return false;
	const el = deps.getEl();
	if (!el || (markerPrefixOf(el) === null && !landableStartAbutsIsland(el))) return false;
	const bounds = deps.caretBounds();
	const focus = deps.getFocusOffset() ?? bounds.start;
	if (!isAtFirstVisualLine(el, focus, bounds)) return false;
	e.preventDefault();
	if (edge.extend) deps.caretWriter.extendSelectionToRaw(el, bounds.start);
	else deps.focusContentStart();
	return true;
}
