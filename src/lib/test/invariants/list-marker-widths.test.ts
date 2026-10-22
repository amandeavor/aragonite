// G1.118: a list whose marker-width counts are absent or differ from a recount of its items fails
// the check, at any depth inside the block it's handed.
// Miss-analysis: the counts were new; this row and the column's count rows came with them.
import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { markerWidthCounts } from '#lib/core/parsers/list.js';
import { checkListMarkerWidths } from '#lib/invariants/list-marker-widths.js';

describe('G1.118 checkListMarkerWidths', () => {
	it('passes a list as the parse leaves it, nested lists included', () => {
		const quote = parse('> 1. a\n>    - b\n> 10. c\n').children[0];

		expect(checkListMarkerWidths(quote)).toBeNull();
	});

	it('fails a list whose counts miss an item', () => {
		const list = parse('- a\n- b\n').children[0];
		list.markerWidths = markerWidthCounts(list.children!.slice(1));

		expect(checkListMarkerWidths(list)?.message).toBe(
			"a list's marker widths are [0,0,0,0,1], its items count [0,0,0,0,2]"
		);
	});

	it('fails a list inside a quote that no parse or rebuild counted', () => {
		const quote = parse('> - a\n').children[0];
		quote.children![0].markerWidths = undefined;

		expect(checkListMarkerWidths(quote)?.message).toMatch(/marker widths are absent/);
	});
});
