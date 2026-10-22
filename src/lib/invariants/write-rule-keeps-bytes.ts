/**
 * G1.143: a kind's write rule never deletes bytes outside the written span. What the written text
 * shares with the block's bytes before and after the span stays, in order, in what the rule
 * stores; inserting (a closer put back, a fence run grown) is allowed.
 */

import type { NodeView } from '../core/node-views';
import type { InvariantViolation } from '../assert';
import { writtenSpan } from '../core/written-span';

export function checkWriteRuleKeepsBytes(
	node: NodeView,
	written: string,
	stored: string
): InvariantViolation | null {
	const span = writtenSpan(node.raw, written);
	const untouched = written.slice(0, span.start) + written.slice(span.end);
	if (keepsInOrder(untouched, stored)) return null;
	return {
		code: 'write-rule-keeps-bytes',
		message: `${node.kind}'s write rule deleted bytes the write left alone`,
		detail: { written, stored }
	};
}

/** Whether every character of `kept` appears in `stored`, in order. */
function keepsInOrder(kept: string, stored: string): boolean {
	let at = 0;
	for (let i = 0; i < stored.length && at < kept.length; i++) {
		if (stored[i] === kept[at]) at++;
	}
	return at === kept.length;
}
