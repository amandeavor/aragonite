import { describe, it, expect } from 'vitest';
import { parseInline } from '#lib';

describe('raw HTML (CommonMark §6.6), each form read from its `<`', () => {
	/** The length of the raw HTML node starting at `pos`, or null when none starts there. */
	function match(raw: string, pos = 0, end = raw.length): number | null {
		const node = parseInline(raw, pos, end)[0];
		return node?.kind === 'rawHtml' ? node.end - node.start : null;
	}

	describe('open tag', () => {
		it('matches <span>', () => {
			expect(match('<span>')).toBe(6);
		});
		it('matches with attributes', () => {
			expect(match('<span class="x">')).toBe(16);
		});
		it('matches with unquoted attribute', () => {
			expect(match('<span class=x>')).toBe(14);
		});
		it('matches self-closing', () => {
			expect(match('<br/>')).toBe(5);
		});
		it('matches self-closing with space', () => {
			expect(match('<br />')).toBe(6);
		});
		it('matches hyphenated tag name', () => {
			expect(match('<custom-element>')).toBe(16);
		});
		it('matches an attribute on the next line', () => {
			expect(match('<span\nclass="y">')).toBe(16);
		});
		it('rejects an unterminated open tag', () => {
			expect(match('<span no end')).toBeNull();
		});
	});

	describe('close tag', () => {
		it('matches </span>', () => {
			expect(match('</span>')).toBe(7);
		});
		it('matches with whitespace before >', () => {
			expect(match('</span >')).toBe(8);
		});
	});

	describe('comment', () => {
		it('matches inline comment', () => {
			expect(match('<!-- hi -->')).toBe(11);
		});
		it('matches multi-line comment via lookahead', () => {
			const raw = '<!--\nfoo\n-->';
			expect(match(raw)).toBe(raw.length);
		});
		it('rejects unterminated comment', () => {
			expect(match('<!-- no end')).toBeNull();
		});
	});

	describe('processing instruction', () => {
		it('matches <?xml?>', () => {
			expect(match('<?xml?>')).toBe(7);
		});
		it('rejects unterminated PI', () => {
			expect(match('<?xml')).toBeNull();
		});
	});

	describe('declaration', () => {
		it('matches <!DOCTYPE html>', () => {
			expect(match('<!DOCTYPE html>')).toBe(15);
		});
		it('requires ASCII letter after <!', () => {
			expect(match('<!1>')).toBeNull();
		});
	});

	describe('CDATA', () => {
		it('matches <![CDATA[ x ]]>', () => {
			expect(match('<![CDATA[ x ]]>')).toBe(15);
		});
		it('is case-sensitive', () => {
			expect(match('<![cdata[ x ]]>')).toBeNull();
		});
	});

	describe('non-matches', () => {
		it('returns null for plain text', () => {
			expect(match('hello')).toBeNull();
		});
		it('returns null when pos does not point at <', () => {
			expect(match('x<span>', 0)).toBeNull();
		});
		it('returns null for lone <', () => {
			expect(match('<')).toBeNull();
		});
	});

	describe('positional', () => {
		it('matches at non-zero pos', () => {
			const raw = 'hello <span> world';
			expect(match(raw, 6)).toBe(6);
		});
		it('respects end bound for multi-char close lookahead', () => {
			// Comment open present but close --> would be past `end`
			const raw = '<!-- not closed -->';
			expect(match(raw, 0, 8)).toBeNull();
		});
	});
});
