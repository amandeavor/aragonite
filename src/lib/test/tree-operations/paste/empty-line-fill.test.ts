// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { serialize } from '#lib/core/serializer.js';
import { runPasteDispatch, makePasteCommit } from '#lib/test/harness/editor-actions.js';
import { describeConvergence } from '#lib/test/harness/parse-converged.js';

// Miss-analysis: no paste test filled one of two empty paragraphs with an unterminated block.

async function pasteOnFirstEmptyLine(source: string, markdown: string) {
	const h = makePasteCommit(parse(source).children);
	await runPasteDispatch(h, { pastedText: markdown, targetPath: [1], offset: 0 });
	return h.doc;
}

describe('blocks pasted onto an empty line between two paragraphs', () => {
	it.each([
		['a quote with no line ending', '> q', 'a\n\n> q\n\nb\n'],
		['a quote with a line ending', '> q\n', 'a\n\n> q\n\nb\n'],
		['two paragraphs', 'x\n\ny', 'a\n\nx\n\ny\n\nb\n']
	])('%s keeps one blank line before the next paragraph', async (_, markdown, after) => {
		const doc = await pasteOnFirstEmptyLine('a\n\n\nb\n', markdown);

		expect(serialize(doc)).toBe(after);
		expect(describeConvergence(doc)).toBeNull();
	});
});

describe('blocks pasted onto the first of two empty lines', () => {
	it.each([
		['a quote with no line ending', '> q', 'a\n\n> q\n\n\nb\n'],
		['a quote with a line ending', '> q\n', 'a\n\n> q\n\n\nb\n'],
		['two paragraphs', 'x\n\ny', 'a\n\nx\n\ny\n\n\nb\n']
	])('%s leaves the second empty line standing', async (_, markdown, after) => {
		const doc = await pasteOnFirstEmptyLine('a\n\n\n\nb\n', markdown);

		expect(serialize(doc)).toBe(after);
		expect(doc.children.map((c) => c.raw)).toContain('\n');
		expect(describeConvergence(doc)).toBeNull();
	});
});
