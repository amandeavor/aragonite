// Readings settled by ruling where the inline parse once differed: CommonMark wins for empty
// comments, blank labels, case folding and chained labels; GFM wins for where a bare url ends.
// Miss-analysis: the commonmark.js comparison has no GFM urls and few labels past ASCII, and no
// unit row held these cases.
import { describe, expect, it } from 'vitest';
import { parseInline, type InlineNode } from '#lib';
import { parse } from '#lib/core/parser.js';
import { definitionsOf } from '#lib/core/inline/scan/definitions.js';
import { joinedText, normalizeLabel } from './scan/scan-test-helpers';

type Resolve = (label: string) => { url: string } | undefined;

const read = (raw: string, resolve?: Resolve) =>
	joinedText(parseInline(raw, 0, raw.length, resolve));

const kinds = (nodes: InlineNode[]) => nodes.map((node) => node.kind);

/** A resolver knowing `labels`, each pointing at `/` plus its label. */
const knowing =
	(...labels: string[]): Resolve =>
	(label) =>
		labels.some((known) => normalizeLabel(known) === normalizeLabel(label))
			? { url: '/' + normalizeLabel(label) }
			: undefined;

/** The resolver the editor builds from a document's own definitions. */
const definedIn = (markdown: string): Resolve => definitionsOf(parse(markdown).children).resolve;

describe('an HTML comment may be empty (CommonMark 0.31.2 §6.6)', () => {
	it.each([
		['<!-->', 'foo <!--> foo -->', 9],
		['<!--->', 'foo <!---> foo -->', 10]
	])('%s ends the comment', (_name, raw, end) => {
		expect(read(raw)).toEqual([
			{ kind: 'text', start: 0, end: 4, text: 'foo ' },
			{ kind: 'rawHtml', start: 4, end },
			{ kind: 'text', start: end, end: raw.length, text: raw.slice(end) }
		]);
	});
});

describe('a label needs a character that is not whitespace (CommonMark §6.3)', () => {
	it.each([
		['with the text defined', knowing('a')],
		['with nothing defined', knowing()]
	])('`[a][ ]` is text, %s', (_name, resolve) => {
		expect(kinds(read('[a][ ]', resolve))).toEqual(['text']);
	});
});

describe('labels match by Unicode case folding (CommonMark §4.7)', () => {
	it('resolves `[ẞ]` through a definition of `[SS]`', () => {
		expect(read('[ẞ]', definedIn('[SS]: /url\n'))).toMatchObject([
			{ kind: 'link', url: '/url', label: 'ss' }
		]);
	});
});

describe('labels resolve as CommonMark does before any becomes an unresolved reference', () => {
	it('`[foo][bar][baz]` with only baz defined links bar, as commonmark.js does', () => {
		expect(read('[foo][bar][baz]', knowing('baz'))).toEqual([
			{ kind: 'text', start: 0, end: 5, text: '[foo]' },
			{
				kind: 'link',
				start: 5,
				end: 15,
				children: [{ kind: 'text', start: 6, end: 9, text: 'bar' }],
				url: '/baz',
				label: 'baz'
			}
		]);
	});

	it('takes reference shapes left to right in literal text', () => {
		expect(read('[a][b][c]', knowing('a'))).toEqual([
			{ kind: 'unresolvedReference', start: 0, end: 6, label: 'b', refKind: 'link' },
			{ kind: 'text', start: 6, end: 9, text: '[c]' }
		]);
	});
});

describe('a bare url runs past a bracket that opens no link (GFM §6.9)', () => {
	it.each([
		['https://example.com/search?tags[]=a', 35],
		['http://a.co[x]', 14],
		['https://en.wikipedia.org/wiki/Foo_[bar]', 39]
	])('%s links whole', (raw, end) => {
		expect(read(raw)).toMatchObject([{ kind: 'autolink', start: 0, end }]);
	});

	it.each([
		['an inline link', 'www.a.co/[x](y)', undefined],
		['a reference link', 'www.a.co/[x]', knowing('x')]
	])('the url ends where %s opens', (_name, raw, resolve) => {
		expect(kinds(read(raw, resolve))).toEqual(['autolink', 'link']);
		expect(read(raw, resolve)[0]).toMatchObject({ start: 0, end: 9 });
	});

	// A label holding a bracket or a code span is decided by the bracket reading, not looked ahead.
	it.each([
		['a bracket', 'www.a.co/[a [b] c](u)'],
		['a code span', 'www.a.co/[a`]`](u)']
	])('a link whose text holds %s is never taken into the url', (_name, raw) => {
		expect(kinds(read(raw))).toEqual(['autolink', 'link']);
		expect(read(raw)[0]).toMatchObject({ start: 0, end: 9 });
	});
});

describe('a scheme url needs a host (GFM §6.9)', () => {
	it.each(['http://"quoted"', 'type https://… here', 'http://|x', 'see https://) now'])(
		'%j holds no autolink',
		(raw) => {
			expect(kinds(read(raw))).toEqual(['text']);
		}
	);

	it('a host needs no period', () => {
		expect(read('see http://localhost now')[1]).toMatchObject({
			kind: 'autolink',
			start: 4,
			end: 20
		});
	});
});
