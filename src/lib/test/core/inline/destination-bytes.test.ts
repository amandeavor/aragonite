// Miss-analysis: the writer's tests compared exact strings and never read the bytes back.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encodeDestination, escapeTitle } from '#lib/core/inline/destination-bytes.js';
import { readDestination, readTitle, titleValue } from '#lib/core/inline/scan/link-grammar.js';
import { unescape } from '#lib/core/inline/scan/entities.js';
import { encodeUrl } from '#lib/core/inline/scan/url.js';
import { parseInline } from '#lib/core/inline/index.js';
import { freshOrFixedSeed } from '../../invariants/arbitraries';

const PARAMS = { numRuns: 1000, seed: freshOrFixedSeed(617617) } as const;

// Source bytes heavy on what the grammar treats specially: escapes, entities, quotes, parens.
const arbSource = fc
	.array(
		fc.constantFrom(
			'&',
			'&amp;',
			'&copy;',
			'&#35;',
			'&#x41;',
			'\\',
			'\\&',
			'"',
			"'",
			'(',
			')',
			'<',
			'>',
			';',
			'#',
			'%',
			'%20',
			' ',
			'a',
			'é',
			'copy'
		),
		{ maxLength: 12 }
	)
	.map((parts) => parts.join(''));

function titleReadBack(value: string): string | undefined {
	const bytes = `"${escapeTitle(value)}"`;
	const end = readTitle(bytes, 0, bytes.length);
	return end > 0 ? titleValue(bytes, 0, end) : undefined;
}

function destinationReadBack(value: string): string | undefined {
	// The `)` an inline link closes on, which lets an empty destination read.
	const bytes = encodeDestination(value) + ')';
	return readDestination(bytes, 0, bytes.length)?.url;
}

describe('the destination and title writers read back through the link grammar', () => {
	it('a title value survives a write and a read', () => {
		fc.assert(
			fc.property(arbSource.map(unescape), (value) => titleReadBack(value) === value),
			PARAMS
		);
	});

	it('a destination value survives a write and a read', () => {
		fc.assert(
			fc.property(
				arbSource.map((text) => encodeUrl(unescape(text))),
				(value) => destinationReadBack(value) === value
			),
			PARAMS
		);
	});

	// A url typed into the link card reads back percent-encoded, as `readDestination` returns it.
	it('any destination text reads back as the reader would encode it', () => {
		fc.assert(
			fc.property(arbSource, (text) => destinationReadBack(text) === encodeUrl(text)),
			PARAMS
		);
	});

	it('balanced parentheses stay as written, and unbalanced ones are escaped', () => {
		expect(encodeDestination('/wiki/Foo_(bar)')).toBe('/wiki/Foo_(bar)');
		expect(encodeDestination('a)b(c')).toBe('a\\)b\\(c');
		expect(encodeDestination('a(b')).toBe('a\\(b');
	});

	it('a title holding entity text keeps it as text', () => {
		expect(titleReadBack('&copy;')).toBe('&copy;');
		expect(titleReadBack('a &amp; b')).toBe('a &amp; b');
	});

	it('a destination holding entity text keeps it as text', () => {
		expect(destinationReadBack('/a?b&copy;')).toBe('/a?b&copy;');
	});

	it('a bare ampersand is written as it is', () => {
		expect(escapeTitle('A & B')).toBe('A & B');
		expect(encodeDestination('/a?b=1&c=2')).toBe('/a?b=1&c=2');
	});

	it('a whole link written from a title read off `&amp;copy;` renders that title', () => {
		const title = parseInline('[x](/u "&amp;copy;")', 0, 20)[0].title!;
		const rewritten = `[x](/u "${escapeTitle(title)}")`;
		expect(parseInline(rewritten, 0, rewritten.length)[0].title).toBe('&copy;');
	});
});
