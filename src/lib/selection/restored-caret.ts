/**
 * A block that puts a restored caret (undo, redo, `setSelection`) down itself, so a caret inside an
 * inline widget that can show its source opens that source. Internal: a block without it gets the
 * plain caret write.
 */
import type { BlockComponent } from '../block-component';

export interface LandsRestoredCaret {
	landRestoredCaret(offset: number): void;
}

export function landsRestoredCaret(
	component: BlockComponent
): component is BlockComponent & LandsRestoredCaret {
	return typeof (component as Partial<LandsRestoredCaret>).landRestoredCaret === 'function';
}
