/**
 * The width a list gives every item's marker cell: one column per list, as wide as its widest
 * marker, so the items' text lines up whatever their numbers' digits. Read from the tree, so an
 * item scrolled out of a windowed list still counts.
 */

import { metadataOf } from '../../../core/nodes';
import type { NodeView } from '../../../core/node-views';

/** What a drawn to-do box takes: the box, its gap and the trailing space, at body size. */
const TASK_BOX_INDENT = 'var(--md-task-indent)';

/** `drawsBoxes` is whether the mode draws a to-do's box in place of its `[ ]` bytes. */
export function markerColumn(items: readonly NodeView[], drawsBoxes: boolean): string {
	let widest = 0;
	let boxes = false;
	for (let i = 0; i < items.length; i++) {
		const meta = metadataOf(items[i], 'listItem');
		const taskMarker = meta?.taskItem ? meta.taskMarker : null;
		if (taskMarker && drawsBoxes) boxes = true;
		else widest = Math.max(widest, (meta?.marker ?? '- ').length + (taskMarker?.length ?? 0));
	}
	const chars = `calc(${widest} * 1ch)`;
	return boxes ? `max(${chars}, ${TASK_BOX_INDENT})` : chars;
}
