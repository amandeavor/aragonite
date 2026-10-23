/**
 * G1.132: a delete the editor decides never reaches `input` undecided. Its `beforeinput` was
 * decided and prevented, or declined with a named reason; anything else is a surface that let the
 * browser's own delete through.
 */

import { decidedDelete, type DeleteVerdict } from '../caret/delete-extent';
import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';

export function checkDeleteDecided(
	inputType: string,
	verdict: DeleteVerdict | null
): InvariantViolation | null {
	if (decidedDelete(inputType) === null) return null;
	if (verdict && !verdict.decided) return null;
	return {
		code: verdict ? 'delete-not-prevented' : 'delete-never-decided',
		message: verdict
			? `the editor wrote a ${inputType} and the browser's delete ran too`
			: `a ${inputType} reached input without the editor's delete step deciding it`,
		detail: { inputType }
	};
}
