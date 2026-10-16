import { describe, it, expect } from 'vitest';
import { serialize } from '../core/serializer';
import { parse } from '../core/parser';

// ── Ambiguous cases: what a construct is not ────────────────────────────────

describe('construct-boundary edge cases', () => {
	it('--- after blank line is thematic break, not setext', () => {
		const doc = parse('Paragraph.\n\n---\n');
		expect(doc.children.length).toBe(2);
		expect(doc.children[0].kind).toBe('paragraph');
		expect(doc.children[1].kind).toBe('thematicBreak');
	});

	it('--- at document start is thematic break', () => {
		const doc = parse('---\n');
		expect(doc.children[0].kind).toBe('thematicBreak');
	});

	it('=== alone is not a setext heading (no preceding text)', () => {
		const doc = parse('===\n');
		expect(doc.children[0].kind).toBe('paragraph');
	});

	it('round-trips indented code at document start', () => {
		const source = '    code at start\n';
		const doc = parse(source);
		expect(serialize(doc)).toBe(source);
		expect(doc.children[0].kind).toBe('indentedCode');
	});

	it('delimiter row alone is not a table', () => {
		const doc = parse('| --- | --- |\n');
		expect(doc.children[0].kind).not.toBe('table');
	});

	it('link ref def at document start', () => {
		const doc = parse('[ref]: https://example.com\n');
		expect(doc.children[0].kind).toBe('linkReferenceDefinition');
	});

	it('footnote definition is not a link ref def', () => {
		const doc = parse('[^1]: Footnote content.\n');
		expect(doc.children[0].kind).not.toBe('linkReferenceDefinition');
	});
});
