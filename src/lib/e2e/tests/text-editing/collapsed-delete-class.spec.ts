import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { skipUnlessSupported } from '../../browser-engine';

/**
 * A collapsed Backspace or Delete inside a line takes the same bytes on every engine, by key or by
 * a soft keyboard's `beforeinput` alone, and one undo puts the bytes and the caret back
 * (`requirements/text-editing/collapsed-delete-class.md`).
 */

const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}';
const KEYCAP = '1️⃣';

interface Row {
	name: string;
	source: string;
	mode?: 'source' | 'live';
	path: number[];
	at: number;
	key: 'Backspace' | 'Delete';
	after: string;
	/** The caret's raw offset in `path` after the delete. */
	caret: number;
}

const ROWS: Row[] = [
	{
		name: 'a ZWJ family before the caret goes whole',
		source: `ab${FAMILY}c\n`,
		path: [0],
		at: 10,
		key: 'Backspace',
		after: 'abc\n',
		caret: 2
	},
	{
		name: 'a ZWJ family after the caret goes whole',
		source: `ab${FAMILY}c\n`,
		path: [0],
		at: 2,
		key: 'Delete',
		after: 'abc\n',
		caret: 2
	},
	{
		name: 'a keycap before the caret goes whole',
		source: `a${KEYCAP}b\n`,
		path: [0],
		at: 4,
		key: 'Backspace',
		after: 'ab\n',
		caret: 1
	},
	{
		name: 'Backspace takes only the accent of a combining cluster',
		source: 'xéy\n',
		path: [0],
		at: 3,
		key: 'Backspace',
		after: 'xey\n',
		caret: 2
	},
	{
		name: 'Delete takes a combining cluster whole',
		source: 'xéy\n',
		path: [0],
		at: 1,
		key: 'Delete',
		after: 'xy\n',
		caret: 1
	},
	{
		name: 'Backspace at a line start takes a CRLF pair whole',
		source: 'ab\r\ncd\r\n',
		path: [0],
		at: 4,
		key: 'Backspace',
		after: 'abcd\r\n',
		caret: 2
	},
	{
		name: 'Delete at a line end takes a CRLF pair whole',
		source: 'ab\r\ncd\r\n',
		path: [0],
		at: 2,
		key: 'Delete',
		after: 'abcd\r\n',
		caret: 2
	},
	{
		name: 'an atomic widget after the caret goes whole',
		source: 'a&copy;b\n',
		path: [0],
		at: 1,
		key: 'Delete',
		after: 'ab\n',
		caret: 1
	},
	{
		name: 'Backspace at the line after a hard break takes the line ending, the shown `\\` kept',
		source: 'a\\\nb\n',
		path: [0],
		at: 3,
		key: 'Backspace',
		after: 'a\\b\n',
		caret: 2
	},
	{
		name: 'in live mode, Backspace past a hidden closer takes the letter inside it',
		source: '**ab**c\n',
		mode: 'live',
		path: [0],
		at: 6,
		key: 'Backspace',
		after: '**a**c\n',
		caret: 3
	},
	{
		name: 'in live mode, Backspace over a heading`s last letter leaves an empty paragraph',
		source: '# H #\n\nnext\n',
		mode: 'live',
		path: [0],
		at: 3,
		key: 'Backspace',
		after: '\nnext\n',
		caret: 0
	},
	{
		name: 'Backspace over a list item`s last letter leaves the empty item',
		source: '- a\n- b\n',
		path: [0, 0, 0],
		at: 1,
		key: 'Backspace',
		after: '- \n- b\n',
		caret: 0
	},
	{
		name: 'a quote child takes the emoji before the caret whole',
		source: `> x${FAMILY}\n`,
		path: [0, 0],
		at: 9,
		key: 'Backspace',
		after: '> x\n',
		caret: 1
	},
	{
		name: 'a table cell takes the emoji before the caret whole',
		source: `| H |\n| - |\n| a${FAMILY} |\n`,
		path: [0, 1, 0],
		at: 9,
		key: 'Backspace',
		after: '| H |\n| - |\n| a |\n',
		caret: 1
	}
];

/** The source with `\r` and `\n` spelled out, so a diff shows a lone one. */
const escaped = (source: string) => JSON.stringify(source);

/** A soft keyboard's delete: the `beforeinput` alone, no keydown, as Android and iOS send it. */
async function sendKeylessDelete(page: Page, key: Row['key']): Promise<void> {
	await page.evaluate((key) => {
		const target = document.activeElement as HTMLElement;
		target.dispatchEvent(
			new InputEvent('beforeinput', {
				inputType: key === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward',
				bubbles: true,
				cancelable: true
			})
		);
	}, key);
}

async function expectCaret(editor: EditorPage, path: number[], offset: number): Promise<void> {
	await expect
		.poll(async () => (await editor.bridge.getSelectionPaths())?.focus)
		.toEqual({ path, offset });
}

for (const route of ['key', 'soft keyboard'] as const) {
	test.describe(`a collapsed delete by ${route}`, () => {
		let editor: EditorPage;

		test.beforeEach(async ({ page }) => {
			editor = new EditorPage(page);
			await editor.goto();
		});

		for (const row of ROWS) {
			test(row.name, async ({ page }) => {
				if (row.mode) await editor.setPresentationMode(row.mode);
				await editor.loadContent(row.source);
				await editor.focusBlockAtPath(row.path, row.at);
				if (route === 'key') await page.keyboard.press(row.key);
				else await sendKeylessDelete(page, row.key);
				await expect
					.poll(async () => escaped(await editor.bridge.getSource()))
					.toBe(escaped(row.after));
				await expectCaret(editor, row.path, row.caret);

				await editor.undo();
				await expect
					.poll(async () => escaped(await editor.bridge.getSource()))
					.toBe(escaped(row.source));
				await expectCaret(editor, row.path, row.at);
			});
		}
	});
}

/** A soft keyboard's Backspace naming the range it would take, as a real one does: `widget` makes
 *  it the first inline widget, otherwise the character before the caret. */
async function sendKeylessBackspaceOver(page: Page, widget: boolean): Promise<void> {
	await page.evaluate((widget) => {
		const target = document.activeElement as HTMLElement;
		const range = document.createRange();
		if (widget) range.selectNode(target.querySelector('[data-inline-widget]')!);
		else {
			const caret = window.getSelection()!.getRangeAt(0);
			range.setStart(caret.startContainer, caret.startOffset - 1);
			range.setEnd(caret.startContainer, caret.startOffset);
		}
		target.dispatchEvent(
			new InputEvent('beforeinput', {
				inputType: 'deleteContentBackward',
				bubbles: true,
				cancelable: true,
				targetRanges: [new StaticRange(range)]
			})
		);
	}, widget);
}

test.describe('a soft keyboard delete that names its range', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('one character named: the editor takes it', async ({ page }) => {
		await editor.loadContent('abc\n');
		await editor.focusBlockAtPath([0], 3);
		await sendKeylessBackspaceOver(page, false);
		await editor.bridge.waitForSourceEquals('ab\n');
	});

	// The keyboard's own wider edit (an autocorrected word, a whole widget) stays the browser's,
	// which a hand-fired event has none of, so the editor writing nothing is the proof.
	test('a wider range named: the editor leaves it to the browser', async ({ page }) => {
		skipUnlessSupported(page, 'syntheticTargetRanges');
		await editor.loadContent('a&copy;b\n');
		await editor.focusBlockAtPath([0], 7);
		await sendKeylessBackspaceOver(page, true);
		await editor.waitForRenderFlush();
		expect(await editor.bridge.getSource()).toBe('a&copy;b\n');
	});
});
