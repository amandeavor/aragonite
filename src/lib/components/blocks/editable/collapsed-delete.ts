/**
 * Where a collapsed delete is decided for every editable leaf: the browser's delete is prevented
 * and the block writes the bytes (`caret/delete-extent.ts`), so all engines take the same text. A
 * delete it declines goes on to the browser and is read back on `input`.
 */

import {
	characterExtent,
	decidedDelete,
	type DeleteDecline,
	type DeleteDirection,
	type DeleteIntent,
	type DeleteVerdict
} from '../../../caret/delete-extent';
import type { RawRange } from '../../../caret/widget-offset';

export interface CollapsedDeleteReads {
	composing(): boolean;
	caret(): number | null;
	hasRange(): boolean;
	/** The text the caret counts into, as the block shows it now. */
	text(): string;
	/** The raw range the browser reports the input would take, null where it names none. */
	targetRange(e: InputEvent): RawRange | null;
	deleteAtCaret?: (caret: number, intent: DeleteIntent) => boolean;
}

/** The verdict on a `beforeinput` the editor decides deletes for; null for every other input.
 *  `keyed` says a Backspace or Delete keydown opened it, rather than a soft keyboard. */
export function decideCollapsedDelete(
	e: InputEvent,
	keyed: boolean,
	reads: CollapsedDeleteReads
): DeleteVerdict | null {
	const intent = decidedDelete(e.inputType);
	if (!intent) return null;
	const caret = reads.caret();
	const decline = declineReason(e, intent, caret, keyed, reads);
	if (decline || caret === null) return { decided: false, decline: decline ?? 'no-caret' };
	if (!reads.deleteAtCaret?.(caret, intent)) return { decided: false, decline: 'surface' };
	e.preventDefault();
	return { decided: true };
}

function declineReason(
	e: InputEvent,
	intent: DeleteIntent,
	caret: number | null,
	keyed: boolean,
	reads: CollapsedDeleteReads
): DeleteDecline | null {
	if (e.isComposing || reads.composing()) return 'composing';
	if (!e.cancelable) return 'not-cancelable';
	if (reads.hasRange()) return 'range';
	if (caret === null) return 'no-caret';
	// A word or line names its own reach; only a one-character delete can be an autocorrect's.
	const character = intent.unit === 'character';
	if (!keyed && character && widerThanCharacter(e, intent.direction, caret, reads)) {
		return 'wide-keyless';
	}
	return null;
}

/** A soft keyboard's delete that names more than one character (an autocorrected word) is the
 *  keyboard's own edit, which the browser keeps. */
function widerThanCharacter(
	e: InputEvent,
	direction: DeleteDirection,
	caret: number,
	reads: CollapsedDeleteReads
): boolean {
	const target = reads.targetRange(e);
	if (!target) return false;
	const text = reads.text();
	const unit = characterExtent(text, caret, direction, { start: 0, end: text.length });
	return target.end - target.start > (unit ? unit.end - unit.start : 0);
}
