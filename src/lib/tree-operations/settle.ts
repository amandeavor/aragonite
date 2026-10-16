/**
 * Recomputes the blank-line separators an edit left stale, has `neighbour-merge.ts` merge the
 * neighbours that would re-read as one block, and deletes a block on top of both
 * (`docs/design/syntax-tree.md` § Blank lines). Each takes the body with its owner, whose fence
 * lines and title decide where a separator may sit, and writes through `separator-writes.ts`.
 */

import type { CstNode, Document } from '../core/nodes';
import type { NodeView } from '../core/node-views';
import { isBlankParagraph, type ContainerBodyWrap } from '../core/parser';
import { ownTrailingLineEnding, type LineEnding } from '../core/lines';
import { devWarn } from '../dev-warn';
import { tryGetBlockKindDescriptor } from '../schema/block-kind-descriptor';
import type { GrammarView } from '../schema/block-openers';
import { assertInvariant } from '../assert';
import { checkStructuralDescriptor } from '../invariants/structural-descriptor';
import type { SharingState } from './sharing';
import { lacksSublistSeparator } from './list/sublist-separator';
import { itemsShareList } from './list/ordered-markers';
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
export function restoreSeparatorAfterBlank(
	body: BodyParent,
	index: number,
	sharing: SharingState
): void {
	const { children } = body;
	const node = children[index];
	if (!node || node.leadingTrivia !== '') return;
	if (isBlankParagraph(node) && (children[index + 1]?.leadingTrivia ?? '') !== '') return;
	mintSeparator(body, index, sharing);
}

/** A list one block's fill or rewrite made, `added` blocks from `at`, joins a same-type list across
 *  the blank line at either edge where the block it replaced didn't; the neighbour merge follows. */
export function joinListsMadeBeside(
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
export function releaseWrapPeel(body: BodyParent, index: number): void {
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

/** The block that takes the vacated position inherits its separator when it has none of its own
 *  ({@link deleteNode}'s rule). */
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

/**
 * The commit's entry point: recompute the separators around `change`'s window against `before`,
 * the children before the mutation. A node that survives inside the window counts as kept.
 */
export function settleSeparator(
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
 * {@link settleSeparator} for a splice outside a commit scope, into a container found by walking
 * the live tree; the owner's `childIds` stay in step.
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
	const ids = (parent as CstNode).childIds;
	if (ids) applyStructuralChangeToIdsRefs(settled, ids, new Array(ids.length));
}

/** The tail line that became a block, reported inside the caller's one contiguous window. */
export function widenForTailMint(
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

/** Remove the node at `blockIndex`, leaving its successor separated once and no more. A whole
 *  document reads as its own body. */
export function deleteNode(
	parent: BodyParentArg,
	blockIndex: number,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition
): StructuralChange {
	const body = asBody(parent);
	const { children } = body;
	if (blockIndex < 0 || blockIndex >= children.length) return { op: 'noop' };

	const deleted = children[blockIndex];
	const successor = children[blockIndex + 1];
	// The successor inherits the deleted separator only when it has none of its own:
	// concatenating both leaves behind a blank line the delete should have taken.
	if (successor && successor.leadingTrivia === '' && deleted.leadingTrivia !== '') {
		writeSeparator(body, blockIndex + 1, deleted.leadingTrivia, sharing);
	}

	retireChildSpans(body);
	children.splice(blockIndex, 1);
	clearRedundantSeparator(body, blockIndex, sharing);
	// Both of the survivor's edges: the delete puts it beside a new follower, and a merge that
	// rewrote its bytes can equally have stopped it interrupting the block above.
	const survivor = Math.max(blockIndex - 1, 0);
	return absorbWindowSeams(
		body,
		survivor,
		blockIndex - survivor,
		blockIndex,
		{ op: 'delete', at: blockIndex, count: 1 },
		grammar,
		sharing,
		tracked
	).change;
}
