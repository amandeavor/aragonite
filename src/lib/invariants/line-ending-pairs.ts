/**
 * A CRLF pair stays whole. G1.117: a commit never turns one into a lone `\r` or a lone `\n`,
 * comparing the document's line-ending counts before and after, so it sees every route that writes
 * bytes. G1.119: no selection endpoint the editor writes sits inside one.
 */

import { lineEndingCounts, splitsLineEndingPair } from '../core/line-ending-pairs';
import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';

export type LineEndingCounts = ReturnType<typeof lineEndingCounts>;

export function checkLineEndingPairsKept(
	before: LineEndingCounts,
	after: LineEndingCounts
): InvariantViolation | null {
	const split =
		after.pairs < before.pairs && (after.loneCr > before.loneCr || after.loneLf > before.loneLf);
	if (!split) return null;
	return {
		code: 'line-ending-pairs',
		message: 'a commit split a CRLF pair, leaving a lone `\\r` or `\\n`',
		detail: { before, after }
	};
}

/** WebKit and Firefox edit inside a pair from a caret written there. */
export function checkCaretOutsideLineEndingPair(position: {
	node: Node;
	offset: number;
}): InvariantViolation | null {
	const { node, offset } = position;
	if (!(node instanceof Text) || !splitsLineEndingPair(node.data, offset)) return null;
	return {
		code: 'caret-in-line-ending-pair',
		message: `a selection endpoint was written at offset ${offset}, between a CRLF pair's \`\\r\` and \`\\n\`: write it before the pair or after it`
	};
}
