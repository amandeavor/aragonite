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

// Dispatch cuts a selection once, before picking a strategy, so no route keeps the cut bytes.
// Miss-analysis: GH #121, every container-route case pasted at a collapsed caret.

function harnessFor(source: string) {
	const h = makePasteCommit(parse(source));
	registerBlockListState(
		h.doc.children[0],
		makeBlockListState(() => h.doc.children[0])
	);
	return h;
}

describe('a paste over a selection inside a list item', () => {
	it('spends the delete half before the strategy reads the target', async () => {
		const h = harnessFor('- alpha\n');

		await dispatchPaste(h, {
			pastedText: '- x\n- y\n',
			targetPath: [0, 0, 0],
			offset: 0,
			preDelete: { start: 0, end: 'alpha'.length }
		});

		expect(serialize(h.doc)).toBe('- x\n- y\n');
	});

	// The partial case: only the selected bytes go, and the rest survives around the paste.
	it('keeps the bytes outside the selection', async () => {
		const h = harnessFor('- alpha beta\n');

		await dispatchPaste(h, {
			pastedText: '- x\n',
			targetPath: [0, 0, 0],
			offset: 0,
			preDelete: { start: 0, end: 'alpha '.length }
		});

		expect(serialize(h.doc)).toBe('- x\n- beta\n');
	});
});
