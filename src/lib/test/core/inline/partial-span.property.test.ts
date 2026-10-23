// A scan range inside a longer string parses as that range on its own would, moved by its start.
// Miss-analysis: the conformance ratchet only ever parses a whole input, so a construct that read
// a closer past the range end, or a lookback before its start, passed it.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseInline, type InlineNode } from '#lib';
import { arbInlineSource } from '../../invariants/arbitraries/inline';
import { freshOrFixedSeed } from '../../invariants/arbitraries/property-seed';

const PARAMS = { numRuns: 1000, seed: freshOrFixedSeed(20261023) } as const;

// Bytes that would close or extend a construct opened inside the range, were they in reach.
const closerTail = fc.constantFrom(
	'*',
	'**',
	'_',
	'~~',
	'`',
	'``',
	'](u)',
	')',
	'>',
	'a -->',
	'?>',
	']]>',
	'x;',
	'.com'
);

const outside = fc.oneof(arbInlineSource, closerTail, fc.constant(''));

// One whitespace byte on each side keeps the range's edges reading as they do at a string's ends.
const edge = fc.constantFrom(' ', '\n', '\t');

const resolver = (label: string) =>
	['ref', 'collapsed', 'shortcut'].includes(label.toLowerCase()) ? { url: '/r' } : undefined;

function shifted(nodes: InlineNode[], by: number): InlineNode[] {
	return nodes.map((node) => ({
		...node,
		start: node.start + by,
		end: node.end + by,
		...(node.children ? { children: shifted(node.children, by) } : {})
	}));
}

describe('a scan range inside a longer string', () => {
	it.each([
		['a code span closing past the end', '', 'a `b ', '` c'],
		['emphasis closing past the end', '', '*a ', '* b'],
		['a link tail past the end', '', '[a]', '(u)'],
		['an html comment closing past the end', '', '<!-- a --', '>'],
		['a hard break whose spaces sit before the start', 'a  ', '\nb', ''],
		['an email local part before the start', 'name', '@host.com', '']
	])('%s stays unread', (_name, before, inside, after) => {
		const raw = before + inside + after;
		const start = before.length;
		const end = start + inside.length;
		expect(parseInline(raw, start, end)).toEqual(
			shifted(parseInline(inside, 0, inside.length), start)
		);
	});

	it('parses as the range alone, with or without a resolver', () => {
		fc.assert(
			fc.property(
				outside,
				edge,
				arbInlineSource,
				edge,
				outside,
				fc.boolean(),
				(before, open, inside, close, after, withResolver) => {
					const raw = before + open + inside + close + after;
					const start = before.length + open.length;
					const end = start + inside.length;
					const refs = withResolver ? resolver : undefined;
					expect(parseInline(raw, start, end, refs)).toEqual(
						shifted(parseInline(inside, 0, inside.length, refs), start)
					);
				}
			),
			PARAMS
		);
	});
});
