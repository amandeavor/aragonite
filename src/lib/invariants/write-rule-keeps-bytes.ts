/**
 * G1.143: a kind's write rule never deletes bytes outside the written span, except the marker of
 * the block the write emptied (a setext underline under a blank title, as an emptied ATX heading
 * gives up its `#`). What the written text shares with the block's bytes before and after the span
 * stays, in order, in what the rule stores; inserting is allowed.
 */

import type { NodeView } from '../core/node-views';
import type { InvariantViolation } from '../assert';
import { structuralSuffix } from '../core/inline';
import { isBlankLine, ownTrailingLineEnding, trimTrailingLineEnding } from '../core/lines';
import { writtenSpan } from '../core/written-span';

export function checkWriteRuleKeepsBytes(
	node: NodeView,
	written: string,
	stored: string
): InvariantViolation | null {
	if (keepsUntouched(node, written, stored)) return null;
	const emptied = withoutEmptiedMarker(node, written);
	if (emptied !== null && keepsUntouched(node, emptied, stored)) return null;
	return {
		code: 'write-rule-keeps-bytes',
		message: `${node.kind}'s write rule deleted bytes the write left alone`,
		detail: { written, stored }
	};
}

function keepsUntouched(node: NodeView, written: string, stored: string): boolean {
	const span = writtenSpan(node.raw, written);
	return keepsInOrder(written.slice(0, span.start) + written.slice(span.end), stored);
}

/** `written` less the block's own trailing marker when the line above it is left blank; null
 *  when the write left text there, or holds no such marker. */
function withoutEmptiedMarker(node: NodeView, written: string): string | null {
	const marker = structuralSuffix(node);
	const display = trimTrailingLineEnding(written);
	if (!marker || !display.endsWith(marker)) return null;
	const title = display.slice(0, display.length - marker.length);
	if (!isBlankLine(title.slice(title.lastIndexOf('\n') + 1))) return null;
	return title + ownTrailingLineEnding(written);
}

/** Whether every character of `kept` appears in `stored`, in order. */
function keepsInOrder(kept: string, stored: string): boolean {
	let at = 0;
	for (let i = 0; i < stored.length && at < kept.length; i++) {
		if (stored[i] === kept[at]) at++;
	}
	return at === kept.length;
}
