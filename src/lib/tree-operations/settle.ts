/**
 * The fix-up after an edit: the separators the edit's kind asks for, then `blank-runs.ts` lays out
 * the blank lines around it and `neighbour-merge.ts` merges the neighbours that would re-read as
 * one block (`docs/design/syntax-tree.md` § Blank lines). An edit splices and writes; `settleEdit`
 * is the one place its body is fixed up, and the body's owner decides where a blank line may sit.
 */

import type { CstNode, Document } from '../core/nodes';
import type { NodeView } from '../core/node-views';
import { isBlankParagraph } from '../core/parser';
import type { LineEnding } from '../core/lines';
import type { GrammarView } from '../schema/block-openers';
import { tryGetBlockKindDescriptor } from '../schema/block-kind-descriptor';
import { recordSettlePass } from '../perf/instruments';
import { assertInvariant } from '../assert';
import { checkStructuralDescriptor } from '../invariants/structural-descriptor';
import { noteBodySettled } from '../invariants/settle-once';
import { checkBlankRunsLaidOut } from '../invariants/blank-runs';
import { endWindowLines } from './open-tail';
import type { SharingState } from './sharing';
import { lacksSublistSeparator } from './list/sublist-separator';
import { holdOrderedNumbering, itemsShareList } from './list/ordered-markers';
import { spliceChildren } from './children';
import { applyStructuralChangeToIdsRefs, type StructuralChange } from './structural-change';
import { asBody, bodyUnder, type BodyParent, type BodyParentArg } from './node-primitives';
import {
	bodyStartIndex,
	mintSeparator,
	retireChildSpans,
	writeSeparator,
	writeWrapSlot
} from './separator-writes';
import {
	absorbWindowSeams,
	separateJoin,
	type SettledSplice,
	type TrackedPosition
} from './neighbour-merge';
import { holdsTrailingBlankLine, normalizeBlankRuns } from './blank-runs';
import {
	asksOfPlaced,
	asksOfWrite,
	finishUnfinishedReadings,
	NO_UNFINISHED_ASKS as NO_ASKS,
	type UnfinishedAsks
} from './unfinished-readings';

// ── Separators ──

/**
 * The separator a block takes back when it stops being blank: its own blank line was what stood
 * between it and a non-blank predecessor. Call when the block is filled.
 */
export function restoreSeparatorOnFill(
	body: BodyParent,
	index: number,
	sharing: SharingState
): void {
	const node = body.children[index];
	if (!node || node.leadingTrivia !== '' || isBlankParagraph(node)) return;
	mintSeparator(body, index, sharing);
}

/**
 * The separator the block below a consumed blank line takes back, skipped for a blank block whose
 * follower already holds one, since the two share it (G2.13).
 */
function restoreSeparatorAfterBlank(body: BodyParent, index: number, sharing: SharingState): void {
	const { children } = body;
	const node = children[index];
	if (!node || node.leadingTrivia !== '') return;
	if (isBlankParagraph(node) && (children[index + 1]?.leadingTrivia ?? '') !== '') return;
	mintSeparator(body, index, sharing);
}

/** A blank tail under a closing fence line borrows a line the fence takes on reload; a filled or
 *  removed tail gives it back, since an authored line there reads the same and stays. */
function returnBorrowedFenceLine(body: BodyParent, index: number): void {
	const { children, owner } = body;
	if (!owner?.innerSuffix || index < children.length - 1) return;
	if (!tryGetBlockKindDescriptor(owner.kind)?.bodyWrap?.beforeCloserLine) return;
	if (children.length === 0 || isBlankParagraph(children[children.length - 1])) return;
	writeWrapSlot(body, 'innerSuffix', '');
}

/** Drops the blank line between a list an edit made from one block and a same-type list beside it,
 *  so the merge reads them as one; a side the replaced block already continued keeps its line. */
function joinListsMadeBeside(
	body: BodyParent,
	at: number,
	added: number,
	removed: readonly NodeView[],
	sharing: SharingState
): void {
	const [replaced] = removed;
	if (removed.length !== 1 || added < 1) return;
	// A fill may write several blocks; a text line rewritten into several keeps them apart, as a paste
	// after text does.
	if (added > 1 && !isBlankParagraph(replaced)) return;
	const { children } = body;
	const top = children[at];
	const above = at > bodyStartIndex(body) ? children[at - 1] : undefined;
	const joinsAbove = continuesList(above, top) && !continuesList(above, replaced);
	if (top.leadingTrivia !== '' && joinsAbove) writeSeparator(body, at, '', sharing);
	const last = at + added - 1;
	const below = children[last + 1];
	const joinsBelow = continuesList(children[last], below) && !continuesList(replaced, below);
	if (below && below.leadingTrivia !== '' && joinsBelow) {
		writeSeparator(body, last + 1, '', sharing);
	}
}

/** Whether two lists read as one once nothing parts them, by their facing items. */
const continuesList = (upper: NodeView | undefined, lower: NodeView | undefined): boolean =>
	upper?.kind === 'list' &&
	lower?.kind === 'list' &&
	itemsShareList(upper.children?.at(-1), lower.children?.[0]);

// ── The one fix-up ──

/** A content write at `index`: the block as it stood before, and the bytes written into it. */
export interface WrittenSlot {
	index: number;
	previous: NodeView;
	text: string;
}

/** What an edit did to one body, which is everything {@link settleEdit} reads. */
export interface BodyEdit {
	/** The positions the edit spliced. */
	change: StructuralChange;
	/** The body's children before the edit: which removed blocks were blank, and what each left. */
	before: readonly CstNode[];
	/** A content write. */
	written?: WrittenSlot;
	/** A move, which carries each separator with its position rather than its node; `to` is where
	 *  the moved block stands before the fix-up merges anything, `uncovered` the join it left. */
	moved?: { to: number; uncovered: number | null };
	/** A block removed by `deleteNode`, on its own or after a join wrote it into the block above. */
	removed?: true;
}

/** What an edit did beyond its splice, which a mutation reports to the commit that settles it. */
export type EditKind = Pick<BodyEdit, 'written' | 'moved' | 'removed'>;

/** A content write once its neighbours were fixed up: its change widened by every merge, and where
 *  the written text starts inside that change's window (nonzero once a merge above absorbed it). */
export interface SettledContent {
	change: StructuralChange;
	textStart: number;
}

/** {@link settleEdit}'s result: the edit's change widened by the fix-up, the write's own result,
 *  and where a moved block stands once the move's merges ran. */
export interface SettledEdit {
	change: StructuralChange;
	written: SettledContent | null;
	moved: number | null;
}

/** The one fix-up a commit runs over each body it wrote: what the edit's kind asks first, then
 *  every block it placed ends its line, then the separators around its window are recomputed. */
export function settleEdit(
	body: BodyParent,
	edit: BodyEdit,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition
): SettledEdit {
	recordSettlePass();
	const head = settleEditHead(body, edit, grammar, sharing, tracked);
	endWindowLines(body, head.change, sharing, grammar);
	const change = settleSplice(body, edit.before, head.change, grammar, sharing, tracked);
	checkRunsLaidOut(body, change, edit.written?.index, grammar);
	return { ...head, change };
}

/** A content write's fix-up, for a write no commit settles: the keystroke written in place, the
 *  trial before it, and a write into a body below the commit's scope. */
export function settleContentWrite(
	body: BodyParent,
	slot: WrittenSlot,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState
): SettledContent {
	recordSettlePass();
	noteBodySettled(body.children);
	const settled = settleWrittenSlot(body, slot, change, grammar, sharing);
	checkRunsLaidOut(body, settled.change, slot.index, grammar);
	return settled;
}

/** G1.139 over the window a fix-up reports, or the written block when it reports none. */
function checkRunsLaidOut(
	body: BodyParent,
	change: StructuralChange,
	written: number | undefined,
	grammar: GrammarView
): void {
	const window = splicedWindow(change);
	if (!window && written === undefined) return;
	const lo = window?.at ?? written!;
	const hi = window ? window.at + window.added - 1 : written!;
	assertInvariant('blank-runs-laid-out', () => checkBlankRunsLaidOut(body, lo, hi, grammar));
}

function settleEditHead(
	body: BodyParent,
	edit: BodyEdit,
	grammar: GrammarView,
	sharing: SharingState,
	tracked: TrackedPosition | undefined
): SettledEdit {
	const { change, written, moved } = edit;
	const none: SettledEdit = { change, written: null, moved: null };
	if (edit.removed && change.op === 'delete') {
		return { ...none, change: settleRemoval(body, edit.before, change, grammar, sharing, tracked) };
	}
	if (written) {
		const settled = settleWrittenSlot(body, written, change, grammar, sharing);
		return { ...none, change: settled.change, written: settled };
	}
	if (moved) return { ...none, ...settleMove(body, change, moved, grammar, sharing) };
	return none;
}

/** The block before the removed one sits beside a new follower, and a join that rewrote its bytes
 *  can equally have stopped it interrupting the block above, so both its edges are asked. */
function settleRemoval(
	body: BodyParent,
	before: readonly CstNode[],
	change: StructuralChange & { op: 'delete' },
	grammar: GrammarView,
	sharing: SharingState,
	tracked: TrackedPosition | undefined
): StructuralChange {
	const { at } = change;
	handDownVacatedSeparator(body, at, before[at]?.leadingTrivia ?? '', sharing);
	separateJoin(body, at, 'uncovered', grammar, sharing);
	const laidOut = normalizeBlankRuns(body, at - 1, at, change, grammar, sharing);
	const survivor = Math.max(at - 1, 0);
	const span = at - survivor;
	return absorbAndLayOut(body, survivor, span, at, laidOut, grammar, sharing, tracked).change;
}

/** A move's joins, the moved block's placed and the pair it left uncovered, then the runs of the
 *  rotated window laid out again, since each separator stayed with its position. */
function settleMove(
	body: BodyParent,
	change: StructuralChange,
	{ to, uncovered }: { to: number; uncovered: number | null },
	grammar: GrammarView,
	sharing: SharingState
): { change: StructuralChange; moved: number } {
	const window = splicedWindow(change);
	if (!window) return { change, moved: to };
	const lo = window.at;
	const hi = window.at + window.added - 1;
	// The joins read the moved blocks side by side, so a moved open last line ends first.
	endWindowLines(body, change, sharing, grammar);
	for (let at = lo; at <= hi + 1; at++) {
		separateJoin(body, at, at === uncovered ? 'uncovered' : 'placed', grammar, sharing);
	}
	const laidOut = normalizeBlankRuns(body, lo, hi, change, grammar, sharing);
	const settled = absorbAndLayOut(body, lo, hi - lo + 1, to, laidOut, grammar, sharing);
	return { change: settled.change, moved: settled.landing };
}

// ── A content write's joins ──

/** The write's blank transitions, then its joins, reporting where the written text ended up. */
function settleWrittenSlot(
	body: BodyParent,
	slot: WrittenSlot,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState
): SettledContent {
	const { index, previous } = slot;
	const { children } = body;
	const wasBlank = isBlankParagraph(previous);
	const indentMoved = leadingIndent(previous.raw) !== leadingIndent(slot.text);
	const lastWritten = lastMintedIndex(change, index);
	const written = lastWritten - index + 1;
	const asks = asksOfWrite(previous.raw, slot.text, grammar);
	// One blank line served both sides: it separated this block from the one above and stood in
	// as the separator of the block beneath it. Filling it gives each side its own.
	if (wasBlank && !isBlankParagraph(children[index])) {
		restoreSeparatorOnFill(body, index, sharing);
		restoreSeparatorAfterBlank(body, followerIndexAfter(change, index), sharing);
		returnBorrowedFenceLine(body, lastWritten);
		const laidOut = normalizeBlankRuns(body, index, lastWritten, change, grammar, sharing);
		joinListsMadeBeside(body, index, written, [previous], sharing);
		return settleWriteSeams(body, index, index, lastWritten, laidOut, asks, sharing, grammar);
	}
	// The reverse transition: the block is a line of its run now, and the last block created is
	// the one that meets the follower.
	if (!wasBlank && isBlankParagraph(children[lastWritten])) {
		const laidOut = normalizeBlankRuns(body, index, lastWritten, change, grammar, sharing);
		return settleWriteSeams(body, index, index, lastWritten, laidOut, asks, sharing, grammar);
	}
	// The block's own trailing blank line was the separator of the run below it, so a write that
	// gives the line up hands the run its separator back.
	const heldLine = holdsTrailingBlankLine(previous, body.owner, index, grammar);
	const holdsLine = holdsTrailingBlankLine(children[lastWritten], body.owner, lastWritten, grammar);
	const lineMoved = heldLine !== holdsLine;
	if (lineMoved && heldLine) {
		restoreSeparatorAfterBlank(body, lastWritten + 1, sharing);
	}
	if (lineMoved || change.op !== 'noop') {
		change = normalizeBlankRuns(body, index, lastWritten, change, grammar, sharing);
	}
	// Same-kind typing asks the join above only when it's flush, the indent moved, or a blank line
	// stays blank (editor.md § 8); a construct a written line finishes above is asked apart.
	if (change.op === 'noop' && !wasBlank && !indentMoved && !flushAbove(children, index)) {
		// The join below is asked whatever parts it: an HTML block left open reads on past blank lines.
		if (index + 1 >= children.length && !asks.above) return { change, textStart: 0 };
		return settleWriteSeams(body, index, index + 1, lastWritten, change, asks, sharing, grammar);
	}
	joinListsMadeBeside(body, index, written, [previous], sharing);
	return settleWriteSeams(body, index, index, lastWritten, change, asks, sharing, grammar);
}

const leadingIndent = (text: string): string => /^[ \t]*/.exec(text)![0];

/** Whether no blank line parts the block from the one above it; a first child has none above. */
const flushAbove = (children: readonly CstNode[], index: number): boolean =>
	index > 0 && children[index].leadingTrivia === '';

/**
 * Merge across the joins from the one above `firstJoin` to the one below the last written block,
 * and report where the written text ended up once a merge above put bytes in front of it.
 */
function settleWriteSeams(
	body: BodyParent,
	index: number,
	firstJoin: number,
	lastWritten: number,
	change: StructuralChange,
	asks: UnfinishedAsks,
	sharing: SharingState,
	grammar: GrammarView
): SettledContent {
	const tracked: TrackedPosition = { index, offset: 0 };
	let settled = absorbAndLayOut(
		body,
		firstJoin,
		lastWritten - firstJoin + 1,
		index,
		change,
		grammar,
		sharing,
		tracked,
		// One written block lets a join beside it be refused on a single line of the neighbour.
		lastWritten === index ? index : undefined
	);
	const last = tracked.index + lastWritten - index;
	settled = finishAndLayOut(
		body,
		tracked.index,
		last,
		asks,
		settled.change,
		grammar,
		sharing,
		tracked
	);
	return {
		change: settled.change,
		textStart: textOffsetInWindow(body.children, settled.change, tracked)
	};
}

/**
 * The tracked position as an offset in the window's committed text, the space every caret
 * placement measures in, where the head block's own leading blank lines are outside the window.
 */
function textOffsetInWindow(
	children: readonly CstNode[],
	change: StructuralChange,
	tracked: TrackedPosition
): number {
	const at = change.op === 'noop' ? tracked.index : change.at;
	let pos = 0;
	for (let i = at; i < tracked.index; i++) {
		pos += (i === at ? 0 : children[i].leadingTrivia.length) + children[i].raw.length;
	}
	const ownTrivia = tracked.index > at ? children[tracked.index].leadingTrivia.length : 0;
	return pos + ownTrivia + tracked.offset;
}

/** Where the filled block's follower ended up: a multi-block reparse pushes it down. */
function followerIndexAfter(change: StructuralChange, index: number): number {
	return change.op === 'replace' ? change.at + change.newCount : index + 1;
}

/** The last block the write left in the position: a multi-block reparse creates blocks past
 *  the first. */
function lastMintedIndex(change: StructuralChange, index: number): number {
	return change.op === 'replace' ? change.at + change.newCount - 1 : index;
}

// ── Settling a spliced window ──

/** Recompute the separators around a splice, then merge neighbours that now read as one block.
 *  `removed` is the only record of which blocks were blank; `tracked` follows the merges. */
function settleSplicedWindow(
	body: BodyParent,
	at: number,
	removed: readonly CstNode[],
	vacated: string,
	added: number,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition
): StructuralChange {
	handDownVacatedSeparator(body, at, vacated, sharing);
	// A removal alone uncovers the pair it leaves; a block put in its place is the edit's own.
	if (added === 0) separateJoin(body, at, 'uncovered', grammar, sharing);
	if (removed.some(isBlankParagraph)) {
		// Both ends: the removed blank line was this position's own separator and the one the
		// block below stood on.
		restoreSeparatorAfterBlank(body, at, sharing);
		if (added > 0) restoreSeparatorAfterBlank(body, at + added, sharing);
		returnBorrowedFenceLine(body, at + Math.max(added - 1, 0));
	}
	joinListsMadeBeside(body, at, added, removed, sharing);
	settleEmptyMarkerLists(body, at, added, sharing);
	const laidOut = normalizeBlankRuns(body, at, at + added - 1, change, grammar, sharing);
	const asks = added > 0 ? asksOfPlaced(body.children.slice(at, at + added), grammar) : NO_ASKS;
	// Merging neighbours is part of settling, not a rule each caller repeats, so a new caller
	// inherits it. A write that reports `noop` splices no window and is asked nothing.
	const absorbed = absorbAndLayOut(
		body,
		at,
		added,
		at,
		laidOut,
		grammar,
		sharing,
		tracked,
		// A one-block window names the block whose bytes changed, which lets the join above it be
		// refused on that block's first line alone; a wider window names no single block.
		added === 1 ? at : undefined
	).change;
	const window = splicedWindow(absorbed);
	if (!window || window.added === 0) return absorbed;
	const last = window.at + window.added - 1;
	return finishAndLayOut(body, window.at, last, asks, absorbed, grammar, sharing, tracked).change;
}

/** {@link finishUnfinishedReadings}, then the runs a re-read re-divided laid out again. */
function finishAndLayOut(
	body: BodyParent,
	first: number,
	last: number,
	asks: UnfinishedAsks,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition
): SettledSplice {
	const unchanged = { change, landing: tracked?.index ?? first };
	if (!asks.above && !asks.below) return unchanged;
	const bounded = Math.min(last, body.children.length - 1);
	const settled = finishUnfinishedReadings(
		body,
		first,
		bounded,
		asks,
		change,
		grammar,
		sharing,
		tracked
	);
	const window = settled.change === change ? null : splicedWindow(settled.change);
	if (!window) return settled;
	const hi = window.at + window.added - 1;
	return {
		...settled,
		change: normalizeBlankRuns(body, window.at, hi, settled.change, grammar, sharing)
	};
}

/** {@link absorbWindowSeams}, then the runs a merge re-divided laid out again, since a merge can
 *  leave a blank line at the edge of the bytes it re-read. */
function absorbAndLayOut(
	body: BodyParent,
	at: number,
	added: number,
	landing: number,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition,
	headProbe?: number
): SettledSplice {
	const settled = absorbWindowSeams(
		body,
		at,
		added,
		landing,
		change,
		grammar,
		sharing,
		tracked,
		headProbe
	);
	const window = settled.change === change ? null : splicedWindow(settled.change);
	if (!window) return settled;
	const hi = window.at + window.added - 1;
	return {
		...settled,
		change: normalizeBlankRuns(body, window.at, hi, settled.change, grammar, sharing)
	};
}

/**
 * A list landing under a paragraph with an empty first item, or left there by the splice, takes
 * the blank line that keeps it a list; typing writes the same line when it rebuilds the list.
 */
function settleEmptyMarkerLists(
	body: BodyParent,
	at: number,
	added: number,
	sharing: SharingState
): void {
	for (let i = at; i <= at + added && i < body.children.length; i++) {
		if (lacksSublistSeparator(body.children, i)) mintSeparator(body, i, sharing);
	}
}

/** The block that takes the vacated position inherits its separator when it has none of its own. */
function handDownVacatedSeparator(
	body: BodyParent,
	at: number,
	vacated: string,
	sharing: SharingState
): void {
	const heir = body.children[at];
	if (vacated === '' || !heir || heir.leadingTrivia !== '') return;
	writeSeparator(body, at, vacated, sharing);
}

/** The splice pass: recompute the separators around `change`'s window against `before`, the
 *  children before the edit. A node that survives inside the window counts as kept. */
function settleSplice(
	body: BodyParent,
	before: readonly CstNode[],
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition
): StructuralChange {
	const window = splicedWindow(change);
	const { children } = body;
	if (!window) return change;
	// Checked here, before any branch: a window the mutation mis-derived reads `before` out of
	// bounds and hands the branches a negative span, which each would silently clamp.
	assertInvariant('structural-descriptor', () => checkStructuralDescriptor(change, before.length));
	const survivors = new Set(children.slice(window.at, window.at + window.added));
	const removed = before
		.slice(window.at, window.at + window.removed)
		.filter((node) => !survivors.has(node));
	// Only a block removed from the window's first position leaves a separator behind there; one
	// absorbed below a surviving block (a forward join) takes its separator with it.
	const first = before[window.at];
	const vacated = first && !survivors.has(first) ? first.leadingTrivia : '';
	return settleSplicedWindow(
		body,
		window.at,
		removed,
		vacated,
		window.added,
		change,
		grammar,
		sharing,
		tracked
	);
}

function splicedWindow(
	change: StructuralChange
): { at: number; removed: number; added: number } | null {
	switch (change.op) {
		case 'noop':
			return null;
		case 'insert':
			return { at: change.at, removed: 0, added: change.count };
		case 'delete':
			return { at: change.at, removed: change.count, added: 0 };
		case 'replace':
			return { at: change.at, removed: change.count, added: change.newCount };
	}
}

/**
 * The splice pass for a splice outside a commit scope, into a container found by walking the live
 * tree; the owner's `childIds` stay in step.
 */
export function spliceChildrenSettled(
	parent: CstNode | Document,
	at: number,
	removeCount: number,
	replacement: CstNode[],
	grammar: GrammarView,
	sharing: SharingState,
	lineEnding: LineEnding
): void {
	const children = parent.children;
	if (!children || at < 0 || at > children.length) return;
	const removed = children.slice(at, at + removeCount);
	// The parent, not a body built over it: the document carries an id array only while a caller
	// borrows one to track this splice.
	spliceChildren(parent as CstNode, at, removeCount, replacement);
	// `noop` goes in so the result describes the fix-up alone: `spliceChildren` already applied
	// this function's own splice to `childIds`, and outside a commit scope nothing else writes them.
	const settled = settleSplicedWindow(
		bodyUnder(parent, lineEnding),
		at,
		removed,
		removed[0]?.leadingTrivia ?? '',
		replacement.length,
		{ op: 'noop' },
		grammar,
		sharing
	);
	recordSettlePass();
	const ids = (parent as CstNode).childIds;
	if (ids) applyStructuralChangeToIdsRefs(settled, ids, new Array(ids.length));
}

// ── Delete ──

/** Remove the node at `blockIndex`, an ordered list's numbers kept consecutive; the fix-up that
 *  leaves its successor separated once is the commit's. A whole document reads as its own body. */
export function deleteNode(
	parent: BodyParentArg,
	blockIndex: number,
	sharing: SharingState
): StructuralChange {
	const body = asBody(parent);
	if (blockIndex < 0 || blockIndex >= body.children.length) return { op: 'noop' };
	retireChildSpans(body);
	const renumber = body.owner ? holdOrderedNumbering(body.owner) : undefined;
	body.children.splice(blockIndex, 1);
	renumber?.(sharing);
	return { op: 'delete', at: blockIndex, count: 1 };
}
