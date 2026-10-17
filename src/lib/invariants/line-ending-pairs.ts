/**
 * G1.117: a commit never turns a CRLF pair into a lone `\r` or a lone `\n`. It compares the
 * document's line-ending counts before and after, so it sees every route that writes bytes.
 */

import { lineEndingCounts } from '../core/line-ending-pairs';
import type { InvariantViolation } from '../assert';

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
