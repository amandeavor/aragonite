import { test, expect } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { MermaidPage, MERMAID_FENCE } from '../plugins/mermaid-helpers';
import { BlockMathPage } from '../plugins/latex-reveal-helpers';
import { findInput, openFind, openReplace, replaceInput } from './helpers';

// A block's hover controls in its top-right corner (`requirements/search/corner-controls.md`):
// the open find bar moves only the ones it covers below itself.

const host = (page: Page, index: number) => page.locator(`[data-block-path='[${index}]']`);
// The left edge of the block's first line, clear of the bar on the right.
const hover = (page: Page, index: number) => host(page, index).hover({ position: { x: 20, y: 8 } });

const areaUnderBar = (control: Locator) =>
	control.evaluate((el) => {
		const bar = document.querySelector('.search-bar')!.getBoundingClientRect();
		const box = el.getBoundingClientRect();
		const across = Math.min(bar.right, box.right) - Math.max(bar.left, box.left);
		const down = Math.min(bar.bottom, box.bottom) - Math.max(bar.top, box.top);
		return Math.max(0, across) * Math.max(0, down);
	});

test.describe('the find bar beside a code block', () => {
	// Tall enough below the lower block to scroll that block up to the top.
	const DOC =
		'```js\nconst a = 1;\nconst b = 2;\n```\n\nmiddle\n\n```js\none\n```\n\n' +
		'after\n\n'.repeat(40);
	const TOP = 0;
	const LOWER = 2;

	const rail = (page: Page, index: number) => host(page, index).locator(':scope > .code-rail');
	const railOffset = (page: Page, index: number) =>
		host(page, index).evaluate((el) => {
			const box = el.querySelector(':scope > .code-rail')!.getBoundingClientRect();
			return box.top - el.getBoundingClientRect().top;
		});

	// The rail is already moved for the find row, and the click leaves the pointer on the bar, in
	// no block: only the bar's own resize can move the rail clear of the taller bar.
	const expandReplace = async (editor: EditorPage) => {
		await openFind(editor);
		await hover(editor.page, TOP);
		await editor.page.getByRole('button', { name: 'Toggle replace' }).click();
		await replaceInput(editor.page).waitFor({ state: 'visible' });
	};

	let editor: EditorPage;
	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto('?presentationMode=live');
		await editor.loadContent(DOC);
	});

	for (const [rows, open] of [
		['find row', openFind],
		['opened with the replace row', openReplace],
		['replace row expanded after opening', expandReplace]
	] as const) {
		test(`the open bar leaves the controls of a top code block uncovered (${rows})`, async ({
			page
		}) => {
			// No hover after the bar opens: the pointer rests on the block it clicked, rail showing.
			await open(editor);
			await expect
				.poll(() => areaUnderBar(rail(page, TOP)), {
					message: 'square pixels of the controls under the bar'
				})
				.toBe(0);
		});
	}

	test('a code block the bar does not cover keeps its controls in place', async ({ page }) => {
		const resting = await railOffset(page, LOWER);
		await openFind(editor);
		await hover(page, LOWER);
		await expect.poll(() => railOffset(page, LOWER)).toBe(resting);
	});

	test('a code block scrolled under the open bar moves its controls once hovered', async ({
		page
	}) => {
		const resting = await railOffset(page, LOWER);
		await openFind(editor);
		const blockTop = await host(page, LOWER).evaluate((el) => {
			const root = el.closest('.editor')!;
			return el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
		});
		await editor.scrollEditorTo(blockTop);
		await hover(page, LOWER);
		await expect.poll(() => railOffset(page, LOWER)).not.toBe(resting);
		await expect.poll(() => areaUnderBar(rail(page, LOWER))).toBe(0);
	});

	test('closing the bar puts the covered controls back', async ({ page }) => {
		const resting = await railOffset(page, TOP);
		await openFind(editor);
		await hover(page, TOP);
		await expect.poll(() => railOffset(page, TOP)).not.toBe(resting);

		await page.keyboard.press('Escape');
		await expect(findInput(page)).toHaveCount(0);
		await expect.poll(() => railOffset(page, TOP)).toBe(resting);
	});
});

test.describe('the find bar beside a diagram', () => {
	test('the open bar leaves the toolbar of a top diagram uncovered', async ({ page }) => {
		const editor = new MermaidPage(page);
		await editor.loadDiagram(`${MERMAID_FENCE}\n\nafter\n`);
		await editor.clickBlock(1);
		await page.keyboard.press('ControlOrMeta+f');
		await findInput(page).waitFor({ state: 'visible' });

		await hover(page, 0);
		await expect
			.poll(() => areaUnderBar(page.locator('.mermaid-toolbar')), {
				message: 'square pixels of the toolbar under the bar'
			})
			.toBe(0);
	});
});

test.describe('the find bar beside an equation', () => {
	test('the open bar leaves the layout toggle of a top equation uncovered', async ({ page }) => {
		const editor = new BlockMathPage(page);
		await editor.gotoMathSeed('mathblock');
		await editor.loadContent('$$x^2$$\n\nafter\n');
		await editor.clickBlock(1);
		await page.keyboard.press('ControlOrMeta+f');
		await findInput(page).waitFor({ state: 'visible' });

		await editor.revealByClick();
		await hover(page, 0);
		await expect
			.poll(() => areaUnderBar(page.locator('.math-preview-toggle')), {
				message: 'square pixels of the toggle under the bar'
			})
			.toBe(0);
	});
});
