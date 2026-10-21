import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { MermaidPage, settleDiagrams } from './mermaid-helpers';

// A diagram drawing never changes the host page around the editor
// (requirements/plugins/mermaid-host-page.md): the page doesn't grow, and nothing stays behind.

interface BodyWatch {
	/** The page's scroll height after each element joined `document.body`. */
	heights: number[];
	/** Elements that joined `document.body` and are still there. */
	left: string[];
}

/** Watches `document.body` from the first paint, before any diagram renders. */
async function watchBody(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const heights: number[] = [];
		const added = new Set<Element>();
		const name = (el: Element) => `${el.tagName.toLowerCase()}#${el.id}`;
		(window as unknown as { __bodyWatch: () => BodyWatch }).__bodyWatch = () => ({
			heights,
			left: [...added].filter((el) => el.isConnected).map(name)
		});
		document.addEventListener('DOMContentLoaded', () =>
			new MutationObserver((records) => {
				for (const record of records)
					for (const node of record.addedNodes) {
						if (!(node instanceof Element)) continue;
						added.add(node);
						heights.push(
							Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
						);
					}
			}).observe(document.body, { childList: true })
		);
	});
}

function bodyWatch(page: Page): Promise<BodyWatch> {
	return page.evaluate(() => (window as unknown as { __bodyWatch: () => BodyWatch }).__bodyWatch());
}

/** The page's scroll height now, which every reading taken during a render must match. */
function pageHeight(page: Page): Promise<number> {
	return page.evaluate(() =>
		Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
	);
}

test.describe('a rendering diagram leaves the host page alone', () => {
	test('the first render of two diagrams never grows the page', async ({ page }) => {
		await watchBody(page);
		const editor = new MermaidPage(page);
		await editor.gotoPlugins('mermaid');
		await settleDiagrams(page, 2);

		const watch = await bodyWatch(page);
		const height = await pageHeight(page);
		expect(watch.heights.length).toBeGreaterThan(0);
		expect(watch.heights).toEqual(watch.heights.map(() => height));
		expect(watch.left).toEqual([]);
	});

	test('a theme flip redraws both without growing the page', async ({ page }) => {
		await watchBody(page);
		const editor = new MermaidPage(page);
		await editor.gotoPlugins('mermaid');
		await settleDiagrams(page, 2);
		const drawn = (await bodyWatch(page)).heights.length;

		await page.getByTestId('theme-toggle').click();
		await expect.poll(async () => (await bodyWatch(page)).heights.length).toBeGreaterThan(drawn);
		await settleDiagrams(page, 2);

		const watch = await bodyWatch(page);
		const height = await pageHeight(page);
		expect(watch.heights).toEqual(watch.heights.map(() => height));
		expect(watch.left).toEqual([]);
	});

	test('a diagram that fails to render leaves nothing behind, render after render', async ({
		page
	}) => {
		await watchBody(page);
		const editor = new MermaidPage(page);
		await editor.loadDiagram('Above\n\n```mermaid\nnotadiagram broken\n```\n\nBelow\n', 'error');
		const tried = (await bodyWatch(page)).heights.length;

		await page.getByTestId('theme-toggle').click();
		await expect.poll(async () => (await bodyWatch(page)).heights.length).toBeGreaterThan(tried);
		await expect(page.locator('.mermaid-error')).toBeVisible();

		expect((await bodyWatch(page)).left).toEqual([]);
	});
});
