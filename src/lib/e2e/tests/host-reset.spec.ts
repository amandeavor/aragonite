import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { EditorPage } from '../editor-page';
import { gotoReady } from '../goto-ready';

// The editor lays out the same on a page with no CSS reset as on `/test/editor`, which has one,
// and leaves what a host put inside it on the page's own styles.
// Requirements: e2e/requirements/host-reset.md.

const SEED = [
	'# A heading',
	'',
	'A paragraph of plain text.',
	'',
	'- A list item',
	'- Another item',
	'  1. A nested ordered item',
	'',
	'```js',
	'const answer = 42;',
	'```',
	'',
	'---',
	'',
	'| Name | Value |',
	'| ---- | ----- |',
	'| one  | 1     |',
	'',
	'> A quote',
	'> over two lines',
	''
].join('\n');

const LONG_LINE = `${'A long line that runs the whole width of the editor and wraps. '.repeat(6).trim()}\n`;

interface BlockBox {
	path: string;
	left: number;
	width: number;
	height: number;
}

/** Every block's box, walked through the tree, with `left` taken from the editor's own edge. */
function blockBoxes(page: Page): Promise<BlockBox[]> {
	return page.evaluate(() => {
		const test = (window as any).__test;
		const editorLeft = document.querySelector('.editor')!.getBoundingClientRect().left;
		const boxes: BlockBox[] = [];
		const walk = (children: { children?: unknown[] }[], parent: number[]) =>
			children.forEach((child, i) => {
				const path = [...parent, i];
				const rect: DOMRect | null = test.rects.blockRect(path);
				if (!rect) return;
				boxes.push({
					path: path.join('.'),
					left: rect.left - editorLeft,
					width: rect.width,
					height: rect.height
				});
				if (Array.isArray(child.children)) walk(child.children as { children?: unknown[] }[], path);
			});
		walk(test.getDocument().children, []);
		return boxes;
	});
}

/** The width of the box the editor sits in, which each route sets in its own way. */
const containerWidth = (page: Page) =>
	page.locator('.editor').evaluate((el) => el.parentElement!.getBoundingClientRect().width);

/** The editor's own height, which decides whether a classic scrollbar takes width from its blocks. */
const editorHeight = (page: Page) =>
	page.locator('.editor').evaluate((el) => el.getBoundingClientRect().height);

async function loadOnNoReset(page: Page, md: string, query = ''): Promise<void> {
	await gotoReady(page, query ? `/test/no-reset?${query}` : '/test/no-reset');
	await new EditorPage(page).loadContent(md);
}

test.describe('an editor on a page with no CSS reset', () => {
	test('the editor fits its container', async ({ page }) => {
		await loadOnNoReset(page, SEED);

		const fit = await page.evaluate(() => {
			const editor = document.querySelector('.editor')!;
			const box = document.querySelector('[data-testid="editor-box"]')!.getBoundingClientRect();
			const rect = editor.getBoundingClientRect();
			return {
				left: rect.left - box.left,
				right: box.right - rect.right,
				overflow: editor.scrollWidth - editor.clientWidth
			};
		});
		expect(fit.left).toBeGreaterThanOrEqual(-0.5);
		expect(fit.right).toBeGreaterThanOrEqual(-0.5);
		expect(fit.overflow).toBeLessThanOrEqual(0);
	});

	test('typing at the end of a long line does not scroll the page sideways', async ({ page }) => {
		await loadOnNoReset(page, LONG_LINE);
		await page.locator('.editor [contenteditable="true"]').first().click();
		await page.keyboard.press('ControlOrMeta+End');
		await page.keyboard.type(' and on');
		await expect(page.locator('.editor')).toContainText('wraps. and on');

		const scroll = await page.evaluate(() => ({
			x: window.scrollX,
			pageWidth: document.documentElement.scrollWidth,
			viewport: document.documentElement.clientWidth
		}));
		expect(scroll.x).toBe(0);
		expect(scroll.pageWidth).toBeLessThanOrEqual(scroll.viewport);
	});

	test('every block has the box it has on the page with a reset', async ({ page }) => {
		const withReset = new EditorPage(page);
		await withReset.goto();
		await withReset.loadContent(SEED);
		const width = Math.round(await containerWidth(page));
		const height = Math.round(await editorHeight(page));
		const expected = await blockBoxes(page);

		await loadOnNoReset(page, SEED, `width=${width}&height=${height}`);
		// A harness that drifted reads here, before any block is blamed for it.
		expect(await containerWidth(page)).toBe(width);
		expect(Math.round(await editorHeight(page))).toBe(height);
		const actual = await blockBoxes(page);

		expect(actual.map((box) => box.path)).toEqual(expected.map((box) => box.path));
		for (const [i, box] of actual.entries()) {
			const want = expected[i];
			for (const side of ['left', 'width', 'height'] as const) {
				expect
					.soft(Math.abs(box[side] - want[side]), `block ${box.path} ${side}`)
					.toBeLessThanOrEqual(1);
			}
		}
	});

	test('what the host put inside the editor keeps the page’s own styles', async ({ page }) => {
		await loadOnNoReset(page, 'A paragraph.\n', 'hostContent=on');
		const styleOf = (selector: string) =>
			page.locator(selector).evaluate((el) => {
				const s = getComputedStyle(el);
				return { margin: s.margin, padding: s.padding, boxSizing: s.boxSizing };
			});
		const button = await styleOf('[data-testid="reference"] .host-button');
		const paragraph = await styleOf('[data-testid="reference"] .host-paragraph');

		await test.step('the header', async () => {
			expect(await styleOf('.editor-header .host-button')).toEqual(button);
			expect(await styleOf('.editor-header .host-paragraph')).toEqual(paragraph);
		});

		await test.step('an inline decoration widget and a block badge', async () => {
			expect(await styleOf('.decoration-island .host-button')).toEqual(button);
			expect(await styleOf('.decoration-badge .host-button')).toEqual(button);
		});

		for (const [trigger, name] of [
			['@@', 'component-row'],
			['%%', 'dom-row']
		]) {
			await test.step(`an inline menu ${name}`, async () => {
				await page.locator('.editor [contenteditable="true"]').first().click();
				await page.keyboard.press('End');
				await page.keyboard.type(` ${trigger}`);
				const row = `.inline-menu[data-inline-menu="${name}"] .host-button`;
				await expect(page.locator(row)).toBeVisible();
				expect(await styleOf(row)).toEqual(button);
				await page.keyboard.press('Escape');
			});
		}
	});

	test('the find bar keeps the editor’s reset when its anchor sits inside the header', async ({
		page
	}) => {
		const barStyles = async (query: string) => {
			await loadOnNoReset(page, 'A paragraph.\n', query);
			await page.locator('.editor [contenteditable="true"]').first().click();
			await page.keyboard.press('ControlOrMeta+f');
			await expect(page.locator('.search-bar')).toBeVisible();
			return page.locator('.search-bar').evaluate((bar) =>
				[bar, ...bar.querySelectorAll('*')].map((el) => {
					const s = getComputedStyle(el);
					return `${el.tagName} ${s.margin} | ${s.padding} | ${s.boxSizing}`;
				})
			);
		};
		const inRoot = await barStyles('hostContent=on');
		const inHeader = await barStyles('hostContent=on&findBar=header');
		await expect(page.locator('.editor-header .search-bar')).toHaveCount(1);
		expect(inHeader).toEqual(inRoot);
	});
});
