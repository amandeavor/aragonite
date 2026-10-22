/**
 * G1.115: a caret restored inside an inline widget that can show its source opens that source at
 * the byte asked for. A restore that lands anywhere else must have met a widget with no source to
 * show (an emoji, an image), whose caret goes to the far edge.
 */

import type { InvariantViolation } from '../assert';

/** A widget in the block, with whether its kind can show its source. */
export interface LandingWidget {
	start: number;
	end: number;
	kind: string;
	showsSource: boolean;
}

export function checkWidgetCaretLanding(
	requested: number,
	landed: number | null,
	widgets: readonly LandingWidget[]
): InvariantViolation | null {
	if (landed === null || landed === requested) return null;
	const around = widgets.find((w) => w.start < requested && requested < w.end);
	if (!around?.showsSource) return null;
	return {
		code: 'widget-caret-landing',
		message: `a caret restored at ${requested}, inside the ${around.kind} widget at [${around.start}, ${around.end}), landed at ${landed}: a widget that can show its source opens it at the byte instead`,
		detail: { requested, landed, widget: around }
	};
}
