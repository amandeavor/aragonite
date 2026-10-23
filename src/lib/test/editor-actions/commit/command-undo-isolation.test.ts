import { describe, it, expect, vi } from 'vitest';
import { makeEditorActionsDeps } from '#lib/test/harness/editor-actions.js';
import { createBlockEditActions } from '#lib/editor-actions/block-edit.js';
import { createUndoController } from '#lib/editor-actions/commit/undo-controller.js';
import { parse } from '#lib/core/parser.js';
import {
	createInlineCommands,
	type InlineCommandsDeps
} from '#lib/components/blocks/text/inline-commands.js';

// A command's bytes are not typing: a format toggle pressed mid-burst must be its own undo
// step, so one Ctrl+Z takes the formatting off and leaves the words.
// Miss-analysis: the undo-granularity suite tested only structural commits, never a command.

function makeEditor(source: string) {
	const { deps } = makeEditorActionsDeps(parse(source).children);
	const controller = createUndoController(deps);
	return { deps, controller, blockEdit: createBlockEditActions(deps, controller) };
}

describe('a command-path text edit owns its undo entry', () => {
	it('a toggle between two keystrokes is its own entry, not folded into the burst', async () => {
		const { deps, controller, blockEdit } = makeEditor('ab\n');

		await blockEdit.updateBlockContent(0, 'abc\n', 'authored', 2);
		controller.isolateUndoEntry(
			() => void blockEdit.updateBlockContent(0, '**abc**\n', 'authored', 3)
		);
		await blockEdit.updateBlockContent(0, '**abcd**\n', 'authored', 5);

		expect(deps.undoManager.getStacks().undo).toHaveLength(3);
		controller.flushDebouncedCheckpoint();
	});

	it('the entry below the toggle is the pre-toggle text, so one step undoes the formatting', async () => {
		const { deps, controller, blockEdit } = makeEditor('ab\n');

		await blockEdit.updateBlockContent(0, 'abc\n', 'authored', 2);
		controller.isolateUndoEntry(
			() => void blockEdit.updateBlockContent(0, '**abc**\n', 'authored', 3)
		);

		const stacks = deps.undoManager.getStacks();
		expect(stacks.undo.at(-1)?.snapshot.children[0].raw).toBe('abc\n');
		controller.flushDebouncedCheckpoint();
	});

	// The isolation is symmetric: without the trailing break the next keystroke joins the
	// toggle's batch and one Ctrl+Z would revert the toggle and the typing after it.
	it('typing after the toggle starts a fresh batch', async () => {
		const { deps, controller, blockEdit } = makeEditor('ab\n');

		controller.isolateUndoEntry(
			() => void blockEdit.updateBlockContent(0, '**ab**\n', 'authored', 0)
		);
		await blockEdit.updateBlockContent(0, '**abc**\n', 'authored', 4);
		await blockEdit.updateBlockContent(0, '**abcd**\n', 'authored', 5);

		expect(deps.undoManager.getStacks().undo).toHaveLength(2);
		controller.flushDebouncedCheckpoint();
	});

	// `runCommand` answers true while a widget's source is shown; the toggle waits for the source's
	// write-back, then lands as an entry of its own.
	it('a command behind a shown source lands as its own entry after the write-back', async () => {
		const { deps, controller, blockEdit } = makeEditor('a $x$ b\n');
		let showing = true;
		const commands = createInlineCommands({
			controller,
			widgets: {
				isRevealing: () => showing,
				foldRevealBeforeMutation: () => {
					showing = false;
					const written = blockEdit.updateBlockContent(0, 'a $xy$ b\n', 'authored', 5);
					return { caret: 5, settled: written.then(() => {}) };
				}
			}
		} as unknown as InlineCommandsDeps);

		let wrote = false;
		commands.perform(
			'format.toggleStrong',
			() => {
				wrote = true;
				void blockEdit.updateBlockContent(0, '**a $xy$ b**\n', 'authored', 0);
			},
			0
		);
		expect(wrote).toBe(false);
		await vi.waitFor(() => expect(wrote).toBe(true));

		const undo = deps.undoManager.getStacks().undo;
		expect(undo.map((e) => e.snapshot.children[0].raw)).toEqual(['a $x$ b\n', 'a $xy$ b\n']);
		controller.flushDebouncedCheckpoint();
	});

	// Control: the same three writes without `isolateUndoEntry` merge into one entry.
	it('the same writes without the boundary coalesce into one entry', async () => {
		const { deps, controller, blockEdit } = makeEditor('ab\n');

		await blockEdit.updateBlockContent(0, 'abc\n', 'authored', 2);
		await blockEdit.updateBlockContent(0, '**abc**\n', 'authored', 3);
		await blockEdit.updateBlockContent(0, '**abcd**\n', 'authored', 5);

		expect(deps.undoManager.getStacks().undo).toHaveLength(1);
		controller.flushDebouncedCheckpoint();
	});
});
