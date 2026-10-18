/**
 * The fix-up after an edit: recomputes the blank-line separators it left stale and has
 * `neighbour-merge.ts` merge the neighbours that would re-read as one block
 * (`docs/design/syntax-tree.md` § Blank lines). An edit splices and writes; `settleEdit` is the
 * one place its body is fixed up, and the body's owner decides where a separator may sit.
 */

import type { CstNode, Document } from '../core/nodes';
import type { NodeView } from '../core/node-views';
import { isBlankParagraph, type ContainerBodyWrap } from '../core/parser';
import { ownTrailingLineEnding, type LineEnding } from '../core/lines';
import { devWarn } from '../dev-warn';
import { tryGetBlockKindDescriptor } from '../schema/block-kind-descriptor';
import { blockReadingNotFinal, type GrammarView } from '../schema/block-openers';
import { recordSettlePass } from '../perf/instruments';
import { assertInvariant } from '../assert';
import { checkStructuralDescriptor } from '../invariants/structural-descriptor';
import { noteBodySettled } from '../invariants/settle-once';
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
import { absorbWindowSeams, type TrackedPosition } from './neighbour-merge';

// ── Separators ──

/**
 * Drop the separator at `index` where nothing needs one: at the body head, or below a blank
 * block, where the parser would read the extra line as one more empty paragraph.
 */
export function clearRedundantSeparator(
	body: BodyParent,
	index: number,
	sharing: SharingState
): void {
	const node = body.children[index];
	if (!node || node.leadingTrivia === '') return;
	const bodyStart = bodyStartIndex(body);
	if (index < bodyStart) return;
	const predecessor = index > bodyStart ? body.children[index - 1] : undefined;
	if (predecessor !== undefined && !isBlankParagraph(predecessor)) return;
	const freed = node.leadingTrivia;
	writeSeparator(body, index, '', sharing);
	absorbWrapPrefix(body, bodyStart, index, freed);
}

/**
 * A blank block is itself a blank line, so it and its follower share one separator (G2.13): true
 * when both hold one. The follower's is the one kept, so filling the blank block still finds it.
 */
export function doublesSeparator(children: readonly NodeView[], index: number): boolean {
	const node = children[index];
	if (!node || node.leadingTrivia === '' || !isBlankParagraph(node)) return false;
	return (children[index + 1]?.leadingTrivia ?? '') !== '';
}

/** Drops the blank block's own separator where it doubles its follower's. */
export function dropDoubledSeparator(body: BodyParent, index: number, sharing: SharingState): void {
	if (doublesSeparator(body.children, index)) writeSeparator(body, index, '', sharing);
}

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

/**
 * A block turned blank joins a run that, with its follower, must carry exactly one separating line;
 * a standing line is kept, and a new one goes at the run's head, the only place one may sit.
 */
export function settleSeparatorOnBlank(
	body: BodyParent,
	index: number,
	sharing: SharingState
): void {
	const { children } = body;
	const node = children[index];
	if (!node || !isBlankParagraph(node)) return;
	const bodyStart = bodyStartIndex(body);
	let start = index;
	while (start > bodyStart && isBlankParagraph(children[start - 1])) start--;
	let end = index;
	while (end + 1 < children.length && isBlankParagraph(children[end + 1])) end++;
	const standing: number[] = [];
	for (let i = start; i <= Math.min(end + 1, children.length - 1); i++) {
		if (children[i].leadingTrivia !== '') standing.push(i);
	}
	// A fence line at either end of the run strips one blank line into `innerPrefix`/`innerSuffix`
	// on top of the run's own count when prose sits on the other side; an all-blank body needs none.
	const wrap = bodyWrapOf(body);
	const slots = body.owner;
	const bodyEnd = children.length - 1;
	// A run of two or more that is the whole body sits against both fence lines, and the reload
	// strips a line into each of `innerPrefix` and `innerSuffix`, so the run supplies both.
	const twoPeelBody =
		!!slots &&
		wrap?.afterOpenerLine === true &&
		wrap.beforeCloserLine === true &&
		start === bodyStart &&
		end === bodyEnd &&
		start < end;
	const tailBelowProse = start > bodyStart && end === bodyEnd;
	if (slots && wrap?.beforeCloserLine && (tailBelowProse || twoPeelBody) && !slots.innerSuffix) {
		// A blank block's bytes are its line ending.
		writeWrapSlot(body, 'innerSuffix', ownTrailingLineEnding(children[end].raw));
	}
	// The reverse: beside a lone blank block that is the whole body, the closer strips no line of
	// its own apart from the opener's, so the run gives the extra line back.
	const loneBlankBody = start === bodyStart && end === bodyEnd && start === end;
	if (slots && loneBlankBody && slots.innerSuffix && (slots.innerPrefix || standing.length > 0)) {
		writeWrapSlot(body, 'innerSuffix', '');
	}
	const headUnderWrap =
		!!slots && wrap?.afterOpenerLine === true && start === bodyStart && end < bodyEnd;
	// A line already standing is the one the reload strips against the opener, so taking another
	// into `innerPrefix` would add a line; a `twoPeelBody` keeps its lines in the wrap fields.
	const takesOpenerPeel = twoPeelBody || (headUnderWrap && standing.length === 0);
	if (slots && takesOpenerPeel && !slots.innerPrefix) {
		writeWrapSlot(body, 'innerPrefix', ownTrailingLineEnding(children[start].raw));
	}
	// Under the opener the run keeps exactly one stripped line, in `innerPrefix` or standing;
	// elsewhere a run with nothing above it separates nothing, so every line is a block.
	let wanted: number;
	if (twoPeelBody) wanted = 0;
	else if (headUnderWrap) wanted = slots?.innerPrefix ? 0 : 1;
	else wanted = start > 0 || wrap?.afterOpenerLine ? 1 : 0;
	if (standing.length < wanted) {
		mintSeparator(body, start, sharing);
	} else {
		for (const at of standing.slice(wanted)) writeSeparator(body, at, '', sharing);
	}
	materializeTailSuffix(body, sharing);
}

/**
 * The parser keeps a blank line beside a fence line in `innerPrefix`/`innerSuffix` only when body
 * content sits past it, so an emptied body keeps neither, or it reloads with an extra blank block.
 */
function dropWrapOfEmptiedBody(body: BodyParent): void {
	const slots = body.owner;
	if (!slots || !bodyWrapOf(body)) return;
	if (body.children.length > bodyStartIndex(body)) return;
	if (slots.innerPrefix) writeWrapSlot(body, 'innerPrefix', '');
	if (slots.innerSuffix) writeWrapSlot(body, 'innerSuffix', '');
}

/**
 * A tail block that stops being blank gives back the `innerSuffix` line {@link
 * settleSeparatorOnBlank} lent it, or the container emits a line nobody typed.
 */
function releaseWrapPeel(body: BodyParent, index: number): void {
	const { children } = body;
	if (children.length === 0 || !body.owner?.innerSuffix) return;
	if (!bodyWrapOf(body)?.beforeCloserLine) return;
	if (index < children.length - 1) return;
	if (isBlankParagraph(children[children.length - 1])) return;
	writeWrapSlot(body, 'innerSuffix', '');
}

/**
 * A body's trailing blank line stays in `suffix`/`innerSuffix` only while the tail block is
 * non-blank; under a blank tail the reload reads it as a paragraph, so it becomes a block here.
 */
function materializeTailSuffix(body: BodyParent, sharing: SharingState): number {
	const { children } = body;
	const slot = tailSuffixSlotOf(body);
	const suffix = slot?.read();
	if (!slot || !suffix) return 0;
	// An emptied body has no tail block for the line to attach to, so the line is the body's
	// whole content and the reload reads it as the one block there is.
	if (children.length > 0 && !isBlankParagraph(children[children.length - 1])) return 0;
	const minted: CstNode = { kind: 'paragraph', leadingTrivia: '', raw: suffix };
	sharing.stamp(minted);
	// A new child moves the count, which the owner's child spans are laid out against.
	retireChildSpans(body);
	children.push(minted);
	slot.clear();
	return 1;
}

/**
 * Where a body keeps its trailing blank line. A closer line strips a line of its own, which
 * {@link settleSeparatorOnBlank} reconciles, so a body under one has no such slot here.
 */
function tailSuffixSlotOf(body: BodyParent): { read: () => string; clear: () => void } | undefined {
	if (body.suffix !== undefined) {
		return { read: () => body.suffix ?? '', clear: () => (body.suffix = '') };
	}
	const { owner } = body;
	const wrap = bodyWrapOf(body);
	if (!owner || wrap?.beforeCloserLine) return undefined;
	// An all-blank body under an opener line gives its first line to the opener on reload, which
	// is the one the trailing line would have added.
	const { children } = body;
	const openerTakesLine =
		wrap?.afterOpenerLine === true &&
		!owner.innerPrefix &&
		children.length > 0 &&
		children.every(isBlankParagraph);
	if (openerTakesLine) return undefined;
	return {
		read: () => owner.innerSuffix ?? '',
		clear: () => writeWrapSlot(body, 'innerSuffix', '')
	};
}

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
	 *  the moved block stands before the fix-up merges anything. */
	moved?: { to: number };
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
	return settleWrittenSlot(body, slot, change, grammar, sharing);
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
	if (moved) return { ...none, ...settleMove(body, change, moved.to, grammar, sharing) };
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
	clearRedundantSeparator(body, at, sharing);
	const survivor = Math.max(at - 1, 0);
	const span = at - survivor;
	return absorbWindowSeams(body, survivor, span, at, change, grammar, sharing, tracked).change;
}

/** A blank block moved by position can hold a line its follower holds too, so each blank block in
 *  the rotated window gets its run recounted before the moved window's joins are asked. */
function settleMove(
	body: BodyParent,
	change: StructuralChange,
	to: number,
	grammar: GrammarView,
	sharing: SharingState
): { change: StructuralChange; moved: number } {
	const window = splicedWindow(change);
	if (!window) return { change, moved: to };
	const { children } = body;
	const lo = window.at;
	const hi = window.at + window.added - 1;
	const beforeMint = children.length;
	for (let at = lo; at <= hi; at++) {
		if (isBlankParagraph(children[at])) settleSeparatorOnBlank(body, at, sharing);
	}
	// A blank block moved to the tail can turn the body's trailing line into a block of its own.
	const widened = widenForTailMint(change, beforeMint, children.length);
	const settled = absorbWindowSeams(body, lo, hi - lo + 1, to, widened, grammar, sharing);
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
	// One blank line served both sides: it separated this block from the one above and stood in
	// as the separator of the block beneath it. Filling it gives each side its own.
	if (wasBlank && !isBlankParagraph(children[index])) {
		restoreSeparatorOnFill(body, index, sharing);
		restoreSeparatorAfterBlank(body, followerIndexAfter(change, index), sharing);
		releaseWrapPeel(body, lastWritten);
		joinListsMadeBeside(body, index, written, [previous], sharing);
		return settleWriteSeams(body, index, index, lastWritten, change, sharing, grammar);
	}
	// The reverse transition: the block is the separating line now, so the run it joins gives
	// back the second one. The last block created is the one that meets the follower.
	if (!wasBlank && isBlankParagraph(children[lastWritten])) {
		const settled = children.length;
		settleSeparatorOnBlank(body, lastWritten, sharing);
		const widened = widenForTailMint(change, settled, children.length);
		return settleWriteSeams(body, index, index, lastWritten, widened, sharing, grammar);
	}
	// Same-kind typing asks the join above only when it's flush, the block above's reading isn't
	// final, the indent moved, or a blank line stays blank (editor.md § 8).
	if (
		change.op === 'noop' &&
		!wasBlank &&
		!indentMoved &&
		!flushAbove(children, index) &&
		!unfinishedAbove(children, index, grammar)
	) {
		// The join below is asked whatever parts it: an HTML block left open reads on past blank lines.
		if (index + 1 >= children.length) return { change, textStart: 0 };
		return settleWriteSeams(body, index, index + 1, lastWritten, change, sharing, grammar);
	}
	joinListsMadeBeside(body, index, written, [previous], sharing);
	return settleWriteSeams(body, index, index, lastWritten, change, sharing, grammar);
}

const leadingIndent = (text: string): string => /^[ \t]*/.exec(text)![0];

/** Whether no blank line parts the block from the one above it; a first child has none above. */
const flushAbove = (children: readonly CstNode[], index: number): boolean =>
	index > 0 && children[index].leadingTrivia === '';

/** Whether the nearest block above may still read differently (an unclosed `$$`), which a closer
 *  written below can complete across blank lines. */
function unfinishedAbove(
	children: readonly CstNode[],
	index: number,
	grammar: GrammarView
): boolean {
	let above = index - 1;
	while (above >= 0 && isBlankParagraph(children[above])) above--;
	return above >= 0 && blockReadingNotFinal(children[above].raw, grammar);
}

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
	sharing: SharingState,
	grammar: GrammarView
): SettledContent {
	const tracked: TrackedPosition = { index, offset: 0 };
	const settled = absorbWindowSeams(
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
	// Read before the branches below: `settleSeparatorOnBlank` can append the tail line as a
	// block, and a count read after it would leave that growth outside the reported window.
	const beforeMint = body.children.length;
	handDownVacatedSeparator(body, at, vacated, sharing);
	clearRedundantSeparator(body, at, sharing);
	if (removed.some(isBlankParagraph)) {
		// Both ends: the removed blank line was this position's own separator and the one the
		// block below stood on.
		restoreSeparatorAfterBlank(body, at, sharing);
		if (added > 0) restoreSeparatorAfterBlank(body, at + added, sharing);
		releaseWrapPeel(body, at + Math.max(added - 1, 0));
	} else {
		settleSeparatorOnBlank(body, at + Math.max(added - 1, 0), sharing);
	}
	joinListsMadeBeside(body, at, added, removed, sharing);
	settleEmptyMarkerLists(body, at, added, sharing);
	dropWrapOfEmptiedBody(body);
	// Unconditional, and only here: a delete window at the tail names no surviving block, and
	// the question is about the body's last block whatever the window.
	materializeTailSuffix(body, sharing);
	const widened = widenForTailMint(change, beforeMint, body.children.length);
	// Merging neighbours is part of settling, not a rule each caller repeats, so a new caller
	// inherits it. A write that reports `noop` splices no window and is asked nothing.
	const absorbed = absorbWindowSeams(
		body,
		at,
		added,
		at,
		widened,
		grammar,
		sharing,
		tracked,
		// A one-block window names the block whose bytes changed, which lets the join above it be
		// refused on that block's first line alone; a wider window names no single block.
		added === 1 ? at : undefined
	).change;
	// The body's trailing line is asked again: a merge can turn the last block blank, and a
	// blank last block is what makes that line a block of its own.
	const beforeTailMint = body.children.length;
	materializeTailSuffix(body, sharing);
	return widenForTailMint(absorbed, beforeTailMint, body.children.length);
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

/** The tail line that became a block, reported inside the caller's one contiguous window. */
function widenForTailMint(
	change: StructuralChange,
	before: number,
	after: number
): StructuralChange {
	const grown = after - before;
	if (grown === 0) return change;
	if (change.op === 'noop') return { op: 'insert', at: before, count: grown };
	if (change.op === 'insert' && change.at + change.count === before) {
		return { ...change, count: change.count + grown };
	}
	if (change.op === 'replace' && change.at + change.newCount === before) {
		return { ...change, newCount: change.newCount + grown };
	}
	// A delete that took the tail vacated the position the new block lands in, so the two are
	// one window.
	if (change.op === 'delete' && change.at === before) {
		return { op: 'replace', at: change.at, count: change.count, newCount: grown };
	}
	// The new block landed past a window that does not reach the tail, so no single contiguous
	// span describes both; the parallel id arrays would drift either way this widened it.
	devWarn('tree-ops', 'a tail suffix materialized outside the reported window');
	return change;
}

/** The owning container's declared body wrap; the document has none. */
function bodyWrapOf(body: BodyParent): ContainerBodyWrap | undefined {
	return body.owner && tryGetBlockKindDescriptor(body.owner.kind)?.bodyWrap;
}

/** The parser keeps the blank line after a fenced container's opener in `innerPrefix`, so a
 *  separator freed at the body head moves there, or the reload takes the head's own line. */
function absorbWrapPrefix(body: BodyParent, bodyStart: number, index: number, freed: string): void {
	const slots = body.owner;
	if (!slots || (slots.innerPrefix ?? '') !== '') return;
	if (!bodyWrapOf(body)?.afterOpenerLine) return;
	const head = body.children[bodyStart];
	if (!head || head.leadingTrivia !== '') return;
	if (index !== bodyStart && !isBlankParagraph(head)) return;
	writeWrapSlot(body, 'innerPrefix', ownTrailingLineEnding(freed));
}

// ── Delete ──

/** Remove the node at `blockIndex`, renumbering an ordered list from its start; the fix-up that
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
