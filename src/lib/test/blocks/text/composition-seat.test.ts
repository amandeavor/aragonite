// @vitest-environment jsdom
// What one composition captures, from `noteStart` to the commit: the selection it opened over, which
// the commit has already overwritten by the time the composed run arrives. A run at a plain caret is
// the block write's to place and mark, like any insertion; the mode check lives in the block.
import { describe, it, expect } from 'vitest';
import { createCompositionSeat } from '#lib/components/blocks/text/composition-seat.js';

const BOLD = 'Some **bold** text';

interface Live {
	display: string;
	range: { start: number; end: number } | null;
	rangeEdits: Array<{ range: { start: number; end: number }; typed: string }>;
}

function makeSeat(live: Live) {
	return createCompositionSeat({
		getDisplayText: () => live.display,
		getRawSelection: () => live.range,
		resolveRangeEdit: (range, typed) => {
			live.rangeEdits.push({ range, typed });
			return { raw: `cleaned:${typed}`, caret: 1 };
		}
	});
}

function liveState(display: string, range: Live['range'] = null): Live {
	return { display, range, rangeEdits: [] };
}

describe('the window is captured at noteStart, not read at the commit', () => {
	it('replaces the selection and display the composition opened at', () => {
		const live = liveState(BOLD, { start: 5, end: 13 });
		const seat = makeSeat(live);
		seat.noteStart();
		live.display = 'unrelated';
		live.range = null;
		expect(seat.relocate('Some かん text')).toEqual({ raw: 'cleaned:かん', caret: 1 });
	});

	it('leaves a run at a plain caret to the write, which places it like any insertion', () => {
		const seat = makeSeat(liveState(BOLD));
		seat.noteStart();
		expect(seat.relocate('Some **boldかん** text')).toBeNull();
	});

	it('answers null outside a window: before any start, and after noteEnd', () => {
		const seat = makeSeat(liveState(BOLD, { start: 5, end: 13 }));
		expect(seat.relocate('Some かん text')).toBeNull();
		seat.noteStart();
		seat.noteEnd();
		expect(seat.relocate('Some かん text')).toBeNull();
	});
});

describe('a selection captured at noteStart routes the commit to the join', () => {
	it('hands the join the range and the extracted run', () => {
		const live = liveState(BOLD, { start: 5, end: 13 });
		const seat = makeSeat(live);
		seat.noteStart();
		expect(seat.relocate('Some かん text')).toEqual({ raw: 'cleaned:かん', caret: 1 });
		expect(live.rangeEdits).toEqual([{ range: { start: 5, end: 13 }, typed: 'かん' }]);
	});

	it('declines a read that is not a replacement of the captured range', () => {
		const live = liveState(BOLD, { start: 5, end: 13 });
		const seat = makeSeat(live);
		seat.noteStart();
		expect(seat.relocate('Xome かん text')).toBeNull();
		expect(live.rangeEdits).toEqual([]);
	});
});
