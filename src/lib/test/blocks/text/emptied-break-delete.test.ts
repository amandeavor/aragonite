// @vitest-environment jsdom
// In live mode, the empty last line a hard break at a block's end leaves after its text is deleted
// is a line like any other: Backspace on it, or Delete at the end of the line above, takes it.
// Miss-analysis: #690, every edge-delete row cut a line holding text, so the check that reads the
// block back never met the empty last line the screen draws and a reload splits off.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	placeCaret,
	surfaceAt
} from '#lib/test/harness/mount-editor.svelte.js';
import { pressKey, settleEditor } from '#lib/test/harness/settle.js';
import { dispatchBeforeInput, insertBy } from '#lib/test/harness/insertion-routes.js';

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

/** The browser's Backspace over the character before a collapsed text caret, which jsdom leaves
 *  to the page: `beforeinput`, then the cut, then `input`. */
async function nativeBackspace(el: HTMLElement): Promise<void> {
	if (!dispatchBeforeInput(el, 'deleteContentBackward').defaultPrevented) {
		const range = window.getSelection()!.getRangeAt(0);
		const text = range.startContainer as Text;
		text.deleteData(range.startOffset - 1, 1);
		el.dispatchEvent(
			new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true })
		);
	}
	await settleEditor();
}

const SHAPES = [
	{ name: 'a paragraph', source: 'abc def\n', path: [0], deleted: 'abc def\n' },
	{
		name: 'a list item followed by another',
		source: '- abc def\n- next\n',
		path: [0, 0, 0],
		deleted: '- abc def\n- next\n'
	},
	{ name: 'a quote', source: '> abc def\n', path: [0, 0], deleted: '> abc def\n' }
];

describe.each(SHAPES)(
	'the emptied line after a hard break, in $name',
	({ source, path, deleted }) => {
		async function emptied() {
			const editor = mountEditor({ source, presentationMode: 'live' });
			const el = surfaceAt(editor, path);
			placeCaret(el, 7);
			await pressKey(el, { key: 'Enter', shiftKey: true });
			await insertBy('hardware key', el, 'x');
			await nativeBackspace(el);
			expect(editor.source()).not.toBe(source);
			return { editor, el };
		}

		it('Backspace on it takes the line and the break', async () => {
			const { editor, el } = await emptied();

			await pressKey(el, { key: 'Backspace' });

			expect(editor.source()).toBe(deleted);
		});

		it('Delete at the end of the line above takes them', async () => {
			const { editor, el } = await emptied();
			placeCaret(el, 7);

			await pressKey(el, { key: 'Delete' });

			expect(editor.source()).toBe(deleted);
		});
	}
);
