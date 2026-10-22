import { describe, it, expect } from 'vitest';
import { escapeMarkdownLiteral } from '#lib/tree-operations/paste/markdown-literal.js';
import { parse } from '#lib/core/parser.js';

describe('escapeMarkdownLiteral', () => {
	it('escapes inline syntax and the line-start openers a paragraph would read', () => {
		expect(escapeMarkdownLiteral('**a**\n# b\n1. c')).toBe('\\*\\*a\\*\\*\n\\# b\n1\\. c');
	});

	it('leaves an opener character alone away from a line start', () => {
		expect(escapeMarkdownLiteral('a # b - c')).toBe('a # b - c');
	});

	it('pasted escaped, the text reads back as one paragraph of plain text', () => {
		const doc = parse(`${escapeMarkdownLiteral('> *a* | `b`\n- c')}\n`);
		expect(doc.children.map((c) => c.kind)).toEqual(['paragraph']);
	});
});
