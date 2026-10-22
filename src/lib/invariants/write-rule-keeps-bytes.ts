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
	const lost = lostUntouched(node, written, stored);
	if (lost === null) return null;
	const emptied = withoutEmptiedMarker(node, written);
	if (emptied !== null && lostUntouched(node, emptied, stored) === null) return null;
	return {
		code: 'write-rule-keeps-bytes',
		message: `${node.kind}'s write rule deleted bytes the write left alone, from ${JSON.stringify(lost)} on`,
		detail: { written, stored }
	};
}

/** The bytes outside the written span from the first one `stored` lacks, or null when it keeps
 *  them all, in order. */
function lostUntouched(node: NodeView, written: string, stored: string): string | null {
	const span = writtenSpan(node.raw, written);
	const kept = written.slice(0, span.start) + written.slice(span.end);
	let at = 0;
	for (let i = 0; i < stored.length && at < kept.length; i++) {
		if (stored[i] === kept[at]) at++;
	}
	return at === kept.length ? null : kept.slice(at);
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
