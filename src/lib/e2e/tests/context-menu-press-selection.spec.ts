import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { EditorPage } from '../editor-page';
import { menuAtClipboardRead, watchClipboardRead } from '../clipboard-arm';
import { textRunCenter } from '../text-runs';

// The right-click menu decides on the selection as it stood when the button went down, since
// Safari selects the word under a right-click before the menu opens; the rows act on the live one.
// Requirements: `requirements/context-menu-press-selection.md`.

const DOC =
	'abcd efgh\n\n---\n\n```\ncode body\n```\n\n| cell | d |\n| --- | --- |\n| e | f |\n\ntail words\n';

interface Point {
	x: number;
	y: number;
}

const dispatchAt = (page: Page, type: 'mousedown' | 'contextmenu', at: Point) =>
	page.evaluate(
		({ type, x, y }) => {
			const init = {
				bubbles: true,
				cancelable: true,
				button: 2,
				buttons: 2,
				clientX: x,
				clientY: y
			};
			document.elementFromPoint(x, y)!.dispatchEvent(new MouseEvent(type, init));
		},
		{ type, ...at }
	);

/** A right-click as Safari delivers it: the press, its own selection under the pointer (which
 *  Playwright's WebKit never makes, so `selectUnder` does), then `contextmenu`. */
async function safariRightClick(page: Page, at: Point, selectUnder: () => Promise<unknown>) {
	await dispatchAt(page, 'mousedown', at);
	await selectUnder();
	await dispatchAt(page, 'contextmenu', at);
}

/** Right-click `word`, which Safari selects; `path` and `start` name it in the editor's offsets. */
async function rightClickWord(editor: EditorPage, word: string, path: number[], start: number) {
	const at = await textRunCenter(editor.page, word);
	await safariRightClick(editor.page, at, async () => {
		const end = start + word.length;
		await editor.bridge.setSelection({
			anchor: { path, offset: start },
			focus: { path, offset: end }
		});
		expect(await editor.page.evaluate(() => window.getSelection()!.toString())).toBe(word);
	});
}

/** Select `tail` in the last block, where the selection toolbar it brings covers nothing above. */
async function selectTail(editor: EditorPage): Promise<void> {
	await editor.focusBlock(4, 0);
	for (let i = 0; i < 4; i++) await editor.page.keyboard.press('Shift+ArrowRight');
	expect(await editor.page.evaluate(() => window.getSelection()!.toString())).toBe('tail');
}

const menuItem = (page: Page, name: string) =>
	page.locator('.md-menu').getByRole('menuitem', { name, exact: true });

test.describe('the right-click menu reads the selection from the press', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto('?presentationMode=live');
		await editor.loadContent(DOC);
		await editor.focusBlockEnd(0);
	});

	test('a divider Safari highlights whole still opens its block actions', async ({ page }) => {
		const rule = page.locator("[data-block-path='[1]'] .thematic-break-block");
		const box = (await rule.boundingBox())!;
		const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		await safariRightClick(page, at, () =>
			rule.evaluate((el) => {
				const range = document.createRange();
				range.selectNode(el);
				window.getSelection()!.removeAllRanges();
				window.getSelection()!.addRange(range);
			})
		);
		await expect(menuItem(page, 'Copy divider')).toBeVisible();
	});

	test('a word Safari selects in code opens the block actions and lets the word go', async ({
		page
	}) => {
		await rightClickWord(editor, 'body', [2], 9);
		await expect(menuItem(page, 'Copy code block')).toBeVisible();
		expect(await page.evaluate(() => window.getSelection()!.isCollapsed)).toBe(true);
	});

	test('a word Safari selects in prose keeps the Insert flyout and stays what Copy copies', async ({
		page
	}) => {
		await rightClickWord(editor, 'efgh', [0], 5);
		await expect(menuItem(page, 'Insert block')).toBeVisible();
		await expect(menuItem(page, 'Copy')).toBeEnabled();
		expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('efgh');
	});

	test('a press outside the text selected elsewhere opens the block actions under it', async ({
		page
	}) => {
		await selectTail(editor);
		await rightClickWord(editor, 'body', [2], 9);
		await expect(menuItem(page, 'Copy code block')).toBeVisible();
	});

	test('a real right-click on code outside a selection opens the block actions', async ({
		page
	}) => {
		await selectTail(editor);
		const at = await textRunCenter(page, 'body');
		await page.mouse.click(at.x, at.y, { button: 'right' });
		await expect(menuItem(page, 'Copy code block')).toBeVisible();
	});

	test('a real right-click inside a selection keeps it for the clipboard rows', async ({
		page
	}) => {
		await selectTail(editor);
		const at = await textRunCenter(page, 'tail');
		await page.mouse.click(at.x, at.y, { button: 'right' });
		await expect(menuItem(page, 'Cut')).toBeEnabled();
		await expect(menuItem(page, 'Insert block')).toHaveCount(0);
		expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('tail');
	});

	test('a word Safari selects in a cell is what the cell menu acts on', async ({ page }) => {
		await rightClickWord(editor, 'cell', [3, 0, 0], 0);
		await expect(page.getByRole('menu', { name: 'Table actions' })).toBeVisible();
		await expect(menuItem(page, 'Copy')).toBeEnabled();
	});
});

// Safari shows its native Paste prompt for another app's text; drawn over a menu still on the
// page, it hides the pick the user just made.
test.describe('a menu Paste reads the clipboard once the menu is gone', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto('?presentationMode=live');
		await editor.loadContent(DOC);
		await editor.seedClipboard('pasted');
		await watchClipboardRead(page);
	});

	const ROUTES: { name: string; open: (page: Page) => Promise<void>; row: string }[] = [
		{ name: 'prose Paste', open: (page) => rightClickOn(page, 'abcd'), row: 'Paste' },
		// The word stays selected after the menu, so the selection toolbar is up at the read.
		{
			name: 'prose Paste over a word Safari selected',
			open: () => rightClickWord(editor, 'abcd', [0], 0),
			row: 'Paste'
		},
		{
			name: 'prose Paste as plain text',
			open: (page) => rightClickOn(page, 'abcd'),
			row: 'Paste as plain text'
		},
		{
			name: 'Replace with clipboard',
			open: (page) => rightClickOn(page, 'code'),
			row: 'Replace with clipboard'
		},
		{ name: 'cell Paste', open: (page) => rightClickOn(page, 'cell'), row: 'Paste' }
	];

	for (const route of ROUTES) {
		test(`${route.name}`, async ({ page }) => {
			await route.open(page);
			await menuItem(page, route.row).click();
			await editor.bridge.waitForSourceContains('pasted');
			expect(await menuAtClipboardRead(page)).toBe(false);
		});
	}
});

async function rightClickOn(page: Page, word: string): Promise<void> {
	const at = await textRunCenter(page, word);
	await page.mouse.click(at.x, at.y, { button: 'right' });
}
