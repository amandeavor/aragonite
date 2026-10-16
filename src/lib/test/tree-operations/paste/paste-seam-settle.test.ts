// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { serialize } from '#lib/core/serializer.js';
import { dispatchPaste, makePasteCommit } from '#lib/test/harness/editor-actions.js';
import { describeConvergence } from '#lib/test/harness/parse-converged.js';

// Pasted blocks can stop interrupting the block above, so every commit's join check covers paste.
// Miss-analysis: GH #183, no paste test let the block above absorb what was pasted.

describe('a structural paste whose result the block above absorbs', () => {
	it('settles the join the splice disturbed', async () => {
		const h = makePasteCommit(parse('- a\n\nzz\n'));

		await dispatchPaste(h, { pastedText: '    code\n\nmore\n', targetPath: [1], offset: 0 });

		expect(serialize(h.doc)).toBe('- a\n\n    code\n\nmore\n\nzz\n');
		expect(describeConvergence(h.doc)).toBeNull();
	});
});
