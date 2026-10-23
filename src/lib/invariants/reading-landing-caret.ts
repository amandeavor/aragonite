/**
 * G1.131: a landing in reading mode leaves no browser selection in the block it landed in. Firefox
 * starts Tab from a selection and the other engines from focus, so a caret left behind splits where
 * Tab goes. Only the landed block counts, so a click elsewhere while the jump scrolls passes.
 */

import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';

export function checkReadingLandingLeavesNoCaret(
	landedEl: Node | null,
	selected: Node | null
): InvariantViolation | null {
	if (!landedEl || !selected || !landedEl.contains(selected)) return null;
	return {
		code: 'reading-landing-leaves-no-caret',
		message:
			'a reading-mode landing left a browser selection in the block it landed in: clear it, so Tab starts from the focused element'
	};
}
