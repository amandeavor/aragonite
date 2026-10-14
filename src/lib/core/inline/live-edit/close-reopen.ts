/**
 * How a live cut through a format run keeps the run on both halves (`docs/design/live-mode.md`
 * § 4.4, § 4.5): the half before the cut closes it, the half after reopens it, and a half that
 * keeps none of the run's content takes none of its delimiters. Enter, a pending mark's escape
 * and every live removal share this.
 */

import type { AnyInlineKind, InlineNode } from '../../nodes';
import { constructContentRange, inlineDescendants } from '../index';
import type { VisibleRun } from '../visibility';
import { getInlineMarkPolicy } from '../../../schema/inline-construct-policy';

/** A construct a cut passes through, in its block's raw coordinates. */
export interface CutConstruct {
	kind: AnyInlineKind;
	start: number;
	end: number;
	contentStart: number;
	contentEnd: number;
}

export interface ClosedHalf {
	/** Where the kept bytes end: the cut, or earlier where a construct kept nothing and its
	 *  opener went with it. */
	end: number;
	/** The closers to write at `end`, innermost first. */
	closers: string;
	closed: CutConstruct[];
}

export interface ReopenedHalf {
	/** Where the kept bytes start: the cut, or later where a construct kept nothing and its
	 *  closer went with it. */
	start: number;
	/** The openers to write at `start`, outermost first. */
	openers: string;
	reopened: CutConstruct[];
}

/** The half of `raw` before `cut`, with `chain` (outermost first) closed there. */
export function closeBefore(raw: string, chain: readonly CutConstruct[], cut: number): ClosedHalf {
	let end = cut;
	let closers = '';
	const closed: CutConstruct[] = [];
	for (const link of [...chain].reverse()) {
		if (end === link.contentStart) end = link.start;
		else {
			closers += raw.slice(link.contentEnd, link.end);
			closed.push(link);
		}
	}
	return { end, closers, closed };
}

/** The half of `raw` from `cut`, with `chain` (outermost first) reopened there. */
export function reopenAfter(
	raw: string,
	chain: readonly CutConstruct[],
	cut: number
): ReopenedHalf {
	let start = cut;
	let openers = '';
	const reopened: CutConstruct[] = [];
	for (const link of [...chain].reverse()) {
		if (start === link.contentEnd) start = link.end;
		else {
			openers = raw.slice(link.start, link.contentStart) + openers;
			reopened.push(link);
		}
	}
	return { start, openers, reopened };
}

/** The marker a format chord writes for `kind`, which closes mid-word where `__` can't. Null where
 *  a run's own bytes are its only spelling (a link's destination, a code span's sized fence). */
export function markSpelling(kind: AnyInlineKind): string | null {
	const mark = getInlineMarkPolicy(kind);
	return mark && !mark.wrapBytes ? mark.markerBytes : null;
}

/** Between one character's marks: a link's destination can hold a space. */
const MARK_SEPARATOR = '\u0001';

/** The marks on each visible character of `[from, to)`, whitespace left out: its enclosing
 *  constructs, outermost first, a link with its destination. */
export function marksShown(
	runs: readonly VisibleRun[],
	inlines: readonly InlineNode[],
	raw: string,
	from: number,
	to: number
): string[] {
	const enclosing: { content: { start: number; end: number }; mark: string }[] = [];
	for (const node of inlineDescendants(inlines)) {
		const content = node.kind === 'text' ? null : constructContentRange(node);
		if (!content) continue;
		const mark = markSpelling(node.kind) ?? raw.slice(content.end, node.end);
		enclosing.push({ content, mark: `${node.kind}${mark}` });
	}
	const out: string[] = [];
	for (const run of runs) {
		if (!run.visible || run.end <= from || run.start >= to) continue;
		// A widget's text is not its bytes, so all of it stands at its source range.
		const isBytes = run.text.length === run.end - run.start;
		for (let i = 0; i < run.text.length; i++) {
			const at = isBytes ? run.start + i : run.start;
			const end = isBytes ? at + 1 : run.end;
			if (at < from || end > to || /\s/.test(run.text[i])) continue;
			const marks = enclosing.filter(({ content }) => content.start <= at && end <= content.end);
			out.push(marks.map(({ mark }) => mark).join(MARK_SEPARATOR));
		}
	}
	return out;
}

/** What `[from, to)` of a read shows: its text, and the marks on each non-whitespace character. */
export interface ShownSpan {
	visible: string;
	marks: string[];
}

export function shownSpan(
	runs: readonly VisibleRun[],
	inlines: readonly InlineNode[],
	raw: string,
	from: number,
	to: number
): ShownSpan {
	let visible = '';
	for (const run of runs) {
		if (!run.visible || run.end <= from || run.start >= to) continue;
		if (run.text.length !== run.end - run.start) {
			if (run.start >= from && run.end <= to) visible += run.text;
			continue;
		}
		visible += run.text.slice(
			Math.max(0, from - run.start),
			Math.min(run.text.length, to - run.start)
		);
	}
	return { visible, marks: marksShown(runs, inlines, raw, from, to) };
}

/** Whether `read` shows `before`, then `landed`, then `after`, each kept character in its own
 *  marks; the landed text may also take the marks of the run it landed in. */
export function landsKeepingMarks(
	read: ShownSpan,
	parts: { before: ShownSpan; landed: ShownSpan; after: ShownSpan }
): boolean {
	const { before, landed, after } = parts;
	if (read.visible !== before.visible + landed.visible + after.visible) return false;
	if (read.marks.length !== before.marks.length + landed.marks.length + after.marks.length) {
		return false;
	}
	const middle = read.marks.slice(before.marks.length, before.marks.length + landed.marks.length);
	const tail = read.marks.slice(before.marks.length + landed.marks.length);
	return (
		before.marks.every((mark, i) => read.marks[i] === mark) &&
		after.marks.every((mark, i) => tail[i] === mark) &&
		landed.marks.every((mark, i) => holdsMarks(middle[i], mark))
	);
}

/** Whether `outer`'s marks include every one of `inner`'s, in order. */
function holdsMarks(outer: string, inner: string): boolean {
	const want = inner === '' ? [] : inner.split(MARK_SEPARATOR);
	let at = 0;
	for (const mark of outer === '' ? [] : outer.split(MARK_SEPARATOR)) {
		if (at < want.length && want[at] === mark) at++;
	}
	return at === want.length;
}
