import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { focusWalkKey } from '../../platform-keys';
import { clickInPlace } from '../../click-in-place';
import { textRunCenter, textRunStart } from '../../text-runs';
import { addHostButtons, focusName, holdsCaret } from '../../reading-focus-probes';
import { multiClick } from '../../multi-click';
import { skipUnlessSupported } from '../../browser-engine';

// Reading mode has no caret (requirements/presentation/reading-caretless.md): a click focuses its
// block and leaves none, and the arrows step from block to block.

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

const scrollTop = (editor: EditorPage) =>
	editor.editorContainer.evaluate((el) => (el as HTMLElement).scrollTop);

test.describe('reading mode: a click keeps no caret', () => {
	const DOC = 'Alpha beta gamma delta.\n\nSecond para here.\n\nThird one.\n';

	test('a click on a word focuses its block and leaves no caret', async ({ page }) => {
		const editor = await loadReading(page, DOC);

		await clickWord(page, [0], 'gamma');

		expect(await focusName(page)).toContain('[0]');
		expect(await holdsCaret(page)).toBe(false);
		expect(await editor.bridge.getSelection()).toBeNull();
	});

	// Only Firefox and WebKit can red here: Chromium reports the click's caret once it's cleared.
	test('a click tells selectionChange subscribers of no caret', async ({ page }) => {
		const editor = await loadReading(page, DOC);
		await page.evaluate(() => (window as any).__test.startSelectionChangeCapture());

		await clickWord(page, [0], 'gamma');
		await clickWord(page, [1], 'para');
		await expect.poll(() => focusName(page)).toContain('[1]');

		const heard = await page.evaluate(() => (window as any).__test.stopSelectionChangeCapture());
		expect(heard.filter((record: { focus: unknown }) => record.focus !== null)).toEqual([]);
		expect(await editor.bridge.getSelection()).toBeNull();
	});

	test('a click in a focused block: a host around the editor hears no focus leave', async ({
		page
	}) => {
		await loadReading(page, DOC);
		await clickWord(page, [0], 'gamma');
		await page.evaluate(() => {
			const w = window as any;
			w.__heard = [];
			const host = document.querySelector('.editor')!.parentElement!;
			for (const type of ['focusin', 'focusout']) {
				host.addEventListener(type, () => w.__heard.push(type));
			}
		});

		await clickWord(page, [0], 'delta');
		await clickWord(page, [0], 'beta');
		await expect.poll(() => holdsCaret(page)).toBe(false);

		expect(await page.evaluate(() => (window as any).__heard)).toEqual([]);
	});

	test('the find bar opened and closed after a click hands focus back to the clicked word', async ({
		page
	}) => {
		const editor = await loadReading(page, DOC);
		await clickWord(page, [1], 'para');
		await page.keyboard.press('ControlOrMeta+f');
		await page.keyboard.type('here');
		await page.keyboard.press('Escape');

		await expect.poll(() => focusName(page)).toContain('[1]');
		expect(await holdsCaret(page)).toBe(false);
		await editor.setPresentationMode('source');
		await page.keyboard.type('X');
		await editor.bridge.waitForSourceContains('Second Xpara here.');
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

	test('a click, then an arrow to the next block: leaving puts the caret at that block', async ({
		page
	}) => {
		const editor = await loadReading(page, DOC);

		await clickWord(page, [0], 'gamma');
		await page.keyboard.press('ArrowDown');
		await editor.setPresentationMode('source');
		await page.keyboard.type('X');

		await editor.bridge.waitForSourceContains('XSecond para here.');
	});

	test('a click, then ArrowUp: leaving puts the caret at the end of the block above', async ({
		page
	}) => {
		const editor = await loadReading(page, DOC);

		await clickWord(page, [1], 'para');
		await page.keyboard.press('ArrowUp');
		await editor.setPresentationMode('source');
		await page.keyboard.type('X');

		await editor.bridge.waitForSourceContains('gamma delta.X');
	});
});

test.describe('reading mode: the arrows step blocks', () => {
	const WRAPPED = 'Long words here '.repeat(30).trim() + '.';
	const DOC = ['Zero.', WRAPPED, 'Two.', '| H1 | H2 |\n| --- | --- |\n| a | bee |', 'Four.'].join(
		'\n\n'
	);

	test('from a click, ArrowDown leaves a wrapped paragraph and walks into a table', async ({
		page
	}) => {
		await loadReading(page, DOC);
		await clickWord(page, [0], 'Zero');

		const seen: string[] = [];
		for (let i = 0; i < 4; i++) {
			await page.keyboard.press('ArrowDown');
			seen.push((await focusName(page)).split(' ').slice(0, 2).join(' '));
		}

		expect(seen).toEqual([
			'div.text-editable-block [1]',
			'div.text-editable-block [2]',
			'div.table-cell [3]',
			'div.table-cell [3]'
		]);
		expect(await holdsCaret(page)).toBe(false);
	});

	test('a table cell steps by the grid, and out of the table at its edge', async ({ page }) => {
		await loadReading(page, DOC);
		await clickInPlace(page.locator('.table-cell', { hasText: 'H1' }));

		await page.keyboard.press('ArrowRight');
		expect(await focusName(page)).toContain('"H2"');
		await page.keyboard.press('ArrowDown');
		expect(await focusName(page)).toContain('"bee"');
		await page.keyboard.press('ArrowLeft');
		expect(await focusName(page)).toContain('"a"');
		await page.keyboard.press('ArrowDown');
		expect(await focusName(page)).toContain('[4]');
	});

	test('after Tab lands on the stop, the arrows still move', async ({ page }) => {
		await loadReading(page, DOC);
		await addHostButtons(page);

		await page.locator('#host-before').focus();
		await page.keyboard.press(focusWalkKey());
		expect(await focusName(page)).toContain('[0]');
		await page.keyboard.press('ArrowRight');
		expect(await focusName(page)).toContain('[1]');
		await page.keyboard.press('ArrowLeft');
		expect(await focusName(page)).toContain('[0]');
	});

	test('the stop follows the arrows: Tab back in lands on the block arrowed to', async ({
		page
	}) => {
		await loadReading(page, DOC);
		await addHostButtons(page);

		await clickWord(page, [0], 'Zero');
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('ArrowDown');
		await page.locator('#host-before').focus();
		await page.keyboard.press(focusWalkKey());

		expect(await focusName(page)).toContain('[2]');
	});

	test('ArrowDown in a block taller than the editor scrolls by a line until it ends', async ({
		page
	}) => {
		const tall = 'Tall words here '.repeat(600).trim() + '.';
		const editor = await loadReading(page, `Top.\n\n${tall}\n\nAfter.\n`);
		await clickWord(page, [0], 'Top');
		await page.keyboard.press('ArrowDown');
		expect(await focusName(page)).toContain('[1]');

		const before = await scrollTop(editor);
		await page.keyboard.press('ArrowDown');
		expect(await focusName(page)).toContain('[1]');
		const step = (await scrollTop(editor)) - before;
		expect(step).toBeGreaterThan(5);
		expect(step).toBeLessThan(60);

		let presses = 1;
		while ((await focusName(page)).includes('[1]') && presses < 400) {
			await page.keyboard.press('ArrowDown');
			presses++;
		}
		expect(await focusName(page)).toContain('[2]');
		expect(presses).toBeGreaterThan(5);
	});
});
