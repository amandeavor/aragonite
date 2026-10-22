/**
 * A construct that backed out (a `$$` or `:::note` with no closer reads as a paragraph) can be
 * finished by a line any number of blocks below it, so an edit that writes such a line, or leaves
 * a block waiting on one, re-reads the span between them. A cheap line test decides whether to
 * look at all, which keeps a plain keystroke from walking the body (`docs/design/structural-edits.md` § Structural operations).
 */

import type { NodeView } from '../core/node-views';
import { displayLines } from '../core/lines';
import { writtenSpan } from '../core/written-span';
import { recordUnfinishedWalk } from '../perf/instruments';
import {
	lineMayFinishReading,
	lineMayFinishReadingAbove,
	readingNotFinalIn,
	readsOnIn,
	type GrammarView
} from '../schema/block-openers';
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
	if (before === after) return { above: false, below: divided };
	const span = writtenSpan(before, after);
	const changed = linesAround(after, span.start, span.end);
	const lost = linesAround(before, span.start, span.removedEnd);
	const above = changed.lines.some((line) => lineMayFinishReadingAbove(line, grammar));
	const startsBlock = changed.fromFirst || divided;
	const below = startsBlock || lost.lines.some((line) => lineMayFinishReading(line, grammar));
	return { above, below };
}

/** What blocks an edit placed ask: every one of their lines is new. */
export function asksOfPlaced(blocks: readonly NodeView[], grammar: GrammarView): UnfinishedAsks {
	const lines = blocks.flatMap((block) => textLines(block.raw));
	return { above: lines.some((line) => lineMayFinishReadingAbove(line, grammar)), below: true };
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
	const start = bodyStartIndex(body);
	if (asks.above && first > start) {
		const top = topmostUnfinished(body, start, first - 1, grammar);
		recordUnfinishedWalk(first - start);
		const settled =
			top >= 0 ? absorbSpanReading(body, top, last, change, grammar, sharing, tracked) : unchanged;
		// Once a construct above took the written lines in, they are its body, past any ask below.
		if (settled.change !== change) return settled;
	}
	if (!asks.below || last >= body.children.length - 1) return unchanged;
	// Each re-read can leave a block waiting (the opener refused the closer, or a fence it took was
	// another's opener), so the walk goes on until none in the re-read span waits.
	let settled = unchanged;
	let top = topmostUnfinished(body, first, last, grammar);
	let from = last + 1;
	while (top >= 0 && from < body.children.length) {
		const candidate = firstCandidateBelow(body, from, grammar);
		recordUnfinishedWalk((candidate < 0 ? body.children.length : candidate + 1) - from);
		// With no closer below, a block that reads on takes the rest of the body as a reload does.
		if (candidate < 0) top = topmostReadingOn(body, top, from - 1, grammar);
		if (top < 0) break;
		const bottom = candidate < 0 ? body.children.length - 1 : candidate;
		const count = body.children.length;
		settled = absorbSpanReading(body, top, bottom, settled.change, grammar, sharing, tracked);
		const end = bottom - (count - body.children.length);
		top = topmostUnfinished(body, top, end, grammar);
		from = end + 1;
	}
	return settled;
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

/** The topmost block in `[from, to]` that waits on a closer and reads on until then, or -1. */
function topmostReadingOn(
	body: BodyParent,
	from: number,
	to: number,
	grammar: GrammarView
): number {
	const readsOn = readsOnIn(grammar);
	for (let i = from; i <= to; i++) if (readsOn(body.children[i].raw)) return i;
	return -1;
}

/** The first block from `from` down holding a line that could finish an unfinished reading. */
function firstCandidateBelow(body: BodyParent, from: number, grammar: GrammarView): number {
	const { children } = body;
	for (let i = from; i < children.length; i++) {
		if (textLines(children[i].raw).some((line) => lineMayFinishReading(line, grammar))) return i;
	}
	return -1;
}

/** The whole lines of `text` around `[start, end)`, and whether they begin at its first line. */
function linesAround(
	text: string,
	start: number,
	end: number
): { lines: string[]; fromFirst: boolean } {
	const from = text.lastIndexOf('\n', start - 1) + 1;
	const stop = text.indexOf('\n', end);
	return {
		lines: textLines(text.slice(from, stop < 0 ? text.length : stop)),
		fromFirst: from === 0
	};
}

/** Each line's text, its ending dropped. */
const textLines = (text: string): string[] => displayLines(text).map((line) => line.text);
