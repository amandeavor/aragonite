// @vitest-environment jsdom
// Shift+Enter at a block's end, a letter and a Backspace leave the line open as Shift+Enter left
// it: the break's bytes go with the letter, since a reload reads them as a backslash.
// Miss-analysis: #733, every row read the bytes back the way the screen draws them, never as a
// reload reads them, and the emptied line was kept as bytes no reload can draw.
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
import type { PresentationMode } from '#lib/presentation-mode.js';

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

/** `typed(n)` is the bytes once `y` lands on the last of `n` open lines; `prefix` starts each
 *  line under the text. */
const SHAPES = [
	{ name: 'a paragraph', source: 'abc def\n', path: [0], prefix: '', rest: '' },
	{
		name: 'a list item followed by another',
		source: '- abc def\n- next\n',
		path: [0, 0, 0],
		prefix: '  ',
		rest: '- next\n'
	},
	{ name: 'a quote', source: '> abc def\n', path: [0, 0], prefix: '> ', rest: '' }
].map((shape) => {
	const head = shape.source.slice(0, shape.source.indexOf('\n'));
	const typed = (open: number) =>
		`${head}\\\n${`${shape.prefix}\\\n`.repeat(open - 1)}${shape.prefix}y\n${shape.rest}`;
	return { ...shape, typed };
});
const MODES: PresentationMode[] = ['source', 'live'];

describe.each(MODES)('%s mode', (mode) => {
	describe.each(SHAPES)('the line a Backspace empties under $name', ({ source, path, typed }) => {
		async function emptied(lines = 1) {
			const editor = mountEditor({ source, presentationMode: mode });
			const el = surfaceAt(editor, path);
			placeCaret(el, 7);
			for (let i = 0; i < lines; i++) await pressKey(el, { key: 'Enter', shiftKey: true });
			await insertBy('hardware key', el, 'x');
			await nativeBackspace(el);
			return { editor, el };
		}

		it('takes the break with the letter, and the next letter writes it again', async () => {
			const { editor, el } = await emptied();
			expect(editor.source()).toBe(source);

			await insertBy('hardware key', el, 'y');

			expect(editor.source()).toBe(typed(1));
		});

		it('keeps every line two Shift+Enters opened', async () => {
			const { editor, el } = await emptied(2);
			expect(editor.source()).toBe(source);

			await insertBy('hardware key', el, 'y');

			expect(editor.source()).toBe(typed(2));
		});

		it('goes with a Backspace, like the line Shift+Enter opened', async () => {
			const { editor, el } = await emptied();

			await pressKey(el, { key: 'Backspace' });
			await insertBy('hardware key', el, 'y');

			expect(editor.source()).toBe(source.replace('abc def', 'abc defy'));
		});
	});
});

describe('live mode, a marked letter alone on the line under a break', () => {
	it('goes with its hidden markers and the break, leaving the line open', async () => {
		const editor = mountEditor({ source: 'abc def\\\n*x*\n', presentationMode: 'live' });
		const el = surfaceAt(editor, [0]);
		placeCaret(el, 11);

		// The key's keydown passes, so its delete arrives at `beforeinput`.
		if (!(await pressKey(el, { key: 'Backspace' })).defaultPrevented) await nativeBackspace(el);

		expect(editor.source()).toBe('abc def\n');
		// The unwrapped mark is pending too, so the next letter takes it back.
		await insertBy('hardware key', el, 'y');
		expect(editor.source()).toBe('abc def\\\n*y*\n');
	});
});
