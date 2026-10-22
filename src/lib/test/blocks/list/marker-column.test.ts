import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { markerColumn } from '#lib/components/blocks/list/marker-column.js';

const countsOf = (source: string) => parse(source).children[0].markerWidths!;

describe('markerColumn', () => {
	it('is as wide as the widest marker, in characters of the list’s font', () => {
		expect(markerColumn(countsOf('8. a\n9. b\n10. c\n'), false)).toBe('calc(4 * 1ch)');
		expect(markerColumn(countsOf('- a\n-   b\n'), true)).toBe('calc(4 * 1ch)');
	});

	it('counts a to-do’s bytes where the mode shows them', () => {
		expect(markerColumn(countsOf('- [ ] a\n- b\n'), false)).toBe('calc(6 * 1ch)');
	});

	it('reserves the drawn box where the mode draws it', () => {
		expect(markerColumn(countsOf('- [ ] a\n- b\n'), true)).toBe(
			'max(calc(2 * 1ch), var(--md-task-indent))'
		);
	});
});
