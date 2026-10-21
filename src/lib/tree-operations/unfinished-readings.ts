/**
 * A construct that backed out (a `$$` or `:::note` with no closer reads as a paragraph) can be
 * finished by a line any number of blocks below it, so an edit that writes such a line, or leaves
 * a block waiting on one, re-reads the span between them. A cheap line test decides whether to
 * look at all, which keeps a plain keystroke from walking the body (`docs/design/editor.md` § 8).
 */

import type { NodeView } from '../core/node-views';
import { displayLines } from '../core/lines';
import { recordUnfinishedWalk } from '../perf/instruments';
import { lineMayFinishReading, readingNotFinalIn, type GrammarView } from '../schema/block-openers';
import type { SharingState } from './sharing';
import type { StructuralChange } from './structural-change';
import type { BodyParent } from './node-primitives';
import { bodyStartIndex } from './separator-writes';
import { absorbSpanReading, type SettledSplice, type TrackedPosition } from './neighbour-merge';

/** Which way an edit may have finished a construct backed out beside it. */
export interface UnfinishedAsks {
	/** A line the edit wrote could close a construct above. */
	above: boolean;
	/** A block the edit wrote may wait on a closer below. */
	below: boolean;
}

export const NO_UNFINISHED_ASKS: UnfinishedAsks = { above: false, below: false };

/** What a content write asks: a changed line that could close looks up; a changed line that starts
 *  a block (the first, or any once the write was read as several) or a lost closer looks down. */
export function asksOfWrite(
	before: string,
	after: string,
	divided: boolean,
	grammar: GrammarView
): UnfinishedAsks {
	const changed = changedLines(before, after);
	const lost = changedLines(after, before);
	const above = changed.lines.some((line) => lineMayFinishReading(line, grammar));
	const startsBlock = changed.fromFirst || divided;
	const below = startsBlock || lost.lines.some((line) => lineMayFinishReading(line, grammar));
	return { above, below };
}

/** What blocks an edit placed ask: every one of their lines is new. */
export function asksOfPlaced(blocks: readonly NodeView[], grammar: GrammarView): UnfinishedAsks {
	const lines = blocks.flatMap((block) => textLines(block.raw));
	return { above: lines.some((line) => lineMayFinishReading(line, grammar)), below: true };
}

/** Re-read from the topmost unfinished block above `first` through `last` when the edit asks up,
 *  and down from an unfinished written block through the first candidate closer below it. */
export function finishUnfinishedReadings(
	body: BodyParent,
	first: number,
	last: number,
	asks: UnfinishedAsks,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition
): SettledSplice {
	const unchanged: SettledSplice = { change, landing: tracked?.index ?? first };
	if (asks.above) {
		const top = topmostUnfinished(body, bodyStartIndex(body), first - 1, grammar);
		recordUnfinishedWalk(first - bodyStartIndex(body));
		const settled =
			top >= 0 ? absorbSpanReading(body, top, last, change, grammar, sharing, tracked) : unchanged;
		// Once a construct above took the written lines in, they are its body, past any ask below.
		if (settled.change !== change) return settled;
	}
	if (!asks.below || last >= body.children.length - 1) return unchanged;
	const top = topmostUnfinished(body, first, last, grammar);
	const bottom = top >= 0 ? firstCandidateBelow(body, last + 1, grammar) : -1;
	if (bottom < 0) return unchanged;
	return absorbSpanReading(body, top, bottom, change, grammar, sharing, tracked);
}

/** The topmost block in `[from, to]` whose reading isn't final, or -1; one walk, one test each. */
function topmostUnfinished(
	body: BodyParent,
	from: number,
	to: number,
	grammar: GrammarView
): number {
	const notFinal = readingNotFinalIn(grammar);
	let top = -1;
	for (let i = to; i >= from; i--) if (notFinal(body.children[i].raw)) top = i;
	return top;
}

/** The first block from `from` down holding a line that could finish an unfinished reading. */
function firstCandidateBelow(body: BodyParent, from: number, grammar: GrammarView): number {
	const { children } = body;
	for (let i = from; i < children.length; i++) {
		if (textLines(children[i].raw).some((line) => lineMayFinishReading(line, grammar))) return i;
	}
	return -1;
}

/** The lines of `after` that differ from `before`, whole, and whether the first line is one. */
function changedLines(before: string, after: string): { lines: string[]; fromFirst: boolean } {
	const shorter = Math.min(before.length, after.length);
	let start = 0;
	while (start < shorter && before[start] === after[start]) start++;
	let end = 0;
	while (
		end < shorter - start &&
		before[before.length - 1 - end] === after[after.length - 1 - end]
	) {
		end++;
	}
	if (before === after) return { lines: [], fromFirst: false };
	const from = after.lastIndexOf('\n', start - 1) + 1;
	const stop = after.indexOf('\n', after.length - end);
	return {
		lines: textLines(after.slice(from, stop < 0 ? after.length : stop)),
		fromFirst: from === 0
	};
}

/** Each line's text, its ending dropped. */
const textLines = (text: string): string[] => displayLines(text).map((line) => line.text);
