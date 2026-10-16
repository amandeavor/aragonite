// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { registerBlockListState } from '#lib/block-lists/state-registry.js';
import { parse } from '#lib/core/parser.js';
import { serialize } from '#lib/core/serializer.js';
import {
	makeBlockListState,
	runPasteDispatch,
	makePasteCommit
} from '#lib/test/harness/editor-actions.js';
import type { BlockListState } from '#lib/block-lists/block-list-state.svelte.js';

// An inline paste at a heading's start demotes it into the block above; the caret follows its byte.
// Miss-analysis: the caret was pinned only at the content-write primitive, never at this caller.

describe('inline paste landing after a fold above the target', () => {
	it('answers the merged predecessor and the shifted offset at top level', async () => {
		const h = makePasteCommit(parse('a\n# h\nb\n').children);

		const result = await runPasteDispatch(
			h,
			{ pastedText: 'x', targetPath: [1], offset: 0 },
			{ crossBlock: true }
		);

		expect(serialize(h.doc)).toBe('a\nx# h\nb\n');
		expect(h.doc.children).toHaveLength(1);
		expect(result.inlineCaretPath).toEqual([0]);
		expect(result.inlineCaretOffset).toBe(3);
	});

	it('answers the container-deep path when the fold runs inside a blockquote body', async () => {
		const h = makePasteCommit(parse('> a\n> # h\n> b\n').children);
		const liveQuote = () => h.doc.children[0];
		const state = makeBlockListState(liveQuote, ['c0', 'c1', 'c2']);
		registerBlockListState(liveQuote(), state as unknown as BlockListState);

		const result = await runPasteDispatch(
			h,
			{ pastedText: 'x', targetPath: [0, 1], offset: 0 },
			{ crossBlock: true }
		);

		expect(serialize(h.doc)).toBe('> a\n> x# h\n> b\n');
		expect(liveQuote().children).toHaveLength(1);
		expect(liveQuote().childIds).toHaveLength(1);
		expect(result.inlineCaretPath).toEqual([0, 0]);
		expect(result.inlineCaretOffset).toBe(3);
	});
});
