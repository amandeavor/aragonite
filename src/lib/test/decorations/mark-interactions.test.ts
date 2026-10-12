// Which interactive mark answers, and how far a hover mark's lines reach toward each other: the
// rules the overlay, a table cell and the activate command all read.
import { describe, it, expect } from 'vitest';
import {
	lineGapReach,
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

	it('paints plain marks first, then pointer marks with the winner last', () => {
		const marks = [
			mark(0, 2, 4, hover),
			mark(1, 0, 9),
			mark(2, 0, 9, { onClick: () => {} }),
			mark(3, 2, 4, hover)
		];
		expect(paintOrder(marks).map((m) => m.index)).toEqual([1, 2, 3, 0]);
	});

	it('takes the pointer only for a click or hover handler', () => {
		expect(takesPointer(mark(0, 0, 1, { onActivate: () => {} }).dec)).toBe(false);
		expect(takesPointer(mark(0, 0, 1, hover).dec)).toBe(true);
		expect(takesPointer(mark(0, 0, 1).dec)).toBe(false);
	});
});

describe('lineGapReach', () => {
	it('meets halfway across the space between two lines, and reaches nowhere past the ends', () => {
		const lines = [
			{ left: 0, top: 0, width: 100, height: 20 },
			{ left: 0, top: 26, width: 40, height: 20 }
		];
		expect(lineGapReach(lines)).toEqual([
			{ above: 0, below: 3 },
			{ above: 3, below: 0 }
		]);
	});

	it('gives every rect on one line the same edges, a short fragment reaching the line box', () => {
		const rects = [
			{ left: 0, top: 0, width: 50, height: 20 },
			{ left: 50, top: 4, width: 10, height: 12 },
			{ left: 0, top: 30, width: 40, height: 20 }
		];
		const [tall, short] = lineGapReach(rects);
		expect(tall.below).toBe(5);
		expect(short.below).toBe(5 + 4);
	});

	it('reaches nowhere for a single line', () => {
		expect(lineGapReach([{ left: 0, top: 0, width: 10, height: 20 }])).toEqual([
			{ above: 0, below: 0 }
		]);
	});
});
