import type { AmbientPrefix } from '../../../block-component';
import { metadataOf, type ListItemMetadata } from '../../../core/nodes';
import type { NodeView } from '../../../core/node-views';
import { devWarn } from '../../../dev-warn';

function isTaskMarkerChecked(taskMarker: string): boolean {
	const c = taskMarker[1];
	return c === 'x' || c === 'X';
}

/** Whether the block at `index` inside `parent` is a to-do's own text, the line its box labels. */
export function isTaskItemText(parent: NodeView | null, index: number): boolean {
	return index === 0 && parent?.kind === 'listItem' && !!metadataOf(parent, 'listItem').taskItem;
}

export function buildTaskItemAmbient(
	metadata: ListItemMetadata | undefined,
	onToggle: () => void
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
		]
	};
}
