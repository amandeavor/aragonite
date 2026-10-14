/**
 * Moves a block's top-right hover control (a code block's language picker, a diagram's
 * toolbar) below the open find bar, but only the one the bar actually covers. A control opts in
 * with `data-corner-control`; editor.css shifts the ones marked `data-under-find-bar`.
 */

import type { Attachment } from 'svelte/attachments';
import { observeResize } from '../windowing/observe-resize';

export const CORNER_CONTROL_ATTR = 'data-corner-control';
export const UNDER_FIND_BAR_ATTR = 'data-under-find-bar';
/** How far a covered control moves down, which editor.css reads. */
export const CLEARANCE_VAR = '--md-find-bar-clearance';
/** Room between the bar's bottom edge and a control moved below it. */
const GAP = 4;

type Box = Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>;

/** Whether two boxes share any area; boxes that only touch at an edge don't. */
export function boxesOverlap(a: Box, b: Box): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Shifts `control` below `bar` when the bar covers the place it sits unmoved, and back when it
 *  doesn't. Reads layout only, and writes only when the shift changes. */
export function placeCornerControl(control: HTMLElement, bar: Element): void {
	const current = parseFloat(control.style.getPropertyValue(CLEARANCE_VAR)) || 0;
	const moved = control.getBoundingClientRect();
	const unmoved = {
		left: moved.left,
		right: moved.right,
		top: moved.top - current,
		bottom: moved.bottom - current
	};
	const barBox = bar.getBoundingClientRect();
	const next = boxesOverlap(unmoved, barBox) ? barBox.bottom + GAP - unmoved.top : 0;
	// Layout rounds positions to a fraction of a pixel, so a shift that close is the same shift.
	if (Math.abs(next - current) < 0.5) return;
	if (!next) return unmark(control);
	control.setAttribute(UNDER_FIND_BAR_ATTR, '');
	control.style.setProperty(CLEARANCE_VAR, `${next}px`);
}

function unmark(control: HTMLElement): void {
	control.removeAttribute(UNDER_FIND_BAR_ATTR);
	control.style.removeProperty(CLEARANCE_VAR);
}

/** For the open find bar: checks every corner control as the bar opens or resizes, and a block's
 *  own as the pointer moves onto it or focus enters it; never on a keystroke or a scroll. */
export function keepCornerControlsClear(
	editorRoot: () => HTMLElement | undefined
): Attachment<HTMLElement> {
	return (bar) => {
		const root = editorRoot();
		if (!root) return;
		const controlsIn = (scope: ParentNode) =>
			scope.querySelectorAll<HTMLElement>(`[${CORNER_CONTROL_ATTR}]`);
		const placeAll = () => controlsIn(root).forEach((control) => placeCornerControl(control, bar));
		// Not only on entering a block: a control can mount after the pointer is already inside.
		const placeInBlockOf = (e: Event) => {
			const host = e.target instanceof Element ? e.target.closest('.block-host') : null;
			if (host) controlsIn(host).forEach((control) => placeCornerControl(control, bar));
		};

		placeAll();
		const stopResize = observeResize(bar, placeAll);
		root.addEventListener('pointerover', placeInBlockOf);
		root.addEventListener('focusin', placeInBlockOf);
		return () => {
			stopResize();
			root.removeEventListener('pointerover', placeInBlockOf);
			root.removeEventListener('focusin', placeInBlockOf);
			root.querySelectorAll<HTMLElement>(`[${UNDER_FIND_BAR_ATTR}]`).forEach(unmark);
		};
	};
}
