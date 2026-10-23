/**
 * The width a list gives every item's marker cell: one column per list, as wide as its widest
 * list marker, so the items' text lines up whatever their numbers' digits. Where bytes show, a
 * to-do's `[ ] ` draws past the column. Sized from the marker-width counts the list node keeps,
 * so an item scrolled out of a windowed list still counts and no keystroke rereads the items.
 */

import { widestMarkers, type MarkerWidths } from '../../../core/parsers/list';

/** What a drawn to-do box takes: the box, its gap and the trailing space, at body size. */
const TASK_BOX_INDENT = 'var(--md-task-indent)';

/** `drawsBoxes` is whether the mode draws a to-do's box in place of its `[ ]` bytes. */
export function markerColumn(counts: MarkerWidths, drawsBoxes: boolean): string {
	const { plain, task, anyTask } = widestMarkers(counts);
	if (!drawsBoxes) return `calc(${Math.max(plain, task)} * 1ch)`;
	const chars = `calc(${plain} * 1ch)`;
	return anyTask ? `max(${chars}, ${TASK_BOX_INDENT})` : chars;
}
