/**
 * Where a caret position sits against what the user sees: in visible text, or somewhere a click
 * moves it away from (beside a widget, in hidden marker text, inside a container's marker prefix).
 */

import { isHiddenMarkerText, isInMarkerPrefix, isInsideAtomicWidget } from './widget-offset';

/** Caret in a text node the user can see: the browser draws a caret there, so the editor's own
 *  caret indicator is not needed. Hidden marker text renders nothing, so it does not count. */
export function caretIsInTextContent(el: HTMLElement, sel: Selection | null): boolean {
	if (!sel || sel.rangeCount === 0) return false;
	return seatIsInTextContent(el, sel.getRangeAt(0).startContainer);
}

/** The same read for a caret position given as a node: the one a press is about to make. A
 *  widget's own text paints, but takes no typing. */
export function seatIsInTextContent(el: HTMLElement, node: Node): boolean {
	if (node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return false;
	return !isHiddenMarkerText(node, el) && !isInsideAtomicWidget(el, node);
}

/** Whether the click ending a press that put the caret at `seat` moves it: off a widget's side to
 *  its edge, or out of the marker prefix to the text's start. */
export function clickMovesSeat(el: HTMLElement, seat: { node: Node; offset: number }): boolean {
	return !seatIsInTextContent(el, seat.node) || isInMarkerPrefix(el, seat.node, seat.offset);
}
