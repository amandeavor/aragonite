import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { skipUnlessSupported } from '../../browser-engine';
import { edgeKey, WORD_MODIFIER } from '../../platform-keys';
import { addReplaceIsland, addWidgetIsland } from '../../decoration-sources';

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

// Shift+Backspace is Backspace on every OS, so it follows the hidden-run rule too.
const SHIFT_ROWS: Row[] = [
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
});

interface KeyRow {
	name: string;
	source: string;
	path: number[];
	at: number;
	forward?: boolean;
	mode?: 'live';
	viaEnd?: boolean;
	/** Installs a decoration source, before the content loads. */
	decorate?: (page: Page) => Promise<void>;
}

// A delete of any unit at a block's edge, by any route, does what the plain key does there.
const EDGE_ROWS: KeyRow[] = [
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
		mode: 'live',
		viaEnd: true
	},
	// The browser's own delete there would take the space of the hidden `# `.
	{
		name: "in live mode, Backspace at a heading's start",
		source: 'para\n\n# Title\n',
		path: [1],
		at: 2,
		mode: 'live'
	},
	// The code block's Backspace steps out to the block above: the bytes stay and the caret moves.
	{ name: "Backspace at a code block's start", source: 'abc\n\n```\nx\n```\n', path: [1], at: 0 }
];

const IMAGE = '![x](/test-fixtures/sample.png)';

// Beside a widget the plain key takes an atomic one whole and selects the rest, an image included.
const WIDGET_ROWS: KeyRow[] = [
	{ name: 'an image before the caret', source: `aa\n\n${IMAGE} bb\n`, path: [1], at: 31 },
	{
		name: 'in live mode, an image before the caret',
		source: `aa\n\n${IMAGE} bb\n`,
		path: [1],
		at: 31,
		mode: 'live'
	},
	{
		name: 'an image after the caret',
		source: `aa\n\nbb ${IMAGE}\n`,
		path: [1],
		at: 3,
		forward: true
	},
	{
		name: 'in live mode, an image after the caret',
		source: `aa\n\nbb ${IMAGE}\n`,
		path: [1],
		at: 3,
		forward: true,
		mode: 'live'
	},
	{ name: 'an image closing the block', source: `lead${IMAGE}\n`, path: [0], at: 35 },
	{ name: 'an entity before the caret', source: 'a&copy;b\n', path: [0], at: 7 },
	{
		name: 'a table cell, an image before the caret',
		source: `| ${IMAGE} b |\n| - |\n`,
		path: [0, 0, 0],
		at: 31
	},
	{
		name: 'a replace decoration closing the block',
		source: 'abHIDDEN\n',
		path: [0],
		at: 8,
		decorate: (page) => addReplaceIsland(page, [0], 2, 8)
	}
];

/** A Mac's Option or Cmd delete: the keydown, then in a second call, as its handler has finished
 *  by then under a real key, the input it opens unless the keydown was prevented. */
async function sendChordDelete(
	page: Page,
	key: 'Backspace' | 'Delete',
	modifier: 'altKey' | 'metaKey',
	inputType: string
): Promise<void> {
	await page.evaluate(
		({ key, modifier }) => {
			const init = { key, [modifier]: true, bubbles: true, cancelable: true };
			const keydown = new KeyboardEvent('keydown', init);
			(window as any).__chordKeydown = keydown;
			document.activeElement!.dispatchEvent(keydown);
		},
		{ key, modifier }
	);
	await page.evaluate((inputType) => {
		if ((window as any).__chordKeydown.defaultPrevented) return;
		const input = { inputType, bubbles: true, cancelable: true };
		document.activeElement!.dispatchEvent(new InputEvent('beforeinput', input));
	}, inputType);
}

interface EdgeRoute {
	name: string;
	backwardOnly?: boolean;
	send(page: Page, key: 'Backspace' | 'Delete'): Promise<void>;
}

const EDGE_ROUTES: EdgeRoute[] = [
	{ name: 'a soft keyboard', send: (page, key) => sendKeylessDelete(page, key) },
	{ name: 'the word chord', send: (page, key) => page.keyboard.press(`${WORD_MODIFIER}+${key}`) },
	// Shift+Delete is a cut on Windows.
	{ name: 'Shift', backwardOnly: true, send: (page, key) => page.keyboard.press(`Shift+${key}`) },
	{
		name: "a Mac's Option word delete",
		send: (page, key) =>
			sendChordDelete(
				page,
				key,
				'altKey',
				key === 'Backspace' ? 'deleteWordBackward' : 'deleteWordForward'
			)
	},
	{
		name: "a Mac's Cmd line delete",
		send: (page, key) =>
			sendChordDelete(
				page,
				key,
				'metaKey',
				key === 'Backspace' ? 'deleteSoftLineBackward' : 'deleteSoftLineForward'
			)
	}
];

/** The source, the caret and any widget shown selected, which together say what a delete did. */
async function keyOutcome(editor: EditorPage): Promise<string> {
	await editor.waitForRenderFlush();
	const focus = (await editor.bridge.getSelectionPaths())?.focus;
	const selected = await editor.page.locator('[data-image-overlay], .md-widget-selected').count();
	return JSON.stringify({ source: await editor.bridge.getSource(), focus, selected });
}

/** `row`'s plain key, then the same caret by `route`: both come out the same, and the key did
 *  something. */
async function expectPlainKeyParity(editor: EditorPage, row: KeyRow, route: EdgeRoute) {
	const page = editor.page;
	const key = row.forward ? 'Delete' : 'Backspace';
	if (row.mode) await editor.setPresentationMode(row.mode);
	if (row.decorate) await row.decorate(page);
	const place = async () => {
		await editor.loadContent(row.source);
		await editor.focusBlockAtPath(row.path, row.at);
		if (row.viaEnd) await page.keyboard.press(edgeKey('lineEnd'));
	};
	await place();
	const before = await keyOutcome(editor);
	await page.keyboard.press(key);
	const plain = await keyOutcome(editor);
	expect(plain).not.toBe(before);

	await place();
	await route.send(page, key);
	await expect.poll(() => keyOutcome(editor)).toBe(plain);
}

const PARITY_TABLES = [
	{ where: 'at a block edge', rows: EDGE_ROWS },
	{ where: 'beside a widget', rows: WIDGET_ROWS }
];

for (const { where, rows } of PARITY_TABLES) {
	for (const route of EDGE_ROUTES) {
		test.describe(`a delete ${where} by ${route.name} does what the plain key does`, () => {
			let editor: EditorPage;

			test.beforeEach(async ({ page }) => {
				editor = new EditorPage(page);
				await editor.goto();
			});

			for (const row of rows.filter((row) => !(route.backwardOnly && row.forward))) {
				test(row.name, async () => {
					await expectPlainKeyParity(editor, row, route);
				});
			}
		});
	}
}

test.describe('a delete at a block edge: undo, Android, the heading marker, a cell', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test("a soft keyboard's merge is one undo", async ({ page }) => {
		await editor.loadContent('abc\n\nnext\n');
		await editor.focusBlockAtPath([1], 0);
		await sendKeylessDelete(page, 'Backspace');
		await editor.bridge.waitForSourceEquals('abcnext\n');
		await editor.undo();
		await editor.bridge.waitForSourceEquals('abc\n\nnext\n');
	});

	test('Backspace at a paragraph start after the keydown that names no key', async ({ page }) => {
		await editor.loadContent('abc\n\nnext\n');
		await editor.focusBlockAtPath([1], 0);
		await sendKeylessDelete(page, 'Backspace', { android: true });
		await editor.bridge.waitForSourceEquals('abcnext\n');
	});

	// The browser's own delete there takes the space of `# ` and leaves `#Title`.
	for (const chord of ['Shift+Backspace', `${WORD_MODIFIER}+Backspace`]) {
		test(`${chord} at a live heading's start takes the marker whole`, async ({ page }) => {
			await editor.setPresentationMode('live');
			await editor.loadContent('para\n\n# Title\n');
			await editor.focusBlockAtPath([1], 2);
			await page.keyboard.press(chord);
			await page.keyboard.type('x');
			await editor.bridge.waitForSourceEquals('para\n\nxTitle\n');
		});
	}

	// A widget decoration stands for no bytes, so it changes nothing about where the heading starts.
	test("Backspace at a live heading's start does the same beside a widget decoration", async ({
		page
	}) => {
		await editor.setPresentationMode('live');
		const press = async () => {
			await editor.loadContent('para\n\n# Title\n');
			await editor.focusBlockAtPath([1], 2);
			await page.keyboard.press('Backspace');
			return keyOutcome(editor);
		};
		const bare = await press();
		await addWidgetIsland(page, [1], 2);
		expect(await press()).toBe(bare);
	});

	test("the word chord at a table cell's start moves to the cell before, as Backspace does", async ({
		page
	}) => {
		await editor.loadContent('| a | b |\n| - | - |\n| cc | dd |\n');
		await editor.focusBlockAtPath([0, 1, 1], 0);
		await page.keyboard.press(`${WORD_MODIFIER}+Backspace`);
		await page.keyboard.type('Z');
		await editor.bridge.waitForSourceEquals('| a | b |\n| - | - |\n| ccZ | dd |\n');
	});
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
