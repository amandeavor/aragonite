/**
 * Whether the cursor sits on the first or last visual line of a wrapping element, by comparing
 * the cursor's line box with the edge line's. A caret beside a non-text child measures to
 * nothing, so it borrows the box it sits against; that box and the line tolerance live here.
 */

import { domDescendants } from './dom-walk';
import { FALLBACK_LINE_HEIGHT } from '../windowing/typography-estimates';
import { caretAnchorAfter, isBlockLineText, rawRangeToDomRange } from './widget-offset';
import { offsetFromViewportPoint } from './point-offset';

// Fraction of a line height within which the cursor Y counts as the boundary line; under one
// line, so sub/superscript or inline-image jitter doesn't read as a different line.
const SAME_LINE_TOLERANCE = 0.8;

/** The box a collapsed caret at `(node, offset)` in `root` sits in. Right after a `\n` that is the
 *  next line's start, where WebKit and Firefox measure the line the `\n` ends instead. */
export function caretRectAt(root: ParentNode, node: Node, offset: number): DOMRect | null {
	if (node instanceof Text && offset > 0 && node.data[offset - 1] === '\n') {
		const below = offset < node.length ? charRect(node, offset) : nextLineStartAfter(node, root);
		if (below) return new DOMRect(below.left, below.top, 0, below.height);
	}
	const range = document.createRange();
	try {
		range.setStart(node, offset);
	} catch {
		return null;
	}
	range.collapse(true);
	// A collapsed range has no width, so a box with width and no height is not a caret's.
	return firstUsefulRect(range, false);
}

/** The box a collapsed caret at raw offset `raw` in the block element `el` sits in. */
export function caretRectAtRaw(el: HTMLElement, raw: number): DOMRect | null {
	const at = rawRangeToDomRange(el, raw, raw);
	return at && caretRectAt(el, at.startContainer, at.startOffset);
}

/** The box of the one character at `at` in `text`, null past its end or where it paints nothing. */
export function charRect(text: Text, at: number): DOMRect | null {
	if (at < 0 || at >= text.length) return null;
	const range = document.createRange();
	range.setStart(text, at);
	range.setEnd(text, at + 1);
	return firstUsefulRect(range);
}

/** Where the caret is for a vertical move: the caret itself, or a selection's focus, the end a
 *  Shift+Arrow moves and a plain arrow moves from. Collapsed. */
export function movingEnd(sel: Selection): Range {
	if (sel.isCollapsed || !sel.focusNode) return sel.getRangeAt(0);
	const range = document.createRange();
	range.setStart(sel.focusNode, sel.focusOffset);
	return range;
}

/** The box a caret sits in: what the line comparisons and the sticky column both read of it. */
export interface CaretRect {
	/** The caret's x. For a caret borrowing a widget's box, the edge it sits on. */
	left: number;
	top: number;
	bottom: number;
}

/** The box a caret with no rect of its own borrows: the widget it precedes, else the one it follows.
 *  Null off an element-level position, or when the neighbour measures to nothing. */
export function neighbourCaretRect(
	range: Pick<Range, 'startContainer' | 'startOffset'>
): CaretRect | null {
	const container = range.startContainer;
	if (container.nodeType !== Node.ELEMENT_NODE) return null;
	const children = container.childNodes;
	return (
		nodeCaretRect(children[range.startOffset], false) ??
		nodeCaretRect(children[range.startOffset - 1], true)
	);
}

/** How far apart two carets' boxes may sit and still read as one visual line: under one line of
 *  the element's own leading, so sub/superscript or inline-image jitter is not a new line. */
export function sameLineTolerance(el: HTMLElement): number {
	return lineHeightOf(el) * SAME_LINE_TOLERANCE;
}

/** `el`'s computed line height in pixels, with a generic line where it computes to `normal`. */
export function lineHeightOf(el: HTMLElement): number {
	return parseFloat(getComputedStyle(el).lineHeight) || FALLBACK_LINE_HEIGHT;
}

/** The right edge of what `el` draws on the visual line nearest `y`, or null where it draws
 *  nothing: a point in a line's leading, or below the last line, reads that line. */
export function lineEndNearest(el: HTMLElement, y: number): number | null {
	return lineBoxNearest(el, y)?.right ?? null;
}

/** The raw offset at the `side` edge of the visual line raw `raw` sits on in `el`, measured the way
 *  a click resolves its point; null where nothing is laid out. */
export function lineEdgeOffset(el: HTMLElement, raw: number, side: 'start' | 'end'): number | null {
	const caret = caretRectAtRaw(el, raw);
	if (!caret) return null;
	const y = caret.top + caret.height / 2;
	const line = lineBoxNearest(el, y);
	if (!line) return null;
	// Half a pixel inside the line's box, so the point resolves to its first or last offset.
	return offsetFromViewportPoint(el, side === 'start' ? line.left + 0.5 : line.right - 0.5, y);
}

/** The box of what `el` draws on the visual line nearest `y`, read as `lineEndNearest` reads it. */
export function lineBoxNearest(el: HTMLElement, y: number): LineBox | null {
	const range = document.createRange();
	range.selectNodeContents(el);
	const lines: LineBox[] = [];
	for (const rect of range.getClientRects()) {
		if (rect.width === 0 || rect.height === 0) continue;
		const line = lines.find((each) => rect.top < each.bottom && rect.bottom > each.top);
		if (!line) {
			lines.push({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
		} else {
			line.top = Math.min(line.top, rect.top);
			line.bottom = Math.max(line.bottom, rect.bottom);
			line.left = Math.min(line.left, rect.left);
			line.right = Math.max(line.right, rect.right);
		}
	}
	const distance = (line: LineBox) =>
		y < line.top ? line.top - y : y > line.bottom ? y - line.bottom : 0;
	return lines.reduce<LineBox | null>(
		(best, line) => (best === null || distance(line) < distance(best) ? line : best),
		null
	);
}

export interface LineBox {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

/** Non-collapsed ranges reliably return rects where collapsed ones don't. */
export function getCharRangeTop(container: Node, offset: number, atEnd: boolean): number | null {
	try {
		const range = document.createRange();
		if (atEnd) {
			range.setStart(container, Math.max(0, offset - 1));
			range.setEnd(container, offset);
		} else {
			range.setStart(container, offset);
			range.setEnd(container, offset + 1);
		}
		return firstUsefulRect(range)?.top ?? null;
	} catch {
		// offset out of bounds
	}
	return null;
}

/** Skips non-text children (dimmed marker spans) that would otherwise leave the block's
 *  first line unmeasurable, and hidden marker text, which measures to no rect at all. */
export function findFirstTextNode(root: Node): Text | null {
	return measurableText(root, containerOf(root), false);
}

export function findLastTextNode(root: Node): Text | null {
	return measurableText(root, containerOf(root), true);
}

/** The first and last offsets a caret can sit at in a block, which a hidden run moves inward. */
export interface CaretBounds {
	start: number;
	end: number;
}

/** True if the caret, or a selection's moving end, sits on `el`'s first visual line. The fallback
 *  offset answers with no live range, which Chromium drops beside a widget. */
export function isAtFirstVisualLine(
	el: HTMLElement,
	fallbackOffset: number,
	bounds: CaretBounds
): boolean {
	return isAtEdgeVisualLine(el, () => fallbackOffset <= bounds.start, {
		isEmpty: bounds.start === bounds.end,
		toStart: true,
		boundaryTop: () => {
			const firstText = findFirstTextNode(el);
			const top = firstText ? getCharRangeTop(firstText, 0, false) : null;
			return top ?? collapsedContentsTop(el, true);
		}
	});
}

export function isAtLastVisualLine(
	el: HTMLElement,
	fallbackOffset: number,
	bounds: CaretBounds
): boolean {
	return isAtEdgeVisualLine(el, () => fallbackOffset >= bounds.end, {
		isEmpty: bounds.start === bounds.end,
		toStart: false,
		boundaryTop: () => {
			const lastText = findLastTextNode(el);
			if (!lastText) return collapsedContentsTop(el, false);
			const below = lastText.data.endsWith('\n') ? nextLineStartAfter(lastText, el) : null;
			const top = below?.top ?? getCharRangeTop(lastText, lastText.length, true);
			return top ?? collapsedContentsTop(el, false);
		}
	});
}

// ── Internal ────────────────────────────────────────────────────────────────

/** The first rect that can position a caret: the leading client rect when it has real
 *  height, else the bounding rect. `widthTolerant` also accepts a zero-height rect with width. */
function firstUsefulRect(range: Range, widthTolerant = true): DOMRect | null {
	const rects = range.getClientRects();
	if (rects.length > 0 && rects[0].height > 0) return rects[0] as DOMRect;
	const br = range.getBoundingClientRect();
	if (br.height > 0 || (widthTolerant && br.width > 0)) return br;
	return null;
}

/** The start of the line after `text`'s final `\n`: the caret anchor that opens an empty line
 *  there, else the first character of the next text `root` lays out as a line. */
function nextLineStartAfter(text: Text, root: ParentNode): DOMRect | null {
	const anchor = caretAnchorAfter(text, root);
	if (anchor) {
		const range = document.createRange();
		range.selectNode(anchor);
		return firstUsefulRect(range);
	}
	const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
	walker.currentNode = text;
	const container = containerOf(root as Node);
	for (let next = walker.nextNode(); next; next = walker.nextNode()) {
		if (isMeasurableText(next as Text, container)) return charRect(next as Text, 0);
	}
	return null;
}

/** The shared skeleton of the two edge predicates: `fallback` answers where geometry cannot, and
 *  `boundaryTop` measures the edge line each side's own way. */
function isAtEdgeVisualLine(
	el: HTMLElement,
	fallback: () => boolean,
	edge: { isEmpty: boolean; toStart: boolean; boundaryTop: () => number | null }
): boolean {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return fallback();
	if (edge.isEmpty) return true;

	const cursorRange = movingEnd(sel);
	const tolerance = sameLineTolerance(el);
	const cursorTop =
		caretRectAt(el, cursorRange.startContainer, cursorRange.startOffset)?.top ?? null;

	if (cursorTop === null) {
		// A caret beside an atomic widget sits at an element-level position and measures to no rect
		// of its own: it borrows the widget's box, and is at the edge line when nothing reaches past.
		const band = neighbourCaretRect(cursorRange);
		const contents = contentsRect(el);
		if (!band || !contents) return fallback();
		return edge.toStart
			? band.top < contents.top + tolerance
			: band.bottom > contents.bottom - tolerance;
	}

	const edgeTop = edge.boundaryTop();
	if (edgeTop === null) return fallback();
	return Math.abs(cursorTop - edgeTop) < tolerance;
}

function nodeCaretRect(node: Node | undefined, fromEnd: boolean): CaretRect | null {
	if (!node) return null;
	const range = document.createRange();
	range.selectNode(node);
	// A node that wraps has one rect per line, and the caret touches the line on its own side.
	const rects = range.getClientRects();
	const rect =
		rects.length === 0 ? range.getBoundingClientRect() : rects[fromEnd ? rects.length - 1 : 0];
	return caretRectOf(rect, fromEnd);
}

function contentsRange(el: HTMLElement): Range {
	const range = document.createRange();
	range.selectNodeContents(el);
	return range;
}

function contentsRect(el: HTMLElement): CaretRect | null {
	return caretRectOf(contentsRange(el).getBoundingClientRect(), false);
}

function caretRectOf(rect: DOMRect, fromEnd: boolean): CaretRect | null {
	if (rect.height <= 0) return null;
	return { left: fromEnd ? rect.right : rect.left, top: rect.top, bottom: rect.bottom };
}

/** The boundary line's collapsed-contents fallback measurement. */
function collapsedContentsTop(el: HTMLElement, toStart: boolean): number | null {
	const range = contentsRange(el);
	range.collapse(toStart);
	return firstUsefulRect(range, false)?.top ?? null;
}

/** Deciding whether text is a hidden marker needs the walk container; a bare text-node root has none. */
function containerOf(root: Node): HTMLElement | null {
	return root instanceof HTMLElement ? root : null;
}

function measurableText(node: Node, container: HTMLElement | null, fromEnd: boolean): Text | null {
	for (const current of domDescendants(node, undefined, { fromEnd })) {
		if (current.nodeType !== Node.TEXT_NODE) continue;
		if (isMeasurableText(current as Text, container)) return current as Text;
	}
	return null;
}

function isMeasurableText(text: Text, container: HTMLElement | null): boolean {
	if ((text.textContent?.length ?? 0) === 0) return false;
	return container === null || isBlockLineText(text, container);
}
