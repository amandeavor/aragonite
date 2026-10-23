/**
 * G1.145: the blocks a fix-up re-divided, read again together with the block after them, come back
 * as the same blocks, so the live tree divides those bytes the way a reload does. Blank lines are
 * G1.139's, so blank blocks and trailing blank lines are left out of the comparison.
 */

import type { CstNode } from '../core/nodes';
import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';
import { isBlankParagraph, readBlocks } from '../core/parser';
import type { GrammarView } from '../schema/block-openers';
import type { BodyParent } from '../tree-operations/node-primitives';

export function checkSettledWindowReadsBack(
	body: BodyParent,
	lo: number,
	hi: number,
	grammar: GrammarView
): InvariantViolation | null {
	const window = body.children.slice(Math.max(lo, 0), hi + 2);
	if (window.length === 0) return null;
	const read = (bytes: string) => readBlocks(bytes, { grammar, scope: 'fragment' }).children;
	// A block that reads otherwise alone (a list item's bytes read as a list, a table cell's as a
	// paragraph) has no standalone reading to compare against.
	if (window.some((node) => read(node.raw)[0]?.kind !== node.kind)) return null;
	let bytes = window[0].raw;
	for (const node of window.slice(1)) bytes += node.leadingTrivia + node.raw;
	const live = shapeOf(window);
	const reread = shapeOf(read(bytes));
	if (live.join('\0') === reread.join('\0')) return null;
	return {
		code: 'settled-window-reads-back',
		message: `a fix-up left blocks ${lo}-${hi} divided otherwise than a reload reads them`,
		detail: { live, reread }
	};
}

/** Each content block as its kind and its bytes less trailing blank lines. */
const shapeOf = (blocks: readonly CstNode[]): string[] =>
	blocks
		.filter((block) => !isBlankParagraph(block))
		.map((block) => `${block.kind} ${block.raw.replace(/(?:\r?\n[ \t]*)+$/, '')}`);
