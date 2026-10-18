// Miss-analysis: every input read-back test ran in Chromium, which edits `\r\n` as one character.
import { describe, it, expect } from 'vitest';
import {
	keepLineEndingPairs,
	lineEndingCounts,
	lineEndingPairBeside
} from '../../core/line-ending-pairs';

const LINE = 'abc\r\nAfter';

describe('keepLineEndingPairs: a native edit never splits a CRLF pair', () => {
	const rows: { name: string; after: string; caret: number; text: string; caretAfter: number }[] = [
		{
			name: 'a letter typed between the two halves goes before the pair',
			after: 'abc\rZ\nAfter',
			caret: 5,
			text: 'abcZ\r\nAfter',
			caretAfter: 4
		},
		{
			name: 'a run typed between the halves keeps its order before the pair',
			after: 'abc\rxyz\nAfter',
			caret: 7,
			text: 'abcxyz\r\nAfter',
			caretAfter: 6
		},
		{
			name: 'Backspace after the pair, which took only the `\\n`, takes the pair',
			after: 'abc\rAfter',
			caret: 4,
			text: 'abcAfter',
			caretAfter: 3
		},
		{
			name: 'Delete before the pair, which took only the `\\r`, takes the pair',
			after: 'abc\nAfter',
			caret: 3,
			text: 'abcAfter',
			caretAfter: 3
		},
		{
			name: 'typing over a range ending between the halves keeps the pair',
			after: 'Z\nAfter',
			caret: 1,
			text: 'Z\r\nAfter',
			caretAfter: 1
		},
		{
			name: 'typing over a range starting between the halves takes the pair',
			after: 'abc\rZ',
			caret: 5,
			text: 'abcZ',
			caretAfter: 4
		},
		{
			name: 'deleting a range ending between the halves keeps the pair',
			after: '\nAfter',
			caret: 0,
			text: '\r\nAfter',
			caretAfter: 0
		}
	];
	for (const row of rows) {
		it(row.name, () => {
			expect(keepLineEndingPairs(LINE, row.after, row.caret)).toEqual({
				text: row.text,
				caret: row.caretAfter
			});
		});
	}

	// Each of these reads as an edit beside the pair as well as inside it, so nothing is split.
	const sameBytes: { name: string; after: string }[] = [
		{ name: 'a `\\n` typed beside the pair', after: 'abc\r\n\nAfter' },
		{ name: 'a `\\r` typed beside the pair', after: 'abc\r\r\nAfter' },
		{ name: 'text repeating the bytes around the pair', after: 'abc\r\nx\r\nAfter' },
		{ name: 'a letter typed at the line end', after: 'abcZ\r\nAfter' },
		{ name: 'the whole pair deleted', after: 'abcAfter' }
	];
	for (const row of sameBytes) {
		it(`${row.name} is kept as read`, () => {
			expect(keepLineEndingPairs(LINE, row.after, 4)).toEqual({ text: row.after, caret: 4 });
		});
	}

	it('LF text and an unchanged read pass through', () => {
		expect(keepLineEndingPairs('abc\nAfter', 'abc\nZAfter', 5)).toEqual({
			text: 'abc\nZAfter',
			caret: 5
		});
		expect(keepLineEndingPairs(LINE, LINE, 4)).toEqual({ text: LINE, caret: 4 });
	});

	it('a lone `\\r` the document already held stays where it is', () => {
		expect(keepLineEndingPairs('a\rb\r\nc', 'a\rxb\r\nc', 3)).toEqual({
			text: 'a\rxb\r\nc',
			caret: 3
		});
	});
});

describe('lineEndingCounts', () => {
	it('counts pairs, lone `\\r` and lone `\\n` apart', () => {
		expect(lineEndingCounts('a\r\nb\rc\n\r\n\r')).toEqual({ pairs: 2, loneCr: 2, loneLf: 1 });
	});
});

describe('lineEndingPairBeside', () => {
	it('names the pair on the side the key moves toward, and nothing else', () => {
		// `abc\r\nAfter`: the pair at [3, 5).
		expect(lineEndingPairBeside(LINE, 3, 'forward')).toEqual({ start: 3, end: 5 });
		expect(lineEndingPairBeside(LINE, 5, 'backward')).toEqual({ start: 3, end: 5 });
		expect(lineEndingPairBeside(LINE, 5, 'forward')).toBeNull();
		expect(lineEndingPairBeside(LINE, 3, 'backward')).toBeNull();
		expect(lineEndingPairBeside('abc\nAfter', 3, 'forward')).toBeNull();
		expect(lineEndingPairBeside('\r\n', 0, 'forward')).toEqual({ start: 0, end: 2 });
		expect(lineEndingPairBeside('\r\n', 0, 'backward')).toBeNull();
	});
});
