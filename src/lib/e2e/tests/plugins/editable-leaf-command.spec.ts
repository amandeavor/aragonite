import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { capturedErrors } from './helpers';
import { MemoPage } from './memo-helpers';

/**
 * Block commands a plugin registers on an editable leaf
 * (requirements/plugins/editable-leaf-command.md): the `%%` memo kind binds `memo.tag`
 * (Mod+Shift+K, rewrites `%%` to `%%!`) and `memo.boom` (Mod+Shift+J, throws). A registered
 * command resolves through `createEditableLeaf`, and a throwing handler is reported as an
 * `origin: 'command'` error.
 */

const memoTagged = (page: Page) =>
	page.evaluate(() => (window as any).__test.getDocument().children[1]?.metadata?.memoTagged);

test.describe('plugin block commands on the editable-leaf level: the %% memo kind', () => {
	let editor: MemoPage;

	test.beforeEach(async ({ page }) => {
		editor = new MemoPage(page);
		await editor.gotoSeed();
	});

	test('a bound plugin command tags the memo through its bytes, and a reload keeps the tag', async ({
		page
	}) => {
		await editor.memo.click();
		await page.keyboard.press('ControlOrMeta+Shift+K');

		await editor.bridge.waitForSourceContains('%%! memo text');
		expect(await memoTagged(page)).toBe(true);

		const source = await editor.bridge.getSource();
		await editor.loadContent(source);
		expect(await memoTagged(page)).toBe(true);
	});

	test('one undo after typing then the command takes back only the tag', async ({ page }) => {
		await editor.memo.click();
		await page.keyboard.press('End');
		await editor.typeSlowly('!');
		await editor.bridge.waitForSourceContains('%% memo text!');

		await page.keyboard.press('ControlOrMeta+Shift+K');
		await editor.bridge.waitForSourceContains('%%! memo text!');

		await page.keyboard.press('ControlOrMeta+z');
		await editor.bridge.waitForSourceContains('%% memo text!');
		expect(await memoTagged(page)).toBeUndefined();
	});

	test('the caret stays on the text it was in, so the next letter lands there', async ({
		page
	}) => {
		await editor.memo.click();
		await page.keyboard.press('End');
		await page.keyboard.press('ArrowLeft');

		await page.keyboard.press('ControlOrMeta+Shift+K');
		await editor.bridge.waitForSourceContains('%%! memo tex');
		await page.keyboard.type('!');
		await editor.bridge.waitForSourceContains('%%! memo tex!t');
	});

	test('a throwing handler is contained: one origin:command error, no uncaught pageerror', async ({
		page
	}) => {
		await page.evaluate(() => (window as any).__test.startErrorCapture());

		await editor.memo.click();
		await page.keyboard.press('End');
		await page.keyboard.press('ControlOrMeta+Shift+J');

		await page.waitForFunction(
			() => (window as any).__test.getCapturedErrors().includes('command'),
			null,
			{ timeout: 5000 }
		);
		const origins = await capturedErrors(page);
		expect(origins.filter((o) => o === 'command')).toHaveLength(1);

		// The gesture did nothing but consume the key, and the editor stays interactive.
		await page.keyboard.type('!');
		await editor.bridge.waitForSourceContains('%% memo text!');
	});
});
