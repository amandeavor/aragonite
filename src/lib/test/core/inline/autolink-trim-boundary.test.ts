import { describe, it, expect } from 'vitest';
import { parseInline } from '#lib';

/** The bytes the first bare autolink in `raw` covers, or null when none forms. */
function linked(raw: string): string | null {
	const link = parseInline(raw, 0, raw.length).find((node) => node.kind === 'autolink');
	return link ? raw.slice(link.start, link.end) : null;
}

describe('a bare url drops trailing punctuation (GFM §6.9)', () => {
	it.each(['.', ',', '!', '?', ':', '*', '_', '~'])('a trailing %j', (punct) => {
		expect(linked(`https://example.com${punct}`)).toBe('https://example.com');
	});

	it('several trailing punctuation characters in sequence', () => {
		expect(linked('https://example.com.,!')).toBe('https://example.com');
	});

	it('keeps a closing paren an earlier opening paren matches', () => {
		expect(linked('https://example.com/foo(bar)')).toBe('https://example.com/foo(bar)');
	});

	it('drops a closing paren nothing opened', () => {
		expect(linked('https://example.com)')).toBe('https://example.com');
	});

	it('counts only the parens inside the url', () => {
		expect(linked('(see https://example.com/(a))')).toBe('https://example.com/(a)');
	});

	it('keeps a trailing semicolon that does not close an entity-shaped tail', () => {
		expect(linked('https://example.com;')).toBe('https://example.com;');
		expect(linked('https://example.com/?a=&;')).toBe('https://example.com/?a=&;');
	});

	it.each(['&hl;', '&bogus08;'])('drops an entity-shaped tail %j back through its `&`', (tail) => {
		expect(linked(`https://example.com/?q=${tail}`)).toBe('https://example.com/?q=');
	});

	it('keeps a url with nothing to trim whole', () => {
		expect(linked('https://example.com/foo')).toBe('https://example.com/foo');
	});
});

describe('a bare url starts only at a boundary (GFM §6.9)', () => {
	it.each([
		['the start of the range', 'https://x.com'],
		['whitespace', 'see https://x.com'],
		['an open paren', '(https://x.com)'],
		['a `*`', '*https://x.com'],
		['a `_`', '_https://x.com'],
		['a `~`', '~https://x.com']
	])('after %s', (_name, raw) => {
		expect(linked(raw)).toBe('https://x.com');
	});

	it.each([
		['a letter', 'xhttps://x.com'],
		['other punctuation', 'a/https://x.com']
	])('not after %s', (_name, raw) => {
		expect(linked(raw)).toBeNull();
	});
});
