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

/** For the open find bar: checks corner controls as the bar opens or resizes, as the pointer or
 *  focus enters a block, and on a scroll; never on a keystroke, and not at all once closed. */
export function keepCornerControlsClear(
	editorRoot: () => HTMLElement | undefined
): Attachment<HTMLElement> {
	return (bar) => {
		const root = editorRoot();
		if (!root) return;
		const place = (control: HTMLElement) => placeCornerControl(control, bar);
		const placeIn = (scope: ParentNode | null) =>
			scope?.querySelectorAll<HTMLElement>(`[${CORNER_CONTROL_ATTR}]`).forEach(place);
		// The blocks whose controls may be showing, which a scroll can carry under the bar.
		let pointed: Element | null = null;
		let focused: Element | null = null;
		const blockOf = (e: Event) =>
			e.target instanceof Element ? e.target.closest('.block-host') : null;
		// Not only on entering a block: a control can mount after the pointer is already inside.
		const onPointerOver = (e: Event) => placeIn((pointed = blockOf(e)));
		const onFocusIn = (e: Event) => placeIn((focused = blockOf(e)));
		const onScroll = () => {
			placeIn(pointed);
			placeIn(focused);
			root.querySelectorAll<HTMLElement>(`[${UNDER_FIND_BAR_ATTR}]`).forEach(place);
		};

		placeIn(root);
		const stopResize = observeResize(bar, () => placeIn(root));
		root.addEventListener('pointerover', onPointerOver);
		root.addEventListener('focusin', onFocusIn);
		// Captured, since a scroll doesn't bubble and the scroller may be the editor or the page.
		window.addEventListener('scroll', onScroll, { capture: true, passive: true });
		return () => {
			stopResize();
			root.removeEventListener('pointerover', onPointerOver);
			root.removeEventListener('focusin', onFocusIn);
			window.removeEventListener('scroll', onScroll, { capture: true });
			root.querySelectorAll<HTMLElement>(`[${UNDER_FIND_BAR_ATTR}]`).forEach(unmark);
		};
	};
}
