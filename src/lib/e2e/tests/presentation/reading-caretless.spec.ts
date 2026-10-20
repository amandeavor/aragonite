import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { textRunCenter, textRunStart } from '../../text-runs';
import { focusName, holdsCaret } from '../../reading-focus-probes';
import { multiClick } from '../../multi-click';
import { skipUnlessSupported } from '../../browser-engine';

// Reading mode has no caret (requirements/presentation/reading-caretless.md): a click focuses its
// block and leaves none.

async function loadReading(page: Page, md: string): Promise<EditorPage> {
	const editor = new EditorPage(page);
	await editor.goto('?presentationMode=reading');
	await editor.loadContent(md);
	return editor;
}

async function clickWord(page: Page, path: number[], word: string): Promise<void> {
	const at = await textRunStart(page, word, { path });
	await page.mouse.click(at.x, at.y);
}

test.describe('reading mode: a click keeps no caret', () => {
	const DOC = 'Alpha beta gamma delta.\n\nSecond para here.\n\nThird one.\n';

	test('a click on a word focuses its block and leaves no caret', async ({ page }) => {
		const editor = await loadReading(page, DOC);

		await clickWord(page, [0], 'gamma');

		expect(await focusName(page)).toContain('[0]');
		expect(await holdsCaret(page)).toBe(false);
		expect(await editor.bridge.getSelection()).toBeNull();
	});

	test('a double click still selects its word', async ({ page }) => {
		skipUnlessSupported(page, 'nativeWordSelect');
		await loadReading(page, DOC);

		const at = await textRunCenter(page, 'gamma', { path: [0] });
		await multiClick(page, at, 2);

		expect(await page.evaluate(() => getSelection()?.toString().trim())).toBe('gamma');
	});

	// Keyboard selection extends from a caret, and reading mode keeps none: a pinned delta.
	test('Shift+click after a click focuses the block it lands on and selects nothing', async ({
		page
	}) => {
		const editor = await loadReading(page, DOC);

		await clickWord(page, [0], 'gamma');
		const at = await textRunCenter(page, 'para', { path: [1] });
		await page.keyboard.down('Shift');
		await page.mouse.click(at.x, at.y);
		await page.keyboard.up('Shift');

		expect(await focusName(page)).toContain('[1]');
		expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');
		expect(await editor.bridge.getSelection()).toBeNull();
	});

	test('leaving reading mode puts the caret where the click was', async ({ page }) => {
		const editor = await loadReading(page, DOC);

		await clickWord(page, [0], 'gamma');
		await editor.setPresentationMode('source');
		await page.keyboard.type('X');

		await editor.bridge.waitForSourceContains('Alpha beta Xgamma delta.');
	});
});
