// @vitest-environment jsdom
// Where a typed byte goes at the shapes a hidden edge meets: childless constructs, shared and
// abutting runs. Pure over the inline tree; the block's placement is `typed-placement.test.ts`.
import { describe, expect, it } from 'vitest';
import { hiddenEdges } from '#lib/components/blocks/text/edge-seat.js';
import { parseInline } from '#lib/core/inline/index.js';
import { screenVisibility } from '#lib/core/inline/visibility.js';
import type { EdgeAffinity } from '#lib/caret/edge-affinity.js';
import { fixtureReading } from '#lib/test/harness/fixture-grammar.js';

/** Every case below is a block holding content, so its markers are hidden: the live reading. */
const LIVE = screenVisibility('live', { chromePaints: false });

const edgesOf = (source: string) =>
	hiddenEdges(parseInline(source, 0, source.length), source, LIVE, fixtureReading());

/** Where a byte typed at `offset` is written: `offset` itself where the edge rule moves nothing. */
function seatIn(source: string, offset: number, record: EdgeAffinity | null, typed = 'X') {
	return edgesOf(source).typingOffset(offset, record, typed);
}

// The table of what the edge rule answers is `edge-rule.test.ts`; these are the shapes around it.
describe('a caret away from every hidden run', () => {
	it('is no edge at all', () => {
		for (const offset of [0, 4, 9, 15])
			expect(seatIn('Some **bold** text', offset, null)).toBe(offset);
	});

	// `[](url)`: it draws nothing at all, so there is no content edge to resolve.
	it('nor is a pair emptied of content', () => {
		expect(seatIn('a [](http://e.com) b', 3, 'outside')).toBe(3);
	});
});

// An escape, a hard break and an angle autolink are all delimiters, and the caret does reach them
// past the leading run, so doing nothing would land the byte between delimiters.
describe('a childless construct is all delimiters', () => {
	// `x \* y`: the escape shows `*`, so its backslash is the leading run and offset 3 is that
	// run's end; never-extend puts the byte outside it.
	it('puts the caret at a byte against an escape outside the pair', () => {
		expect(seatIn('x \\* y', 3, null)).toBe(2);
		// Already outside it: there is nothing to move.
		expect(seatIn('x \\* y', 2, null)).toBe(2);
	});

	// `end  \nnext`: the two spaces are the run, and the break's `\n` is what shows.
	it('puts the caret at a byte against a hard break before its spaces', () => {
		expect(seatIn('end  \nnext', 4, null)).toBe(3);
	});

	// `\\` shows `\`, which also matches at the construct's own start, so the match must be the
	// last one, or a byte typed at offset 1 goes to the pair's end instead of its start.
	it('puts the caret at a byte at an escaped backslash before the pair, not past it', () => {
		expect(seatIn('\\\\x y', 1, null)).toBe(0);
	});

	// `<https://e.com>`: the URL is what shows, so the brackets are the two runs. A byte at
	// either one goes outside the construct, since the destination is not text to extend.
	it('puts the caret at a byte against an angle autolink outside its brackets', () => {
		expect(seatIn('<https://e.com> x', 1, 'outside')).toBe(0);
		expect(seatIn('<https://e.com> x', 14, 'outside')).toBe(15);
	});

	// ...and a byte inside the URL is ordinary editing: the destination is the text there.
	it('declines inside the painted URL', () => {
		expect(seatIn('<https://e.com> x', 6, 'outside')).toBe(6);
	});

	// An entity shows a character that is none of its bytes, so its whole span reads as visible
	// and neither end is a run. The dispatch's widget branch owns a caret there.
	it('declines at either end of an entity widget', () => {
		expect(seatIn('a&copy;b', 1, null)).toBe(1);
		expect(seatIn('a&copy;b', 7, 'outside')).toBe(7);
	});
});

// Every insertion route writes through this after the fact: the browser's insert, an IME commit
// and a paste are moved once, on the write that lands them.
describe('relocate', () => {
	const BOLD = 'Some **bold** text';
	const relocate = (at: number, typed: string, record: EdgeAffinity | null, source = BOLD) =>
		edgesOf(source).relocate(at, typed, record);

	it('moves a run inserted at the trailing content edge past the closing delimiter', () => {
		expect(relocate(11, 'かん', 'outside')).toEqual({
			text: 'Some **bold**かん text',
			caretAfter: 15,
			crossed: ['strong']
		});
	});

	it('leaves a run the caret position agrees with alone', () => {
		expect(relocate(11, 'かん', null)).toBeNull();
	});

	// The browser can put the run past the closer; the character before the caret is still bold.
	it('moves a run inserted past the closer back inside', () => {
		expect(relocate(13, 'かん', null)).toEqual({
			text: 'Some **boldかん** text',
			caretAfter: 13,
			crossed: ['strong']
		});
	});

	it('relocates a never-extend edge with no record', () => {
		expect(relocate(7, '感', null, 'A [link](http://e.com) tail')).toEqual({
			text: 'A [link](http://e.com)感 tail',
			caretAfter: 23,
			crossed: ['link']
		});
	});
});

// A run of three or more asterisks is shared by a nested pair, so a byte at its end can re-pair it.
// Miss-analysis: GH #116, the property suite's input regex excluded this class of run.
describe('a delimiter run shared between two pairings', () => {
	const SHARED = '***foo****foo*';

	it('declines with no record at the issue’s own draw', () => {
		expect(seatIn(SHARED, 6, null)).toBe(6);
	});

	// The boundary between the two runs is outside both constructs, and the reading keeps it.
	it('takes the boundary between the runs at a fresh start', () => {
		expect(seatIn(SHARED, 6, 'outside')).toBe(9);
	});

	// Checking beats refusing outright: the run's other end keeps the pairing, and is still taken.
	it('still puts the caret where a reading keeps the pairing', () => {
		expect(seatIn(SHARED, 8, null)).toBe(6);
		expect(seatIn(SHARED, 13, 'outside')).toBe(14);
	});
});

// Miss-analysis: GH #228, no run in this table enclosed a bare autolink.
describe('a run enclosing a bare autolink', () => {
	// GFM's bare-autolink scanner takes a trailing `*` into the URL, so a byte outside the closer
	// strands the opener. Inside it the URL absorbs the byte and both delimiters stay hidden.
	it('puts the caret inside the closing delimiter, with or without a record', () => {
		for (const record of ['outside', null] as const) {
			expect(seatIn('*www.example.com*', 17, record), `${record}`).toBe(16);
		}
	});
});

// Miss-analysis: GH #229, escape fixtures stood beside plain text, never another construct's run.
describe('abutting marker runs are one screen position', () => {
	// `_foo_\*x`: the emphasis closer [4,5) and the escape's backslash [5,6) abut, so 4, 5 and 6
	// are one screen position. 5 kills the underscore pair, 6 kills the escape, 4 keeps both.
	it('reaches a neighbour’s run when the construct’s own outside edge is poisoned', () => {
		for (const record of ['outside', null] as const) {
			expect(seatIn('_foo_\\*x', 6, record), `${record}`).toBe(4);
		}
	});
});

// Miss-analysis: the caret's own offset always passed first, so no case reached the second one.
describe('a never-extend construct admits no interior caret position', () => {
	// `_foo_` spoils the byte before each construct (an intraword `_` cannot close), the only way
	// past the first candidate. Offset 4 is inside the emphasis, outside the never-extend kind.
	it.each([['_foo_[link](url)'], ['_foo_<https://e.com>'], ['_foo_![alt](u)']])(
		'seats outside the construct in %s, never between its delimiters',
		(source) => {
			for (const record of ['outside', null] as const) {
				expect(seatIn(source, 5, record), `${record}`).toBe(4);
			}
		}
	);
});
