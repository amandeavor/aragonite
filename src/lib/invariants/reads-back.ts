/**
 * G1.55: a top-level block an edit wrote reads back, alone, as the tree the editor holds, empty
 * bytes included. The edit names the blocks it wrote, so the check costs what the edit touched,
 * never the document; one larger than {@link READ_BACK_LIMIT} is skipped, so a keystroke in a giant
 * one pays no parse.
 */

import type { NodeView } from '../core/node-views';
import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';
import type { GrammarView } from '../schema/block-openers';
import { describeShapeDivergence } from '../core/shape-divergence';
import { readAsOpened } from '../schema/opened-reading';

/** The largest block, in bytes, the check reads. */
export const READ_BACK_LIMIT = 16_384;

let bytesRead = 0;

/** The bytes the check has parsed since the last call, for the test that bounds its cost. */
export function takeReadBackBytes(): number {
	const read = bytesRead;
	bytesRead = 0;
	return read;
}

export function checkReadsBack(node: NodeView, grammar: GrammarView): InvariantViolation | null {
	if (node.raw.length > READ_BACK_LIMIT) return null;
	bytesRead += node.raw.length;
	const read = readAsOpened(node.raw, { grammar, scope: 'fragment' });
	const divergence = describeShapeDivergence({ children: [node] }, read);
	return divergence === null
		? null
		: { code: 'reads-back', message: `${node.kind}'s bytes read as another tree: ${divergence}` };
}
