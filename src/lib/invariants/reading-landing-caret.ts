/**
 * G1.131: a landing in reading mode leaves no browser selection in the editor. Firefox starts Tab
 * from a selection and the other engines from focus, so a caret left behind splits where Tab goes.
 */

import type { InvariantViolation } from '../assert';

export function checkReadingLandingLeavesNoCaret(
	root: Node | null,
	selected: Node | null
): InvariantViolation | null {
	if (!root || !selected || !root.contains(selected)) return null;
	return {
		code: 'reading-landing-leaves-no-caret',
		message:
			'a reading-mode landing left a browser selection in the editor: clear it, so Tab starts from the focused element'
	};
}
