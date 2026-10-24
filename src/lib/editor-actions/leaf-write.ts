/**
 * The keystroke's two calls to the editor root: grouping it with its typing burst in the undo
 * history, and the in-place write through the commit frame. Containers reach both through
 * `ContainerEditActions`.
 */

import type { ContainerEditActions } from '../action-contracts';
import type { UndoController } from './deps';

/** `typeInLeaf` starts the undo pause timer when `work` finishes, even if it throws. */
export type LeafTyping = Pick<ContainerEditActions, 'typeInLeaf' | 'typeLeaf'>;

export function createLeafTyping(controller: UndoController): LeafTyping {
	return {
		typeInLeaf(leafPath, preEditOffset, batchKey, work) {
			controller.pushUndoSnapshotDebounced(leafPath, preEditOffset, batchKey);
			// A batch whose pause timer never started never ends on a pause, so the timer starts
			// even when the keystroke's work throws.
			return controller.joinTypingBatch(work).finally(() => controller.armUndoPause());
		},

		typeLeaf: controller.typeLeaf
	};
}
