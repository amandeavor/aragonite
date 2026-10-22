// A write that took the opener leaves the closer, which reads on as a reload reads it.
// Miss-analysis: GH #58; every truncation test kept the opener, so none left a closer behind.
// Miss-analysis (GH #768): these rows pinned the closer's drop, a line the write never touched.
import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { fencedCodeWrite } from '#lib/schema/fenced-code-raw.js';
import type { CstNode } from '#lib/core/nodes.js';

/** The document line ending a write runs under, LF or CRLF. */
const LF_WRITE = { lineEnding: '\n' } as const;
const CRLF_WRITE = { lineEnding: '\r\n' } as const;

/** The fence rule as a byte write from outside the block's own editing applies it. */
const literalWrite = (raw: string, node: CstNode, write: typeof LF_WRITE | typeof CRLF_WRITE) =>
	fencedCodeWrite.normalize(raw, { node, mode: 'literal', lineEnding: write.lineEnding });

const codeNode = (source: string): CstNode => parse(source).children[0];

/** What the bytes reparse to with a block below them. */
const reloadWithSibling = (raw: string): string[] =>
	parse(`${raw}\n# Heading\n`).children.map((c) => c.kind);

describe('the fence rule as a literal write: the stranded closer', () => {
	const closed = codeNode('```js\nbody\n```\n');

	// One input shape per branch from one fixture, so a rule that stops telling them apart fails
	// here rather than at whichever caller noticed first.
	it.each([
		['the closer, leaving the opener', '```js\nbo\n', '```js\nbo\n```\n'],
		['the opener, leaving the closer', 'dy\n```\n', 'dy\n```\n'],
		['both fence lines', 'dy\nmore\n', 'dy\nmore\n']
	])('a write that took %s', (_shape, slice, expected) => {
		expect(literalWrite(slice, closed, LF_WRITE)).toBe(expected);
	});

	it('leaves the stranded closer to open a fence over the block below', () => {
		expect(reloadWithSibling(literalWrite('dy\n```\n', closed, LF_WRITE))).toEqual([
			'paragraph',
			'fencedCode'
		]);
	});

	it.each([
		['past a foreign-marker open line above', closed, '~~~\nbody\n```\n', LF_WRITE],
		['on CRLF endings', codeNode('```js\r\nbody\r\n```\r\n'), 'dy\r\n```\r\n', CRLF_WRITE],
		['under a fence the metadata never closed', codeNode('```js\nbody\n'), 'dy\n```\n', LF_WRITE]
	])('keeps the stranded closer %s', (_label, node, slice, write) => {
		expect(literalWrite(slice, node, write)).toBe(slice);
	});

	// The line reads both as this fence's closer and as a bare opener; read as the opener, it gets
	// its closer back, so nothing below is swallowed and nothing is lost.
	it('closes a lone bare run again', () => {
		const bare = codeNode('```\nbody\n```\n');
		expect(literalWrite('```\n', bare, LF_WRITE)).toBe('```\n```\n');
	});

	it('leaves a run an opener above it claims', () => {
		expect(literalWrite('x\n```js\nbody\n```\n', closed, LF_WRITE)).toBe('x\n```js\nbody\n```\n');
		expect(reloadWithSibling('x\n```js\nbody\n```\n')).toEqual([
			'paragraph',
			'fencedCode',
			'heading'
		]);
	});
});
