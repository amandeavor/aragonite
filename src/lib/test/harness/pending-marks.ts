// One stand-in block's pending marks, for a test that asks whether a route keeps or drops them:
// pended by the chord's own call, read through the records the block's next insertion would spend.

import type { CaretMemory } from '#lib/caret/caret-memory.js';
import type { InlineMarkKind } from '#lib/schema/inline-construct-policy.js';

const STAND_IN = {};

export function pendMark(
	memory: Pick<CaretMemory, 'pendingMarks'>,
	kind: InlineMarkKind = 'strong'
): void {
	memory.pendingMarks.forBlock(STAND_IN).toggle(kind);
}

/** Whether the stand-in block's next insertion would carry marks. */
export function marksPending(memory: Pick<CaretMemory, 'previewInsertion'>): boolean {
	return memory.previewInsertion(STAND_IN).waitsAt(0);
}
