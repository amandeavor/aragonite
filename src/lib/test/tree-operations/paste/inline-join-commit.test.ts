// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { registerBlockListState } from '#lib/block-lists/state-registry.js';
import { parse } from '#lib/core/parser.js';
import {
	makeBlockListState,
	runPasteDispatch,
	makePasteCommit
} from '#lib/test/harness/editor-actions.js';
import type { BlockListState } from '#lib/block-lists/block-list-state.svelte.js';
import type { EditEvent } from '#lib/editor-events.js';
import { takeDevWarns } from '#lib/test/support/warn-gate.js';

// A splice outside the commit updates neither the parent's `childIds`, which nothing repairs
// later, nor the `edit` stream, so persistence would see the delete and not the insertion.

function blockquoteHarness() {
	const h = makePasteCommit(parse('> # Head\n').children);
	const liveQuote = () => h.doc.children[0];
	const state = makeBlockListState(liveQuote, ['child-0']);
	registerBlockListState(liveQuote(), state as unknown as BlockListState);
	return { h, liveQuote };
}

describe("cross-block inline paste ('join'): commit sequence participation", () => {
	it('keeps the container childIds aligned with children when the paste reparses to two blocks', async () => {
		const { h, liveQuote } = blockquoteHarness();

		await runPasteDispatch(
			h,
			{ pastedText: 'foo\nbar', targetPath: [0, 0], offset: 'Head'.length + 2 },
			{ crossBlock: true }
		);

		const quote = liveQuote();
		expect(quote.children).toHaveLength(2);
		expect(quote.childIds).toHaveLength(2);
	});

	it('emits an edit event so a persistence layer records the insertion', async () => {
		const { h } = blockquoteHarness();
		const onEdit = vi.fn<(e: EditEvent) => void>();
		h.events.on('edit', onEdit);

		await runPasteDispatch(
			h,
			{ pastedText: 'foo\nbar', targetPath: [0, 0], offset: 'Head'.length + 2 },
			{ crossBlock: true }
		);

		expect(onEdit.mock.calls.map(([e]) => e.op)).toContain('updateContent');
	});

	it('emits the edit event for a same-kind paste too (no structural change to ride on)', async () => {
		const { h } = blockquoteHarness();
		const onEdit = vi.fn<(e: EditEvent) => void>();
		h.events.on('edit', onEdit);

		await runPasteDispatch(
			h,
			{ pastedText: 'ing', targetPath: [0, 0], offset: 'Head'.length + 2 },
			{ crossBlock: true }
		);

		expect(h.doc.children[0].children![0].raw).toBe('# Heading\n');
		expect(onEdit.mock.calls.map(([e]) => e.op)).toContain('updateContent');
	});

	// The range delete has already committed by the time the paste dispatches, so a throw here
	// loses the selection with nothing pasted. The write lands by path, so it needs no refs.
	it('an unmounted container still commits instead of throwing', async () => {
		const h = makePasteCommit(parse('> # Head\n').children);

		await runPasteDispatch(
			h,
			{ pastedText: 'foo\nbar', targetPath: [0, 0], offset: 'Head'.length + 2 },
			{ crossBlock: true }
		);

		const quote = h.doc.children[0];
		expect(quote.children).toHaveLength(2);
		expect(quote.childIds).toHaveLength(2);
		expect(takeDevWarns()).toEqual([]);
	});

	it('top-level target syncs the document-scope block ids', async () => {
		const h = makePasteCommit(parse('# Head\n').children);

		await runPasteDispatch(
			h,
			{ pastedText: 'foo\nbar', targetPath: [0], offset: 'Head'.length + 2 },
			{ crossBlock: true }
		);

		expect(h.doc.children).toHaveLength(2);
		expect(h.deps.blockIds).toHaveLength(2);
	});
});
