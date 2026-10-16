// @vitest-environment jsdom
import { describe, it, expect, vi, type Mock } from 'vitest';
import { registerBlockListState } from '#lib/block-lists/state-registry.js';
import { parse } from '#lib/core/parser.js';
import {
	makeBlockListState,
	dispatchPaste,
	makePasteCommit
} from '#lib/test/harness/editor-actions.js';
import type { EditEvent } from '#lib/editor-events.js';
import type { BlockListState } from '#lib/block-lists/block-list-state.svelte.js';

// A paste surfaces under more than one op kind, chosen by the paste strategy rather than the
// target's depth, so a consumer counting pastes must watch all three (G2.9).

function editOps(handler: Mock<(e: EditEvent) => void>): string[] {
	return handler.mock.calls.map(([event]) => event.op);
}

describe('G2.9 paste op-kind emission', () => {
	it('a default structural paste emits replaceBlock, not paste', async () => {
		const h = makePasteCommit([parse('hello world\n').children[0]]);

		const onEdit = vi.fn<(e: EditEvent) => void>();
		h.events.on('edit', onEdit);

		await dispatchPaste(h, { pastedText: '# heading\n\nbody\n', targetPath: [0], offset: 6 });

		const ops = editOps(onEdit);
		expect(ops).toContain('replaceBlock');
		expect(ops).not.toContain('paste');
	});

	// Miss-analysis: the routing tests stubbed the coordinator, so none read the event a real
	// replace names.
	it.each([
		['at the top level', 'first\n\nhello world\n', [1]],
		['inside a quote', '> first\n>\n> hello world\n', [0, 1]]
	])('a default structural paste %s names the replaced block', async (_where, source, path) => {
		const h = makePasteCommit(parse(source));
		const onEdit = vi.fn<(e: EditEvent) => void>();
		h.events.on('edit', onEdit);

		await dispatchPaste(h, { pastedText: '# heading\n\nbody\n', targetPath: path, offset: 6 });

		expect(onEdit.mock.calls.map(([event]) => event)).toEqual([
			expect.objectContaining({
				op: 'replaceBlock',
				path,
				detail: { source: 'paste-dispatch' }
			})
		]);
	});

	it('a list-absorb paste emits paste, not replaceBlock', async () => {
		const h = makePasteCommit([parse('1. one\n2. two\n').children[0]]);

		// list-absorb commits on the outer list scope, resolved through the registry.
		const liveList = () => h.doc.children[0];
		const listState = makeBlockListState(liveList, ['item-0', 'item-1']);
		registerBlockListState(liveList(), listState as unknown as BlockListState);

		const onEdit = vi.fn<(e: EditEvent) => void>();
		h.events.on('edit', onEdit);

		await dispatchPaste(h, {
			pastedText: '1. INSERTED\n',
			targetPath: [0, 0, 0],
			offset: 'one'.length
		});

		const ops = editOps(onEdit);
		expect(ops).toContain('paste');
		expect(ops).not.toContain('replaceBlock');
	});

	it('a cross-block inline paste emits updateContent, not paste or replaceBlock', async () => {
		const h = makePasteCommit(parse('hello world\n').children);

		const onEdit = vi.fn<(e: EditEvent) => void>();
		h.events.on('edit', onEdit);

		await dispatchPaste(
			h,
			{ pastedText: 'XYZ\nsecond', targetPath: [0], offset: 5 },
			{ crossBlock: true }
		);

		const ops = editOps(onEdit);
		expect(ops).toContain('updateContent');
		expect(ops).not.toContain('paste');
		expect(ops).not.toContain('replaceBlock');
	});
});
