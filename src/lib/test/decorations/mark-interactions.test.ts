// Which interactive mark answers, and where a hover mark's hit area reaches: the rules the
// overlay, the hover hit-test and the activate command all read.
import { describe, it, expect } from 'vitest';
import {
	hitRect,
	paintOrder,
	takesPointer,
	winningMark
} from '#lib/decorations/mark-interactions.js';
import type { IndexedDecoration } from '#lib/decorations/buckets.js';
import type { MarkDecoration, MarkInteractions } from '#lib/decorations/types.js';

function mark(
	index: number,
	start: number,
	end: number,
	interactive?: MarkInteractions
): IndexedDecoration<MarkDecoration> {
	return {
		index,
		dec: { type: 'mark', path: [0], start, end, class: `m${index}`, interactive }
	};
}

const hover = { onHover: () => {} };
const click = { onClick: () => {} };

describe('the precedence rule', () => {
	it('picks the shortest range, then the earliest entry', () => {
		const marks = [mark(0, 0, 9, hover), mark(1, 2, 4, hover), mark(2, 5, 7, hover)];
		expect(winningMark(marks, () => true)?.index).toBe(1);
	});

	it('skips the marks the filter refuses', () => {
		const marks = [mark(0, 0, 9, hover), mark(1, 2, 4)];
		expect(winningMark(marks, (d) => !!d.interactive?.onHover)?.index).toBe(0);
		expect(winningMark([mark(0, 0, 1)], (d) => !!d.interactive)).toBeUndefined();
	});

	it('paints plain and hover-only marks first, then click marks with the winner last', () => {
		const marks = [
			mark(0, 2, 4, click),
			mark(1, 0, 9, hover),
			mark(2, 0, 9, click),
			mark(3, 2, 4, click)
		];
		expect(paintOrder(marks).map((m) => m.index)).toEqual([1, 2, 3, 0]);
	});

	it('takes the pointer only for a click handler', () => {
		expect(takesPointer(mark(0, 0, 1, click).dec)).toBe(true);
		expect(takesPointer(mark(0, 0, 1, { ...hover, ...click }).dec)).toBe(true);
		expect(takesPointer(mark(0, 0, 1, hover).dec)).toBe(false);
		expect(takesPointer(mark(0, 0, 1, { onActivate: () => {} }).dec)).toBe(false);
		expect(takesPointer(mark(0, 0, 1).dec)).toBe(false);
	});
});

describe('hitRect', () => {
	const lines = [
		{ left: 40, top: 0, width: 60, height: 20 },
		{ left: 0, top: 26, width: 30, height: 20 }
	];

	it('finds the rect holding the point, edges included', () => {
		expect(hitRect(lines, 50, 10)).toBe(lines[0]);
		expect(hitRect(lines, 30, 46)).toBe(lines[1]);
		expect(hitRect(lines, 35, 36)).toBeNull();
	});

	it('counts the space between two lines on the rect above or below that spans the point', () => {
		expect(hitRect(lines, 60, 23)).toBe(lines[0]);
		expect(hitRect(lines, 10, 23)).toBe(lines[1]);
		expect(hitRect(lines, 35, 23)).toBeNull();
	});

	it('reaches no further than the first and last lines', () => {
		expect(hitRect(lines, 60, -2)).toBeNull();
		expect(hitRect(lines, 10, 48)).toBeNull();
	});

	it('treats rects that overlap vertically as one line', () => {
		const sameLine = [
			{ left: 0, top: 0, width: 50, height: 20 },
			{ left: 50, top: 4, width: 10, height: 12 },
			{ left: 0, top: 30, width: 40, height: 20 }
		];
		expect(hitRect(sameLine, 55, 25)).toBe(sameLine[1]);
	});
});
