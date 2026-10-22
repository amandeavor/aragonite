/**
 * G1.128: a key that moves or extends the caret, declined by a selected widget, leaves the widget
 * first. The move that runs next reads the native selection, which selecting the widget cleared.
 */

import type { InvariantViolation } from '../assert';

export function checkMotionLeftWidget(
	key: string,
	movesCaret: boolean,
	widgetStillSelected: boolean
): InvariantViolation | null {
	if (!movesCaret || !widgetStillSelected) return null;
	return {
		code: 'selected-widget-motion',
		message: `${key} on a selected widget was declined with the widget still selected: the move that runs next has no caret to move`,
		detail: { key }
	};
}
