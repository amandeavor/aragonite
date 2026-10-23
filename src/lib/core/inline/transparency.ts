/**
 * The single implementation of the vertical-skip decision: does a block carry no column meaning,
 * so cross-block vertical traversal should pass over it? Reads the inline tree on demand, so it
 * answers for an off-window leaf with no component. An empty result reads as not-transparent, so
 * an unparsed block degrades to "land on it".
 */

import type { NodeView } from '../node-views';
import { isBlankText } from '../lines';
import { getInlineContent } from './inline-cache';
import { drawnInlines, isInlineWidget, isCharacterLikeWidget } from './inline-widgets';
import type { Reading } from '../../schema/reading';
import { hidesMarkersOnArrival } from '../../presentation-mode';
import { isGridKind, tryGetBlockKindDescriptor } from '../../schema/block-kind-descriptor';

/** What the check reads a block by: the grammar, and the mode, which decides what a link draws. */
export type ArrivalReading = Pick<Reading, 'grammar' | 'mode'>;

export function isVerticallyTransparentNode(
	node: NodeView | null | undefined,
	reading: ArrivalReading
): boolean {
	if (!node) return false;
	// An explicit stack: container depth is input-controlled, so recursion could overflow.
	const pending: NodeView[] = [node];
	while (pending.length > 0) {
		const current = pending.pop()!;
		// Every grid cell is a caret stop and draws its images as alt text, so vertical caret
		// movement must stop in an image-only cell rather than pass over it.
		if (isGridKind(current.kind)) return false;
		if (tryGetBlockKindDescriptor(current.kind)?.renderImagesAsWidgets === false) return false;
		if (current.children) {
			// An empty container carries a caret position.
			if (current.children.length === 0) return false;
			for (const child of current.children) pending.push(child);
		} else if (!isTransparentLeaf(current, reading)) {
			return false;
		}
	}
	return true;
}

// The same walk the edge-widget readers take (`widget-adjacency.ts`), so a block passed over
// always has a widget at its edge for the arrival to enter.
function isTransparentLeaf(node: NodeView, reading: ArrivalReading): boolean {
	const { grammar } = reading;
	// No resolver, since the path-walking callers hold none: a paragraph of only reference-style
	// images reads as opaque, while a direct `![](url)` is unaffected.
	const inlines = getInlineContent(node, undefined, '', grammar);
	const drawn = drawnInlines(inlines, node.raw, grammar, hidesMarkersOnArrival(reading.mode()));
	let drawsWidget = false;
	for (const inline of drawn) {
		if (isInlineWidget(inline, node.raw, grammar)) {
			// A character-like widget carries a column, so it reads as text.
			if (isCharacterLikeWidget(inline.kind, grammar)) return false;
			drawsWidget = true;
			continue;
		}
		if (inline.kind === 'text' && isBlankText(inline.text ?? '')) continue;
		return false;
	}
	return drawsWidget;
}
