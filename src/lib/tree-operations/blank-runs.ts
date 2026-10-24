/**
 * Lays out each run of blank lines an edit touched the way a reload reads it
 * (`docs/design/syntax-tree.md` § Blank lines). The lines the author sees stay: a run's blank
 * blocks, and a leaf's own trailing blank line. Every other line of the run (a separator, a
 * fence line's slot, the body's trailing line) is rewritten to the count the parser gives it.
 */

import type { CstNode } from '../core/nodes';
import type { NodeView } from '../core/node-views';
import { isBlankParagraph, layoutBlankRun, type RunEdge } from '../core/parser';
import { endsInBlankLine } from '../core/lines';
import { tryGetBlockKindDescriptor } from '../schema/block-kind-descriptor';
import type { GrammarView } from '../schema/block-openers';
import type { SharingState } from './sharing';
import type { StructuralChange } from './structural-change';
import { spliceList, type BodyParent } from './node-primitives';
import { fragmentReaderAt } from './list/task-paragraph';
import {
	bodyStartIndex,
	retireChildSpans,
	writeSeparator,
	writeWrapSlot
} from './separator-writes';

/**
 * Lay out every run touching children `[lo, hi]`. Idempotent; returns `change` widened over any
 * blank block the body's trailing lines became, so the window it reports holds it.
 */
export function normalizeBlankRuns(
	body: BodyParent,
	lo: number,
	hi: number,
	change: StructuralChange,
	grammar: GrammarView,
	sharing: SharingState
): StructuralChange {
	const before = body.children.length;
	for (let first = firstRunAt(body, lo); first <= Math.min(hi + 1, body.children.length);) {
		first = layOutRun(body, first, grammar, sharing) + 1;
	}
	return widenForAppended(change, before, body.children.length);
}

/** The first run touching children `[lo, hi]` that a reload reads otherwise, or null: what
 *  {@link normalizeBlankRuns} leaves behind, for the dev check after a fix-up. */
export function describeUnlaidRun(
	body: BodyParent,
	lo: number,
	hi: number,
	grammar: GrammarView
): string | null {
	for (let first = firstRunAt(body, lo); first <= Math.min(hi + 1, body.children.length);) {
		const plan = planRun(body, first, grammar);
		if (plan && changesRun(body, first, plan)) {
			const held = body.children
				.slice(first, first + plan.trivia.length)
				.map((c) => c.leadingTrivia);
			const where = `the run at ${first} of ${body.owner?.kind ?? 'the document'}`;
			return `${where} holds separators ${JSON.stringify(held)}, a reload ${JSON.stringify(plan)}`;
		}
		first = (plan?.down ?? downFrom(body, first)) + 1;
	}
	return null;
}

/** The first position of the run holding child `lo`, or of the run above it when it has content. */
function firstRunAt(body: BodyParent, lo: number): number {
	const start = bodyStartIndex(body);
	let first = Math.max(lo, start);
	while (first > start && isBlankParagraph(body.children[first - 1])) first--;
	return first;
}

/** Whether the leaf at `index` of `owner`'s body ends in a blank line its reading there leaves
 *  out, which a reload reads as the first line of the run below it. */
export function holdsTrailingBlankLine(
	node: NodeView | undefined,
	owner: NodeView | undefined,
	index: number,
	grammar: GrammarView
): boolean {
	if (!node || node.children || isBlankParagraph(node) || !endsInBlankLine(node.raw)) return false;
	return fragmentReaderAt(owner, index, grammar)(node.raw).suffix !== '';
}

// ── One run ──

interface RunEdges {
	above: RunEdge;
	below: RunEdge;
	/** 1 when the block above holds the run's first line in its own bytes. */
	leafLine: number;
}

/** A hidden line's home: the opener's slot, the separator of the run's position at an offset, or
 *  the body's trailing slot. */
type Slot = 'prefix' | number | 'suffix';

/** What laying out one run writes: the blank blocks the body's trailing lines become, and the
 *  line every slot of the run then holds. */
interface RunPlan {
	/** The position of the block below the run, before any blank block is appended. */
	down: number;
	appended: string[];
	prefix: string | undefined;
	/** Each slot's separator, by child index; appended blocks are indexed past the body's end. */
	trivia: string[];
	suffix: string | undefined;
}

/** Lays out the run whose first position is `first`, and returns the index of the block below it. */
function layOutRun(
	body: BodyParent,
	first: number,
	grammar: GrammarView,
	sharing: SharingState
): number {
	const plan = planRun(body, first, grammar);
	if (!plan) return downFrom(body, first);
	if (!changesRun(body, first, plan)) return plan.down;
	const { children, owner } = body;
	const tail = tailSlot(body);
	appendBlankBlocks(body, plan.appended, sharing);
	if (owner && plan.prefix !== undefined && (owner.innerPrefix ?? '') !== plan.prefix) {
		writeWrapSlot(body, 'innerPrefix', plan.prefix);
	}
	plan.trivia.forEach((line, i) => {
		if (children[first + i].leadingTrivia !== line) writeSeparator(body, first + i, line, sharing);
	});
	if (tail && plan.suffix !== undefined && tail.read() !== plan.suffix) tail.write(plan.suffix);
	return plan.down + plan.appended.length;
}

/** Whether laying out the run by `plan` writes anything. */
function changesRun(body: BodyParent, first: number, plan: RunPlan): boolean {
	const { children, owner } = body;
	if (plan.appended.length > 0) return true;
	if (plan.prefix !== undefined && (owner?.innerPrefix ?? '') !== plan.prefix) return true;
	if (plan.trivia.some((line, i) => children[first + i].leadingTrivia !== line)) return true;
	return plan.suffix !== undefined && tailSlot(body)?.read() !== plan.suffix;
}

/** The first position past `first` that holds a block with content, or the body's end. */
function downFrom(body: BodyParent, first: number): number {
	const { children } = body;
	let down = first;
	while (down < children.length && isBlankParagraph(children[down])) down++;
	return down;
}

/** How the run at `first` is laid out once it reads as a reload reads it, or null when it already
 *  does and is one of the plain joins most of a body is made of. */
function planRun(body: BodyParent, first: number, grammar: GrammarView): RunPlan | null {
	const { children } = body;
	const upper = first > bodyStartIndex(body) ? children[first - 1] : undefined;
	const down = downFrom(body, first);
	// Two blocks with at most one line between them are laid out already.
	if (down === first && upper && down < children.length && !endsInBlankLine(upper.raw)) {
		if (!/\n[^]/.test(children[down].leadingTrivia)) return null;
	}
	const wrap = body.owner && tryGetBlockKindDescriptor(body.owner.kind)?.bodyWrap;
	const edges: RunEdges = {
		above: upper ? 'content' : wrap?.afterOpenerLine ? 'fence' : 'none',
		below: down < children.length ? 'content' : wrap?.beforeCloserLine ? 'fence' : 'none',
		leafLine: holdsTrailingBlankLine(upper, body.owner, first - 1, grammar) ? 1 : 0
	};
	const tail = edges.below === 'content' ? undefined : tailSlot(body);
	const trailing = tail ? linesOf(tail.read()) : [];
	let pool = hiddenLines(body, first, down, edges.above === 'content' ? undefined : body.owner);
	pool = [...pool, ...trailing];
	let blocks = down - first;
	let hidden = hiddenCount(pool.length, blocks, edges);
	// Lines past what the run needs are dropped, except the body's own trailing lines under a blank
	// block, which a reload reads as blocks; an emptied body under a fence line gives them up.
	let appended: string[] = [];
	const excess = pool.length - hidden;
	const materializes = edges.below === 'none' && (blocks > 0 || edges.above === 'none');
	if (excess > 0 && trailing.length > 0 && materializes) {
		appended = trailing.slice(Math.max(trailing.length - excess, 0));
		pool = pool.slice(0, pool.length - appended.length);
		blocks += appended.length;
		hidden = hiddenCount(pool.length, blocks, edges);
	}

	const plan: RunPlan = {
		down,
		appended,
		prefix: edges.above === 'fence' ? '' : undefined,
		trivia: new Array<string>(blocks + Number(edges.below === 'content')).fill(''),
		suffix: tail ? '' : undefined
	};
	slotsFor(blocks, hidden, edges).forEach((slot, i) => {
		// A line the run holds keeps its bytes; a missing one takes the document's ending.
		const line = pool[i] ?? body.lineEnding;
		if (slot === 'prefix') plan.prefix += line;
		else if (slot === 'suffix') plan.suffix += line;
		else plan.trivia[slot] = line;
	});
	return plan;
}

/** The run's hidden lines above its trailing slot, top to bottom: the opener's slot, then each
 *  position's separator down to the block below. */
function hiddenLines(
	body: BodyParent,
	first: number,
	down: number,
	opener: CstNode | undefined
): string[] {
	const { children } = body;
	const slots: string[] = [];
	if (opener) slots.push(opener.innerPrefix ?? '');
	for (let i = first; i <= down && i < children.length; i++) slots.push(children[i].leadingTrivia);
	return slots.flatMap(linesOf);
}

/** How many hidden lines the run keeps: of the counts a reload reads as exactly `blocks` blank
 *  blocks, the nearest to what it holds, and at most one line past the fewest. */
function hiddenCount(held: number, blocks: number, edges: RunEdges): number {
	let min = -1;
	let max = -1;
	for (let hidden = 0; hidden <= 3; hidden++) {
		const lines = edges.leafLine + hidden + blocks;
		if (layoutBlankRun(lines, edges.above, edges.below).blocks !== blocks) continue;
		if (min < 0) min = hidden;
		max = hidden;
	}
	if (min < 0) return held;
	return Math.min(Math.max(held, min), max, min + 1);
}

/** Where each kept hidden line goes, top to bottom: the opener's slot, the separator of the run's
 *  position at that offset, or the trailing slot. A leaf's own line stands in for the topmost. */
function slotsFor(blocks: number, hidden: number, edges: RunEdges): Slot[] {
	const layout = layoutBlankRun(edges.leafLine + hidden + blocks, edges.above, edges.below);
	const slots: Slot[] = [];
	if (layout.fencePrefix) slots.push('prefix');
	if (layout.separator) {
		if (blocks > 0 || edges.below === 'content') slots.push(0);
		else slots.push('suffix');
	}
	if (layout.fenceSuffix) slots.push('suffix');
	return edges.leafLine ? slots.slice(1) : slots;
}

// ── The body's trailing slot ──

interface TailSlot {
	read(): string;
	write(lines: string): void;
}

/** Where a body keeps the blank lines after its last block: the document's `suffix`, else the
 *  owner's `innerSuffix`. */
function tailSlot(body: BodyParent): TailSlot | undefined {
	if (body.suffix !== undefined) {
		return { read: () => body.suffix ?? '', write: (lines) => (body.suffix = lines) };
	}
	const { owner } = body;
	if (!owner) return undefined;
	return {
		read: () => owner.innerSuffix ?? '',
		write: (lines) => writeWrapSlot(body, 'innerSuffix', lines)
	};
}

function appendBlankBlocks(
	body: BodyParent,
	lines: readonly string[],
	sharing: SharingState
): void {
	if (lines.length === 0) return;
	// New children move the count, which the owner's child spans are laid out against.
	retireChildSpans(body);
	for (const raw of lines) {
		const block: CstNode = { kind: 'paragraph', leadingTrivia: '', raw };
		sharing.stamp(block);
		spliceList(body, body.children.length, 0, [block]);
	}
}

/** `change` grown over blocks appended at the body's end, as one contiguous window: positions
 *  between the change's own window and the new blocks keep their blocks. */
function widenForAppended(
	change: StructuralChange,
	before: number,
	after: number
): StructuralChange {
	const grown = after - before;
	if (grown === 0) return change;
	if (change.op === 'noop') return { op: 'insert', at: before, count: grown };
	const added =
		change.op === 'insert' ? change.count : change.op === 'delete' ? 0 : change.newCount;
	const removed = change.op === 'insert' ? 0 : change.count;
	if (change.op === 'insert' && change.at + added === before) {
		return { ...change, count: added + grown };
	}
	const newCount = after - change.at;
	const count = before - change.at - added + removed;
	const idMap: Record<number, number> = change.op === 'replace' ? { ...change.idMap } : {};
	for (let slot = added; slot < newCount - grown; slot++) idMap[slot] = slot - added + removed;
	if (Object.keys(idMap).length === 0) return { op: 'replace', at: change.at, count, newCount };
	return { op: 'replace', at: change.at, count, newCount, idMap };
}

/** A run of blank lines split into its lines, each keeping its own ending. */
const linesOf = (run: string): string[] => run.match(/[^\n]*\n|[^\n]+$/g) ?? [];
