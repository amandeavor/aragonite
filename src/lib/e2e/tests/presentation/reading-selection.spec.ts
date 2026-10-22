import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { pointAtRaw } from '../../text-runs';

// Selecting and copying with the mouse works the same in reading mode as in an editing mode
// (requirements/presentation/reading-selection.md): every row runs in both.

const DOC = 'alpha one\n\nbeta two\n\ngamma\n';
const MODES = ['reading', 'source'] as const;

async function load(page: Page, mode: string, md = DOC): Promise<EditorPage> {
	const editor = new EditorPage(page);
	await editor.goto(`?presentationMode=${mode}`);
	await editor.loadContent(md);
	return editor;
}

async function drag(page: Page, from: [number[], number], to: [number[], number]): Promise<void> {
	const start = await pointAtRaw(page, ...from);
	const end = await pointAtRaw(page, ...to);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 8 });
	await page.mouse.up();
}

/** The clipboard's text once a copy has written `expected`, LF line endings throughout. */
async function copied(editor: EditorPage, expected: string): Promise<string> {
	await editor.waitForClipboardContains(expected, 3000).catch(() => {});
	return (await editor.readClipboard()).replace(/\r\n/g, '\n');
}

for (const mode of MODES) {
	test.describe(`${mode} mode: Shift+click`, () => {
		test('extends from a click into another block', async ({ page }) => {
			const editor = await load(page, mode);

			await editor.clickBlockAtPath([0], 2);
			await editor.shiftClickBlock([1], 4);

			expect(await editor.bridge.getSelection()).toEqual({
				anchor: { path: [0], offset: 2 },
				focus: { path: [1], offset: 4 }
			});
		});

		test('extends from a click inside the same block', async ({ page }) => {
			const editor = await load(page, mode);

			await editor.clickBlockAtPath([0], 2);
			await editor.shiftClickBlock([0], 7);

			expect(await page.evaluate(() => getSelection()?.toString())).toBe('pha o');
		});
	});

	test.describe(`${mode} mode: copying a range across blocks`, () => {
		test('a drag, then Mod+C, copies the Markdown of the range', async ({ page }) => {
			const editor = await load(page, mode);
			await editor.seedClipboard('SENTINEL');

			await drag(page, [[0], 0], [[1], 4]);
			await editor.waitForCrossBlock(true);
			await page.keyboard.press('ControlOrMeta+c');

			expect(await copied(editor, 'beta')).toBe('alpha one\n\nbeta');
		});

		test('a Shift+click, then Mod+C, copies the Markdown of the range', async ({ page }) => {
			const editor = await load(page, mode);
			await editor.seedClipboard('SENTINEL');

			await editor.clickBlockAtPath([0], 2);
			await editor.shiftClickBlock([1], 4);
			await page.keyboard.press('ControlOrMeta+c');

			expect(await copied(editor, 'beta')).toBe('pha one\n\nbeta');
		});

		test('a range from a divider copies the range, not the divider', async ({ page }) => {
			const editor = await load(page, mode, 'alpha one\n\n---\n\nbeta two\n');
			await editor.seedClipboard('SENTINEL');

			const rule = (await page.locator('.thematic-break-block').first().boundingBox())!;
			await page.mouse.click(rule.x + rule.width / 2, rule.y + rule.height / 2);
			await editor.shiftClickBlock([2], 4);
			await editor.waitForCrossBlock(true);
			await page.keyboard.press('ControlOrMeta+c');

			expect(await copied(editor, 'beta')).toBe('---\n\nbeta');
		});

		// The browser's own context menu can't be driven; its Copy sends the same command.
		test("the browser menu's Copy copies the Markdown of the range", async ({ page }) => {
			const editor = await load(page, mode);
			await editor.seedClipboard('SENTINEL');

			await drag(page, [[0], 0], [[1], 4]);
			await editor.waitForCrossBlock(true);
			await page.evaluate(() => document.execCommand('copy'));

			expect(await copied(editor, 'beta')).toBe('alpha one\n\nbeta');
		});
	});
}
