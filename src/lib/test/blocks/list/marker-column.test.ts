// Miss-analysis: the source-mode row pinned a to-do's whole `- [ ] ` as the column, the padding a
// plain item beside it showed, and no row set a plain item beside a to-do where bytes show.
import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { markerColumn } from '#lib/components/blocks/list/marker-column.js';

const countsOf = (source: string) => parse(source).children[0].markerWidths!;

describe('markerColumn', () => {
	it('is as wide as the widest marker, in characters of the list’s font', () => {
		expect(markerColumn(countsOf('8. a\n9. b\n10. c\n'), false)).toBe('calc(4 * 1ch)');
		expect(markerColumn(countsOf('- a\n-   b\n'), true)).toBe('calc(4 * 1ch)');
	});

	it('counts a to-do’s list marker but not its `[ ] ` where the mode shows bytes', () => {
		expect(markerColumn(countsOf('- [ ] a\n- b\n'), false)).toBe('calc(2 * 1ch)');
		expect(markerColumn(countsOf('- [ ] a\n- [x]   b\n'), false)).toBe('calc(2 * 1ch)');
		expect(markerColumn(countsOf('9. a\n10. [ ] b\n'), false)).toBe('calc(4 * 1ch)');
	});

	it('reserves the drawn box where the mode draws it', () => {
		expect(markerColumn(countsOf('- [ ] a\n- b\n'), true)).toBe(
			'max(calc(2 * 1ch), var(--md-task-indent))'
		);
		expect(markerColumn(countsOf('9. a\n10. [ ] b\n'), true)).toBe(
			'max(calc(3 * 1ch), var(--md-task-indent))'
		);
	});

	it('is the drawn box alone for a list of only to-dos, whatever their openers', () => {
		for (const source of ['- [ ] a\n- [x] b\n', '9. [ ] a\n10. [ ] b\n', '- [ ]\tx\n']) {
			expect(markerColumn(countsOf(source), true), source).toBe(
				'max(calc(0 * 1ch), var(--md-task-indent))'
			);
		}
	});
});
