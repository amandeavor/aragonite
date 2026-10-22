/**
 * Merges neighbouring blocks whose joined bytes reload as fewer blocks, or move content into the
 * one above, after an edit changed what stands beside them (`docs/design/syntax-tree.md` § Blank
 * lines). A merge re-reads the joined bytes, so a caret position it was handed is tracked through.
 */

import type { CstNode, Document } from '../core/nodes';
import type { NodeView } from '../core/node-views';
import { isBlankParagraph, readBlocks } from '../core/parser';
import {
	firstLineEnding,
	ownTrailingLineEnding,
	splitLines,
	trimTrailingLineEnding
} from '../core/lines';
import { tableTakesLine } from '../core/parsers/table';
import { assignChildIdsDeep } from '../block-id';
import { tryGetBlockKindDescriptor } from '../schema/block-kind-descriptor';
import { blockReadingNotFinal, type GrammarView } from '../schema/block-openers';
import { ensureEditableContainers } from '../schema/opened-reading';
import type { SharingState } from './sharing';
import { spliceMany } from './splice-many';
import type { StructuralChange } from './structural-change';
import type { BodyParent } from './node-primitives';
import { mintSeparator, retireChildSpans, writeSeparator } from './separator-writes';

/** What a merge of neighbours absorbed; `span + eaten` is the block count before the merge, the
 *  figure a change descriptor reports. */
interface SeamAbsorption {
	at: number;
	span: number;
	eaten: number;
	spliced: boolean;
}

/** A byte position the merges keep updated, written in place since each merge re-divides the
 *  bytes into blocks. */
export interface TrackedPosition {
	index: number;
	offset: number;
}

/**
 * Merge neighbours while their joined bytes reload as fewer blocks or move content into the head;
 * blank lines don't end a container, so the window starts at the nearest non-blank block above.
 */
export function absorbSeamReading(
	body: BodyParent,
	seamLeft: number,
	floor: number,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition,
	headProbe?: number,
	onBeforeSplice?: () => void
): SeamAbsorption {
	const read = (bytes: string) => readBlocks(bytes, { grammar, scope: 'fragment' });
	const { children } = body;
	if (seamLeft < 0) return { at: 0, span: 0, eaten: 0, spliced: false };
	let left = seamLeft;
	while (left > floor && isBlankParagraph(children[left])) left--;
	const at = left;
	let span = seamLeft - at + 1;
	let eaten = 0;
	let spliced = false;
	// Only on the first pass: a merge re-divides the window, so the index is stale after one.
	let probe = headProbe;
	for (;;) {
		// The window's far edge crosses a blank run too: the absorbed content sits on the run's
		// far side (a list continues into indented code across any number of blank lines).
		let right = at + span;
		while (right < children.length && isBlankParagraph(children[right])) right++;
		const window = children.slice(at, Math.min(right + 1, children.length));
		if (window.length <= span || window.length < 2) break;
		if (separateTableFollower(body, right, sharing, grammar)) break;
		// A context-dependent kind has no standalone reading, so a join touching it cannot be asked.
		if (window.some((node) => tryGetBlockKindDescriptor(node.kind)?.contextDependentKind)) break;
		if (probe !== undefined && declinesOnHeadLine(window, probe - at, read, grammar)) break;
		probe = undefined;
		const bytes = joinedWindowBytes(window, window.length);
		const reparsed = read(bytes);
		let blocks = reparsed.children;
		// Content blocks only: the blank lines an absorbed block held come back as blank blocks.
		if (blocks.length === 0 || contentCount(blocks) > contentCount(window)) break;
		// A count that did not drop is still a merge when the head took content from the block
		// below: a blank run inside that block stays blank blocks while the rest moves up.
		if (blocks.length >= window.length && !headTookContent(blocks[0], window)) break;
		// A merge may promote the head beyond what its bytes carry alone (a paragraph under the
		// setext underline below it), so what must survive is the head's own reading, not its kind.
		if (blocks[0].kind !== window[0].kind && !readsAsItselfAlone(window[0], read)) break;
		onBeforeSplice?.();
		blocks = withLowerEdge(body, at + window.length, bytes, reparsed, read, sharing);
		installReading(body, at, window, blocks, bytes, sharing, tracked);
		eaten += window.length - blocks.length;
		span = blocks.length;
		spliced = true;
	}
	return { at, span, eaten, spliced };
}

/** The blocks a re-read of `window`'s bytes gave, put in its place, the head keeping its line. */
function installReading(
	body: BodyParent,
	at: number,
	window: readonly CstNode[],
	blocks: CstNode[],
	bytes: string,
	sharing: SharingState,
	tracked: TrackedPosition | undefined
): void {
	blocks[0].leadingTrivia = window[0].leadingTrivia;
	// The window joins two blocks at least, so its bytes hold the document's line ending.
	const lineEnding = firstLineEnding(bytes) ?? '\n';
	for (const block of blocks) {
		ensureEditableContainers(block, lineEnding);
		sharing.stamp(block);
		assignChildIdsDeep(block);
	}
	if (tracked) retrackThroughFold(tracked, at, window, blocks);
	// The merge re-divides the owner's children, which its child spans are laid out against.
	retireChildSpans(body);
	spliceMany(body.children, at, window.length, blocks);
}

// ── The join question ──

/**
 * How two blocks read flush against each other: as themselves, as the lower folded into the
 * upper's last paragraph, as something else a blank line would undo, or as one a blank line can't
 * part (a list taking indented code in across any number of them).
 */
export type JoinReading = 'stands' | 'folds' | 'separate' | 'merge';

/** Who left a join: an edit that put a block there, or one that took the block between away. */
export type JoinOrigin = 'placed' | 'uncovered';

function resolveJoin(prev: CstNode, next: CstNode, grammar: GrammarView): JoinReading {
	const read = (bytes: string) => readBlocks(bytes, { grammar, scope: 'fragment' }).children;
	const flush = read(prev.raw + next.raw);
	if (readsAsPair(flush, prev, next)) return 'stands';
	// The block above isn't last, so its line ending is the document's.
	if (!readsAsPair(read(prev.raw + ownTrailingLineEnding(prev.raw) + next.raw), prev, next)) {
		return 'merge';
	}
	// The lower block folds in as itself (two quotes as one) or as prose under a paragraph; a table,
	// a rule or indented code read as paragraph text would change its kind.
	const [head] = flush;
	const tookText = head.kind === prev.kind && head.raw.length > prev.raw.length;
	const keepsKind = next.kind === prev.kind || (next.kind === 'paragraph' && endsInParagraph(head));
	return tookText && keepsKind ? 'folds' : 'separate';
}

/** Keep child `at` apart from the block above with a blank line where its origin asks: placed,
 *  wherever flush they'd read otherwise; uncovered, only where a block would change its kind. */
export function separateJoin(
	body: BodyParent,
	at: number,
	origin: JoinOrigin,
	grammar: GrammarView,
	sharing: SharingState
): void {
	const { children } = body;
	if (at <= 0 || at >= children.length) return;
	const prev = children[at - 1];
	const next = children[at];
	if (next.leadingTrivia !== '' || isBlankParagraph(prev) || isBlankParagraph(next)) return;
	const reading = resolveJoin(prev, next, grammar);
	if (reading === 'separate' || (reading === 'folds' && origin === 'placed')) {
		mintSeparator(body, at, sharing);
	}
}

/** Whether a re-read gave back the window's own blocks, each with its kind and bytes. */
const readsAsWindow = (blocks: readonly CstNode[], window: readonly CstNode[]): boolean =>
	blocks.length === window.length &&
	blocks.every((block, i) => block.kind === window[i].kind && block.raw === window[i].raw);

/** Whether `blocks` are `prev` and `next` again, each with its own bytes and kind. */
const readsAsPair = (blocks: readonly CstNode[], prev: CstNode, next: CstNode): boolean =>
	blocks.length === 2 &&
	blocks[0].kind === prev.kind &&
	blocks[0].raw === prev.raw &&
	blocks[1].kind === next.kind &&
	blocks[1].raw === next.raw;

/** Whether a block's last line sits in a paragraph, at any depth: where lazy text continues. */
function endsInParagraph(node: CstNode): boolean {
	if (node.kind === 'paragraph') return true;
	const last = node.children?.at(-1);
	return last !== undefined && endsInParagraph(last);
}

// ── The span re-read ──

/** Re-read children `top` through `bottom` as one span, taken where it reads otherwise: a
 *  construct backed out at the top that a line at the bottom now finishes (editor.md § 8). */
export function absorbSpanReading(
	body: BodyParent,
	top: number,
	bottom: number,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition
): SettledSplice {
	const unchanged = { change, landing: tracked?.index ?? top };
	const window = body.children.slice(top, bottom + 1);
	if (window.length < 2) return unchanged;
	if (window.some((node) => tryGetBlockKindDescriptor(node.kind)?.contextDependentKind)) {
		return unchanged;
	}
	const read = (bytes: string) => readBlocks(bytes, { grammar, scope: 'fragment' });
	const bytes = joinedWindowBytes(window, window.length);
	const reparsed = read(bytes);
	if (reparsed.children.length === 0 || readsAsWindow(reparsed.children, window)) return unchanged;
	const blocks = withLowerEdge(body, bottom + 1, bytes, reparsed, read, sharing);
	installReading(body, top, window, blocks, bytes, sharing, tracked);
	const eaten = window.length - blocks.length;
	const settled = foldAbsorbIntoChange(change, {
		at: top,
		span: blocks.length,
		eaten,
		spliced: true
	});
	return { change: settled, landing: tracked?.index ?? top };
}

/**
 * Give a block an edit left right under a table a blank line, or the reload reads its first line
 * as one more row; the edit made the block, so it stays that block.
 */
function separateTableFollower(
	body: BodyParent,
	index: number,
	sharing: SharingState,
	grammar: GrammarView
): boolean {
	const follower = body.children[index];
	if (body.children[index - 1]?.kind !== 'table' || follower.leadingTrivia !== '') return false;
	// All of the follower's lines, not its first alone: an opener can need a later one to open.
	const lines = splitLines(follower.raw);
	if (lines.length === 0) return false;
	if (!tableTakesLine(lines, 0, lines.length, grammar)) return false;
	mintSeparator(body, index, sharing);
	return true;
}

const contentCount = (nodes: readonly CstNode[]): number =>
	nodes.filter((node) => !isBlankParagraph(node)).length;

/** Whether the reparse moved content into the head: more than the separating blank line, or,
 *  for a container, that line alone, since its body reads an indented one as its own. */
function headTookContent(head: CstNode, window: readonly CstNode[]): boolean {
	const grew = head.raw.length - window[0].raw.length;
	return grew > window[1].leadingTrivia.length || (head.children !== undefined && grew > 0);
}

/** Whether a block's own bytes read back as that block. A container's children never do (an
 *  item's bytes read as a list), which keeps them out of the merge. */
function readsAsItselfAlone(node: CstNode, read: (bytes: string) => Document): boolean {
	const alone = read(node.raw).children;
	return alone.length === 1 && alone[0].kind === node.kind;
}

/**
 * A cheap refusal for a window the changed block heads or ends, parsing the last block's first
 * line only: parsing reads lines in order, so a block that opens there opens in the full join too.
 */
function declinesOnHeadLine(
	window: readonly CstNode[],
	member: number,
	read: (bytes: string) => Document,
	grammar: GrammarView
): boolean {
	const last = window.length - 1;
	if (member !== 0 && member !== last) return false;
	// A block whose reading isn't final (an unclosed `$$`) can read differently in the full join.
	if (window.slice(0, last).some((node) => blockReadingNotFinal(node.raw, grammar))) return false;
	const raw = window[last].raw;
	const nl = raw.indexOf('\n');
	const joined =
		joinedWindowBytes(window, last) +
		window[last].leadingTrivia +
		(nl < 0 ? raw : raw.slice(0, nl + 1));
	return read(joined).children.length >= window.length;
}

function joinedWindowBytes(window: readonly CstNode[], count: number): string {
	let joined = window[0].raw;
	for (let i = 1; i < count; i++) joined += window[i].leadingTrivia + window[i].raw;
	return joined;
}

/**
 * Where a byte position inside the merged window ends up: the merge's reparse re-divides the
 * joined bytes, and a position past the window only shifts by the blocks the merge ate.
 */
function retrackThroughFold(
	tracked: TrackedPosition,
	at: number,
	window: readonly CstNode[],
	blocks: readonly CstNode[]
): void {
	const member = tracked.index - at;
	if (member < 0) return;
	if (member >= window.length) {
		tracked.index -= window.length - blocks.length;
		return;
	}
	// The offset walk mirrors {@link joinedWindowBytes}.
	let joined = tracked.offset;
	for (let i = 0; i < member; i++) {
		joined += (i === 0 ? 0 : window[i].leadingTrivia.length) + window[i].raw.length;
	}
	if (member > 0) joined += window[member].leadingTrivia.length;
	const landed = focusTargetInReplacement(blocks, joined);
	tracked.index = at + landed.index;
	tracked.offset = landed.offset;
}

/** The block a caret offset into the committed bytes falls in, and its offset there. An offset in
 *  the blank lines between blocks lands at the next block's start. */
export function focusTargetInReplacement(
	nodes: readonly NodeView[],
	offset: number
): { index: number; offset: number } {
	let pos = 0;
	for (let i = 0; i < nodes.length; i++) {
		const bodyStart = i === 0 ? 0 : pos + nodes[i].leadingTrivia.length;
		const bodyEnd = bodyStart + trimTrailingLineEnding(nodes[i].raw).length;
		if (offset <= bodyEnd) {
			return { index: i, offset: Math.max(0, offset - bodyStart) };
		}
		pos = bodyStart + nodes[i].raw.length;
	}
	const last = nodes.length - 1;
	return { index: last, offset: trimTrailingLineEnding(nodes[last].raw).length };
}

/** What settling a splice produced: its change widened by every merge, and where a tracked
 *  index ended up. */
export interface SettledSplice {
	change: StructuralChange;
	landing: number;
}

/** Merge across every join the splice at `at` disturbed, the joins inside the window included,
 *  since a move can break a join that was correct. `headProbe` names the one changed block. */
export function absorbWindowSeams(
	body: BodyParent,
	at: number,
	added: number,
	landing: number,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState,
	tracked?: TrackedPosition,
	headProbe?: number,
	onBeforeSplice?: () => void
): SettledSplice {
	let settled: SeamAbsorption | null = null;
	let moved = landing;
	let seamLeft = at - 1;
	let last = at + added - 1;
	while (seamLeft <= last) {
		const seam = absorbSeamReading(
			body,
			seamLeft,
			0,
			grammar,
			sharing,
			tracked,
			settled ? undefined : headProbe,
			onBeforeSplice
		);
		if (!seam.spliced) {
			seamLeft++;
			continue;
		}
		settled = settled ? unionAbsorptions(settled, seam) : seam;
		moved = indexAfterAbsorb(moved, seam);
		last = indexAfterAbsorb(last, seam);
		seamLeft = seam.at + seam.span;
	}
	if (!settled) return { change, landing: moved };
	return { change: foldAbsorbIntoChange(change, settled), landing: moved };
}

/** Two merges as one window, which is what a change descriptor reports. The walk is left to
 *  right, so `later` never starts above `earlier`'s post-splice span. */
function unionAbsorptions(earlier: SeamAbsorption, later: SeamAbsorption): SeamAbsorption {
	return {
		at: earlier.at,
		span: later.at + later.span - earlier.at,
		eaten: earlier.eaten + later.eaten,
		spliced: true
	};
}

/** Where `index` sits once `seam` merged: a position inside the absorbed span collapses into it. */
function indexAfterAbsorb(index: number, seam: SeamAbsorption): number {
	if (index < seam.at) return index;
	const absorbedTo = seam.at + seam.span + seam.eaten;
	return index >= absorbedTo ? index - seam.eaten : Math.min(index, seam.at + seam.span - 1);
}

/** The merged window and the write's own as one contiguous change; `count` counts positions
 *  before the write, so the span converts back across what the write added or removed. */
function foldAbsorbIntoChange(change: StructuralChange, seam: SeamAbsorption): StructuralChange {
	const absorbedTo = seam.at + seam.span + seam.eaten;
	if (change.op === 'noop') {
		return {
			op: 'replace',
			at: seam.at,
			count: absorbedTo - seam.at,
			newCount: seam.span,
			idMap: { 0: 0 }
		};
	}
	const written =
		change.op === 'insert' ? change.count : change.op === 'delete' ? 0 : change.newCount;
	const removed = change.op === 'insert' ? 0 : change.count;
	const lo = Math.min(seam.at, change.at);
	const hi = Math.max(absorbedTo, change.at + written);
	const count = hi - lo - written + removed;
	const newCount = hi - lo - seam.eaten;
	return {
		op: 'replace',
		at: lo,
		count,
		newCount,
		idMap: composeFoldIdMap(change, seam, { lo, count, newCount, written, removed })
	};
}

/** The union window's extents, in the two index spaces the composition steps through. */
interface FoldWindow {
	lo: number;
	count: number;
	newCount: number;
	written: number;
	removed: number;
}

/** A position the merge did not re-create keeps its block's id through both steps. Position 0
 *  always maps to the head, since a merge extends its head, even when it changes its kind. */
function composeFoldIdMap(
	change: StructuralChange,
	seam: SeamAbsorption,
	window: FoldWindow
): Record<number, number> {
	const idMap: Record<number, number> = {};
	for (let slot = 0; slot < window.newCount; slot++) {
		const index = window.lo + slot;
		if (index >= seam.at && index < seam.at + seam.span) continue;
		// Back through the merge: a position past the absorbed span sat `eaten` further down before it.
		const spliced = index < seam.at ? index : index + seam.eaten;
		const old = preChangeIndex(change, spliced, window);
		if (old === null) continue;
		const oldSlot = old - window.lo;
		if (oldSlot >= 0 && oldSlot < window.count) idMap[slot] = oldSlot;
	}
	if (idMap[0] === undefined) idMap[0] = 0;
	return idMap;
}

/** Where `spliced` (a post-change index) stood before the change, or null for a block the change
 *  created. */
function preChangeIndex(
	change: StructuralChange,
	spliced: number,
	window: FoldWindow
): number | null {
	if (change.op === 'noop') return spliced;
	if (spliced < change.at) return spliced;
	if (spliced >= change.at + window.written) return spliced - window.written + window.removed;
	const inherited = change.op === 'replace' ? change.idMap?.[spliced - change.at] : undefined;
	return inherited === undefined ? null : change.at + inherited;
}

/**
 * The merged blocks once the blank lines at the window's lower edge are read with them: a re-read
 * that ends in a blank line takes the follower's separator into the same reading, as a reload does.
 */
function withLowerEdge(
	body: BodyParent,
	followerIndex: number,
	bytes: string,
	reparsed: Document,
	read: (bytes: string) => Document,
	sharing: SharingState
): CstNode[] {
	const blocks = reparsed.children;
	const follower = body.children[followerIndex];
	if (!follower) {
		blocks[blocks.length - 1].raw += reparsed.suffix;
		return blocks;
	}
	const endsBlank = reparsed.suffix !== '' || isBlankParagraph(blocks[blocks.length - 1]);
	if (!endsBlank || (follower.leadingTrivia === '' && reparsed.suffix === '')) return blocks;
	const edge = read(bytes + follower.leadingTrivia);
	writeSeparator(body, followerIndex, edge.suffix, sharing);
	return edge.children;
}
