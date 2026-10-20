/** What a pointer press means for the inline widget the editor holds selected. */

import { widgetSourceRange } from '../core/inline/inline-widgets';
import { findSurfacePathForElement } from './path-lookup';
import type { SelectionState } from './selection-state.svelte';

/** A press that opens a context menu: the right button, or Control with the primary on a Mac. */
export function isSecondaryPress(press: Pick<MouseEvent, 'button' | 'ctrlKey'>): boolean {
	return press.button === 2 || (press.button === 0 && press.ctrlKey);
}

/** Whether a press lands on the widget the editor holds selected. */
export function pressesSelectedWidget(
	selection: Pick<SelectionState, 'widgetIn'>,
	target: EventTarget | null
): boolean {
	const el =
		target instanceof Element ? target.closest('[data-inline-widget][data-source-start]') : null;
	const source = el && widgetSourceRange(el);
	const path = el && findSurfacePathForElement(el);
	return source !== null && path != null && selection.widgetIn(path)?.sourceStart === source.start;
}
