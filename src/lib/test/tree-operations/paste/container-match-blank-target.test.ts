// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { serialize } from '#lib/core/serializer.js';
import { registerBlockListState } from '#lib/block-lists/state-registry.js';
import {
	makeBlockListState,
	dispatchPaste,
	makePasteCommit
} from '#lib/test/harness/editor-actions.js';
import { expectParseConverged } from '#lib/test/harness/parse-converged.js';

// Replacing a blank blockquote body block wholesale must keep the separator it carried.
// Miss-analysis: GH #73, the empty-target cases used a hand-emptied stub, which separates nothing.

describe('container-matching paste over a blank body block', () => {
	it('separates both the spliced head and the block below it', async () => {
		const h = makePasteCommit(parse('> a\n>\n>\n> b\n').children);
		const quote = h.doc.children[0];
		expect(quote.children!.map((n) => [n.leadingTrivia, n.raw])).toEqual([
			['', 'a\n'],
			['\n', '\n'],
			['', 'b\n']
		]);
		registerBlockListState(
			quote,
			makeBlockListState(() => h.doc.children[0])
		);

		await dispatchPaste(h, { pastedText: '> X\n>\n> Y\n', targetPath: [0, 1], offset: 0 });

		expect(serialize(h.doc)).toBe('> a\n>\n> X\n>\n> Y\n>\n> b\n');
		expectParseConverged(h.doc);
	});
});
