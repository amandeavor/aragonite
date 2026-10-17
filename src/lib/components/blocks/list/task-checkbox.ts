import type { AmbientPrefix } from '../../../block-component';
import type { ListItemMetadata } from '../../../core/nodes';
import { devWarn } from '../../../dev-warn';

/** The box's width and gap in editor.css plus the trailing space, at the body size the marker draws. */
export const TASK_BOX_INDENT = 'var(--md-task-indent, calc(2.1 * var(--editor-font-size, 1rem)))';

function isTaskMarkerChecked(taskMarker: string): boolean {
	const c = taskMarker[1];
	return c === 'x' || c === 'X';
}

/** Whether a block's container marker prefix draws a task box, making the block the to-do's text. */
export function ambientHoldsTaskBox(prefix: AmbientPrefix): boolean {
	return typeof prefix !== 'string' && !!prefix.interactive?.some((r) => r.role === 'checkbox');
}

/** `drawsBox` is whether the mode draws the box in place of the `[ ]` bytes; where it shows the
 *  bytes, they take the default column. */
export function buildTaskItemAmbient(
	metadata: ListItemMetadata | undefined,
	onToggle: () => void,
	drawsBox: boolean
): AmbientPrefix {
	const listMarker = metadata?.marker ?? '- ';

	const taskMarkerPresent = metadata?.taskMarker != null;
	if (metadata && metadata.taskItem !== taskMarkerPresent) {
		devWarn('ListItemBlock', 'taskItem / taskMarker inconsistent, rendering as plain list item', {
			taskItem: metadata.taskItem,
			taskMarker: metadata.taskMarker
		});
	}

	if (!metadata?.taskItem || !metadata.taskMarker) {
		return listMarker;
	}

	const boxStart = listMarker.length;
	return {
		text: listMarker + metadata.taskMarker,
		interactive: [
			{
				start: boxStart,
				end: boxStart + 3,
				className: 'task-checkbox',
				role: 'checkbox',
				// Read from the marker already in the render key, not a second checked field.
				ariaChecked: isTaskMarkerChecked(metadata.taskMarker),
				// The drawn box is taller than the text beside it, so it centres on the box.
				dragAnchor: true,
				onClick: onToggle
			},
			// The list marker gets a span of its own so the rendered modes can collapse it:
			// GitHub draws the box at the margin, not indented under a bullet that is not there.
			{ start: 0, end: boxStart, className: 'task-list-marker', onClick: () => {} }
		],
		indent: drawsBox ? TASK_BOX_INDENT : undefined
	};
}
