/**
 * Which interactive marks take the pointer, where their hit area reaches, and which of several
 * marks answers: one precedence rule for the overlay's stacking, a table cell's collapsed rect
 * and the keyboard's activate command, so the pointer and the keyboard pick the same mark.
 */

import type { LocalRect } from '../caret/overlay-rects';
import type { IndexedDecoration } from './buckets';
import type { MarkDecoration } from './types';

/** Only a click or hover handler costs hit-testing; a keyboard-only mark stays inert. */
export function takesPointer(dec: MarkDecoration): boolean {
	return !!(dec.interactive?.onClick || dec.interactive?.onHover);
}

/** Negative when `a` wins: the shorter range, then the earlier entry in the merged list, which
 *  is the earlier-registered source and then the earlier mark in its answer. */
export function comparePrecedence(
	a: IndexedDecoration<MarkDecoration>,
	b: IndexedDecoration<MarkDecoration>
): number {
	return a.dec.end - a.dec.start - (b.dec.end - b.dec.start) || a.index - b.index;
}

/** The winning mark among those `has` accepts, or undefined when it accepts none. */
export function winningMark(
	marks: readonly IndexedDecoration<MarkDecoration>[],
	has: (dec: MarkDecoration) => boolean
): IndexedDecoration<MarkDecoration> | undefined {
	let best: IndexedDecoration<MarkDecoration> | undefined;
	for (const mark of marks) {
		if (has(mark.dec) && (!best || comparePrecedence(mark, best) < 0)) best = mark;
	}
	return best;
}

/** Plain marks in their own order, then the pointer-taking ones with the winner last, so the
 *  rect painted on top of an overlap is the mark the precedence rule names. */
export function paintOrder(
	marks: readonly IndexedDecoration<MarkDecoration>[]
): IndexedDecoration<MarkDecoration>[] {
	const plain = marks.filter((m) => !takesPointer(m.dec));
	const pointer = marks.filter((m) => takesPointer(m.dec));
	return [...plain, ...pointer.sort((a, b) => comparePrecedence(b, a))];
}

/** How far each of one mark's line rects reaches into the space between its lines, so the
 *  pointer crossing from one line of the mark to the next never leaves it. */
export interface HitReach {
	above: number;
	below: number;
}

export function lineGapReach(rects: readonly LocalRect[]): HitReach[] {
	const bands: { top: number; bottom: number }[] = [];
	for (const r of [...rects].sort((a, b) => a.top - b.top)) {
		const last = bands.at(-1);
		if (last && r.top < last.bottom) last.bottom = Math.max(last.bottom, r.top + r.height);
		else bands.push({ top: r.top, bottom: r.top + r.height });
	}
	return rects.map((r) => {
		const i = bands.findIndex((band) => r.top >= band.top && r.top < band.bottom);
		const band = bands[i];
		const prev = bands[i - 1];
		const next = bands[i + 1];
		return {
			above: prev ? (band.top - prev.bottom) / 2 + (r.top - band.top) : 0,
			below: next ? (next.top - band.bottom) / 2 + (band.bottom - r.top - r.height) : 0
		};
	});
}
