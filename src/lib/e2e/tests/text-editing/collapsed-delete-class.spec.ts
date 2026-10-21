import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { skipUnlessSupported } from '../../browser-engine';
import { edgeKey, WORD_MODIFIER } from '../../platform-keys';

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
		name: 'a code block takes the emoji before the caret whole',
		source: `\`\`\`\nab${FAMILY}c\n\`\`\`\n`,
		path: [0],
		at: 14,
		key: 'Backspace',
		after: '```\nabc\n```\n',
		caret: 6
	},
	{
		name: 'in live mode, a code block takes the emoji after the caret whole',
		source: `\`\`\`\nab${FAMILY}c\n\`\`\`\n`,
		mode: 'live',
		path: [0],
		at: 6,
		key: 'Delete',
		after: '```\nabc\n```\n',
		caret: 6
	},
	{
		name: 'a code block takes an empty pair whole on Backspace',
		source: '```\n()\n```\n',
		path: [0],
		at: 5,
		key: 'Backspace',
		after: '```\n\n```\n',
		caret: 4
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

/** A soft keyboard's delete: the `beforeinput` alone, as iOS sends it, or after the keydown naming no
 *  key Android's keyboards send first (`android`). */
async function sendKeylessDelete(
	page: Page,
	key: Row['key'],
	{ android = false } = {}
): Promise<void> {
	await page.evaluate(
		({ key, android }) => {
			const target = document.activeElement as HTMLElement;
			if (android) {
				const init = { key: 'Unidentified', keyCode: 229, bubbles: true, cancelable: true };
				target.dispatchEvent(new KeyboardEvent('keydown', init));
			}
			target.dispatchEvent(
				new InputEvent('beforeinput', {
					inputType: key === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward',
					bubbles: true,
					cancelable: true
				})
			);
		},
		{ key, android }
	);
}

async function expectCaret(editor: EditorPage, path: number[], offset: number): Promise<void> {
	await expect
		.poll(async () => (await editor.bridge.getSelectionPaths())?.focus)
		.toEqual({ path, offset });
}

/** `row`'s delete by `press`, then one undo: the bytes and the caret after each. */
async function deleteThenUndo(
	editor: EditorPage,
	row: Row,
	press: () => Promise<void>
): Promise<void> {
	if (row.mode) await editor.setPresentationMode(row.mode);
	await editor.loadContent(row.source);
	await editor.focusBlockAtPath(row.path, row.at);
	await press();
	await expect.poll(async () => escaped(await editor.bridge.getSource())).toBe(escaped(row.after));
	await expectCaret(editor, row.path, row.caret);

	await editor.undo();
	await expect.poll(async () => escaped(await editor.bridge.getSource())).toBe(escaped(row.source));
	await expectCaret(editor, row.path, row.at);
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
				await deleteThenUndo(editor, row, () =>
					route === 'key' ? page.keyboard.press(row.key) : sendKeylessDelete(page, row.key)
				);
			});
		}
	});
}

/** A soft keyboard's Backspace naming the range it would take (`widget`: the first inline widget,
 *  else the character before the caret), after Android's keyless keydown with `android`. */
async function sendKeylessBackspaceOver(
	page: Page,
	widget: boolean,
	{ android = false } = {}
): Promise<void> {
	await page.evaluate(
		({ widget, android }) => {
			const target = document.activeElement as HTMLElement;
			if (android) {
				const init = { key: 'Unidentified', keyCode: 229, bubbles: true, cancelable: true };
				target.dispatchEvent(new KeyboardEvent('keydown', init));
			}
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
		},
		{ widget, android }
	);
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

	// Android's keyboards send a keydown naming no key before the delete, which is still keyless.
	test('a wider range named after a keydown that names no key: left to the browser', async ({
		page
	}) => {
		skipUnlessSupported(page, 'syntheticTargetRanges');
		await editor.loadContent('a&copy;b\n');
		await editor.focusBlockAtPath([0], 7);
		await sendKeylessBackspaceOver(page, true, { android: true });
		await editor.waitForRenderFlush();
		expect(await editor.bridge.getSource()).toBe('a&copy;b\n');
	});

	// The Backspace before it was taken at its keydown, so it fired no input of its own.
	test('a wider range named after a key the editor took: still left to the browser', async ({
		page
	}) => {
		skipUnlessSupported(page, 'syntheticTargetRanges');
		await editor.loadContent('a&copy;b&copy;\n');
		await editor.focusBlockAtPath([0], 14);
		await page.keyboard.press('Backspace');
		await editor.bridge.waitForSourceEquals('a&copy;b\n');
		await sendKeylessBackspaceOver(page, true);
		await editor.waitForRenderFlush();
		expect(await editor.bridge.getSource()).toBe('a&copy;b\n');
	});
});

// Shift+Backspace is Backspace on every OS, so it follows the widget's policy and the hidden-run
// rule too.
const SHIFT_ROWS: Row[] = [
	{
		name: 'an atomic widget before the caret goes whole',
		source: 'a&copy;b\n',
		path: [0],
		at: 7,
		key: 'Backspace',
		after: 'ab\n',
		caret: 1
	},
	{
		name: 'in live mode, past a hidden closer it takes the letter inside',
		source: '**ab**c\n',
		mode: 'live',
		path: [0],
		at: 6,
		key: 'Backspace',
		after: '**a**c\n',
		caret: 3
	}
];

test.describe('Shift+Backspace takes what Backspace takes', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	for (const row of SHIFT_ROWS) {
		test(row.name, async ({ page }) => {
			await deleteThenUndo(editor, row, () => page.keyboard.press('Shift+Backspace'));
		});
	}

	test('an image before the caret is selected, its bytes kept', async ({ page }) => {
		const source = 'lead![cat](/test-fixtures/sample.png)\n';
		await editor.loadContent(source);
		await editor.focusBlockEnd(0);
		await page.keyboard.press('Shift+Backspace');
		await expect(page.locator('[data-image-overlay]')).toBeVisible();
		expect(await editor.bridge.getSource()).toBe(source);
	});
});

// A soft keyboard's delete at a block's edge runs the merge the key runs, the same bytes.
const EDGE_ROWS = [
	{ name: 'Backspace at a paragraph start', source: 'abc\n\nnext\n', path: [1], at: 0 },
	{ name: 'Delete at a paragraph end', source: 'abc\n\nnext\n', path: [0], at: 3, forward: true },
	{ name: 'Backspace at a second list item start', source: '- a\n- b\n', path: [0, 1, 0], at: 0 },
	{ name: 'Backspace at a quote child start', source: 'x\n\n> q\n', path: [1, 0], at: 0 },
	// End leaves the caret on either side of the hidden closer, and both are the paragraph's end.
	{
		name: 'in live mode, Delete after End at a bold paragraph end',
		source: '**bold**\n\nnext\n',
		path: [0],
		at: 2,
		forward: true,
		live: true,
		viaEnd: true
	}
];

test.describe('a soft keyboard delete at a block edge does what the key does', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	for (const row of EDGE_ROWS) {
		test(row.name, async ({ page }) => {
			const key = row.forward ? 'Delete' : 'Backspace';
			if (row.live) await editor.setPresentationMode('live');
			const place = async () => {
				await editor.loadContent(row.source);
				await editor.focusBlockAtPath(row.path, row.at);
				if (row.viaEnd) await page.keyboard.press(edgeKey('lineEnd'));
			};
			await place();
			await page.keyboard.press(key);
			await editor.waitForRenderFlush();
			const keyed = await editor.bridge.getSource();
			expect(keyed).not.toBe(row.source);

			await place();
			await sendKeylessDelete(page, key);
			await expect.poll(async () => escaped(await editor.bridge.getSource())).toBe(escaped(keyed));
			await editor.undo();
			await expect.poll(() => editor.bridge.getSource()).toBe(row.source);
		});
	}

	test('Backspace at a paragraph start after the keydown that names no key', async ({ page }) => {
		await editor.loadContent('abc\n\nnext\n');
		await editor.focusBlockAtPath([1], 0);
		await sendKeylessDelete(page, 'Backspace', { android: true });
		await editor.bridge.waitForSourceEquals('abcnext\n');
	});
});

// A chord the keymap doesn't bind reaches the delete step at the edge, where the browser's own
// delete would take the hidden marker prefix.
test.describe('a chorded delete at a block start writes nothing', () => {
	for (const chord of ['Shift+Backspace', `${WORD_MODIFIER}+Backspace`]) {
		test(`${chord} at a live heading's start`, async ({ page }) => {
			const editor = new EditorPage(page);
			await editor.goto();
			await editor.setPresentationMode('live');
			await editor.loadContent('para\n\n# Title\n');
			await editor.focusBlockAtPath([1], 2);
			await page.keyboard.press(chord);
			await page.keyboard.type('x');
			await editor.bridge.waitForSourceEquals('para\n\n# xTitle\n');
		});
	}
});

// End and Home leave the caret where each engine puts it at a CRLF line end, and the delete still
// edits the pair as one character.
const CRLF_PARAGRAPH = 'abc\r\nAfter\r\n';
const CRLF_CODE = '```\r\nabc\r\nxyz\r\n```\r\n';

for (const mode of ['source', 'live'] as const) {
	test.describe(`a CRLF line end reached by the keyboard (${mode})`, () => {
		let editor: EditorPage;

		test.beforeEach(async ({ page }) => {
			editor = new EditorPage(page);
			await editor.goto();
			await editor.setPresentationMode(mode);
		});

		const expectSource = async (expected: string) =>
			expect.poll(async () => escaped(await editor.bridge.getSource())).toBe(escaped(expected));

		test('Delete after End takes the whole pair', async ({ page }) => {
			await editor.loadContent(CRLF_PARAGRAPH);
			await editor.focusBlockStart(0);
			await page.keyboard.press(edgeKey('lineEnd'));
			await page.keyboard.press('Delete');
			await expectSource('abcAfter\r\n');
		});

		test('Backspace after End takes the letter before the pair', async ({ page }) => {
			await editor.loadContent(CRLF_PARAGRAPH);
			await editor.focusBlockStart(0);
			await page.keyboard.press(edgeKey('lineEnd'));
			await page.keyboard.press('Backspace');
			await expectSource('ab\r\nAfter\r\n');
		});

		test('Backspace after End in a code body takes the letter before the pair', async ({
			page
		}) => {
			await editor.loadContent(CRLF_CODE);
			await editor.focusBlockAtPath([0], 5);
			await page.keyboard.press(edgeKey('lineEnd'));
			await page.keyboard.press('Backspace');
			await expectSource('```\r\nab\r\nxyz\r\n```\r\n');
		});

		test('Backspace after Home on the next line takes the whole pair', async ({ page }) => {
			await editor.loadContent(CRLF_PARAGRAPH);
			await editor.focusBlockStart(0);
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press(edgeKey('lineStart'));
			await page.keyboard.press('Backspace');
			await expectSource('abcAfter\r\n');
		});
	});
}
