// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { serialize } from '#lib/core/serializer.js';
import type { PresentationMode } from '#lib/presentation-mode.js';
import { fixtureReading } from '../harness/fixture-grammar';
import { deleteRange } from '../harness/range-delete';

// `rangeDelete`'s live-mode join cleanup, which every cross-block delete, cut, type-over and paste
// goes through; each pair below differs only in mode.

function deletedBytes(
	source: string,
	start: { path: number[]; offset: number },
	end: { path: number[]; offset: number },
	mode: PresentationMode | undefined
): string {
	const doc = parse(source);
	deleteRange(doc, start, end, { reading: fixtureReading({}, mode) });
	return serialize(doc);
}

const at = (block: number, offset: number) => ({ path: [block], offset });

describe('a selection running out of one construct and into another', () => {
	// The live-mode.md § 4.5 case: each half keeps its format, the bold closed and the italic
	// reopened where the cut meets them.
	it('bold to italic keeps both formats and leaves no delimiter on screen', () => {
		expect(deletedBytes('**bold** and *italic*\n', at(0, 4), at(0, 16), 'live')).toBe(
			'**bo***alic*\n'
		);
	});

	it('the same selection in source mode stays byte-literal', () => {
		expect(deletedBytes('**bold** and *italic*\n', at(0, 4), at(0, 16), 'source')).toBe(
			'**boalic*\n'
		);
	});

	it('a caller with no mode gets the byte-literal cut', () => {
		expect(deletedBytes('**bold** and *italic*\n', at(0, 4), at(0, 16), undefined)).toBe(
			'**boalic*\n'
		);
	});

	it('cross-block, the joined bytes close one run and reopen the other', () => {
		expect(deletedBytes('a **bold** b\n\nc *ital* d\n', at(0, 5), at(1, 5), 'live')).toBe(
			'a **b***al* d\n'
		);
	});

	// The same construct on both sides survives the cut: its opener and closer meet across the
	// join, so the literal join already says what the user saw and nothing is dropped.
	it('cutting inside one construct keeps it whole', () => {
		expect(deletedBytes('**bold**\n', at(0, 3), at(0, 5), 'live')).toBe('**bd**\n');
	});
});

describe('a selection that closes a construct against the one below it', () => {
	// The delete's own inverse of the split: what is left of the two blocks meets closer to opener.
	it('the pair enclosing nothing at the join goes', () => {
		expect(deletedBytes('Some **bo**\n\nX**ld** text\n', at(0, 11), at(1, 1), 'live')).toBe(
			'Some **bold** text\n'
		);
	});

	it('the same delete in source mode keeps the residue', () => {
		expect(deletedBytes('Some **bo**\n\nX**ld** text\n', at(0, 11), at(1, 1), 'source')).toBe(
			'Some **bo****ld** text\n'
		);
	});
});

describe('joins the cleanup has no business touching', () => {
	it('leaves an ordinary paragraph merge alone', () => {
		expect(deletedBytes('hello world\n\nfoo bar\n', at(0, 6), at(1, 4), 'live')).toBe(
			'hello bar\n'
		);
	});
});
