// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { serialize } from '#lib/core/serializer.js';
import { makePasteCommit, dispatchPaste } from '#lib/test/harness/editor-actions.js';

// A cross-block delete has already committed, so an unmounted container must not drop the paste.
// Miss-analysis: every container-match case registered a state for the outer node first.

describe('container-matching paste at an unmounted outer scope', () => {
	it('splices the clipboard through the tolerant entry point rather than dropping it', async () => {
		const h = makePasteCommit('- a\n- keep\n');
		const { doc } = h;
		// The stub a cross-block delete leaves, with no `BlockListState` registered for the list.
		doc.children[0].children![0].children![0].raw = '';

		await dispatchPaste(
			h,
			{ pastedText: '- x\n- y\n', targetPath: [0, 0, 0], offset: 0 },
			{ crossBlock: true }
		);

		expect(serialize(doc)).toBe('- x\n- y\n- keep\n');
	});
});
