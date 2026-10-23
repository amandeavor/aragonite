/**
 * G1.141: asking the browser which line the caret shows on, at a soft wrap, leaves the selection's
 * focus where it was. A focus put back by hand loses the side of the wrap the browser showed it on.
 */

import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';

export function checkLineReadRestored(
	before: { node: Node; offset: number },
	after: { node: Node | null; offset: number }
): InvariantViolation | null {
	if (after.node === before.node && after.offset === before.offset) return null;
	return {
		code: 'line-read-restores-focus',
		message: `asking where the caret's line ends left its focus at ${after.node?.nodeName} @ ${after.offset}, not ${before.node.nodeName} @ ${before.offset}: the line edge and back did not return the focus, so it was put back without its side of the wrap`
	};
}
