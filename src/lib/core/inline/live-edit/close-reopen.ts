/**
 * How a live cut through a format run keeps the run on both halves (`docs/design/live-mode.md`
 * § 4.4, § 4.5): the half before the cut closes it, the half after reopens it, and a half that
 * keeps none of the run's content takes none of its delimiters. Enter and every live removal
 * share this.
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
			out.push(marks.map(({ mark }) => mark).join(' '));
		}
	}
	return out;
}
