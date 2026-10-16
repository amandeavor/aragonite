// @vitest-environment jsdom
// A container-matching paste whose first item completes another kind's syntax in the target item
// changes that block's kind, as the same join does anywhere else.
// Miss-analysis: every container-match merge joined plain text, so the bare write that kept the
// target's kind never met bytes that read as another one.
import { describe, it, expect } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { serialize } from '#lib/core/serializer.js';
import { registerBlockListState } from '#lib/block-lists/state-registry.js';
import { assignChildIdsDeep } from '#lib/block-id.js';
import {
	makeBlockListState,
	dispatchPaste,
	makePasteCommit
} from '#lib/test/harness/editor-actions.js';
import { describeConvergence } from '#lib/test/harness/parse-converged.js';

describe('a container-matching merge that completes a code fence', () => {
	it.each([
		['with a second item', '- `a\n', 1, '- ``\n- z\n', '- ```\n- za\n'],
		['alone', '- `a\n', 1, '- ``\n', '- ```a\n'],
		['under a line it splits off', '- a\n  `b\n', 3, '- ``\n- z\n', '- a\n  ```\n- zb\n']
	])('%s: the target block follows its bytes', async (_name, source, offset, pasted, after) => {
		const h = makePasteCommit(parse(source));
		const list = h.doc.children[0];
		// A mounted item holds ids for its children, which a kind change has to keep in step.
		assignChildIdsDeep(list);
		registerBlockListState(
			list,
			makeBlockListState(() => h.doc.children[0])
		);

		await dispatchPaste(
			h,
			{ pastedText: pasted, targetPath: [0, 0, 0], offset },
			{ crossBlock: true }
		);

		expect(serialize(h.doc)).toBe(after);
		expect(describeConvergence(h.doc)).toBeNull();
		const item = h.doc.children[0].children![0];
		expect(item.childIds).toHaveLength(item.children!.length);
	});
});
