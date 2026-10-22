// A content write that leaves a setext title's last line blank keeps the underline, whichever
// gesture computed the bytes: the text read from the screen, a cut, or a paste over the title.
// Miss-analysis: every erase test typed the title away, never cut or pasted over it.
// Miss-analysis (GH #768): these rows pinned the underline's drop, a line the write never touched.
import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser';
import { serialize } from '../../core/serializer';
import { updateNodeContent } from '../../tree-operations';
import { describeConvergence } from '../harness/parse-converged';
import { defaultGrammarView } from '#lib/schema/block-openers.js';
import { documentLineEnding } from '#lib/core/lines.js';
import { createSharingState } from '#lib/tree-operations/sharing.js';

describe('a content write that empties a setext title', () => {
	it.each([
		['a cut of the whole title', 'Plan\n---\n\nnext\n', '\n---\n', 'thematicBreak'],
		['a cut under a === underline', 'Plan\n===\n\nnext\n', '\n===\n', 'paragraph'],
		['a space pasted over the title', 'Plan\n---\n\nnext\n', ' \n---\n', 'thematicBreak'],
		['CRLF endings', 'Plan\r\n===\r\n\r\nnext\r\n', '\r\n===\r\n', 'paragraph'],
		['the last line of a two-line title', 'Plan\nmore\n---\n', 'Plan\n\n---\n', 'thematicBreak']
	])('%s keeps the underline, read as a reload reads it', (_label, source, written, underline) => {
		const doc = parse(source);
		const rest = source.slice(doc.children[0].raw.length);

		updateNodeContent(doc, 0, written, defaultGrammarView, createSharingState());

		expect(serialize(doc)).toBe(written + rest);
		expect(doc.children.map((c) => c.kind)).toContain(underline);
		expect(describeConvergence(doc)).toBeNull();
	});

	it('inside a quote, keeps the underline', () => {
		const doc = parse('> Plan\n> ---\n');
		const quote = doc.children[0];

		updateNodeContent(
			{
				children: quote.children!,
				owner: quote,
				lineEnding: documentLineEnding(doc)
			},
			0,
			'\n---\n',
			defaultGrammarView,
			createSharingState()
		);

		expect(quote.children!.map((c) => c.leadingTrivia + c.raw).join('')).toBe('\n---\n');
		expect(quote.children!.map((c) => c.kind)).toEqual(['paragraph', 'thematicBreak']);
	});

	it.each([
		['a title with text left', 'Plan\n---\n', 'Pl\n---\n'],
		['a title left as a no-break space, which Markdown reads as text', 'Plan\n===\n', ' \n===\n']
	])('keeps the underline under %s', (_label, source, written) => {
		const doc = parse(source);

		updateNodeContent(doc, 0, written, defaultGrammarView, createSharingState());

		expect(serialize(doc)).toBe(written);
		expect(doc.children.map((c) => c.kind)).toEqual(['setextHeading']);
	});
});
